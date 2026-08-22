"""Shared data-layer + domain logic for the CPAP reminder backend.

DynamoDB single-table design (table name from env TABLE_NAME, default 'cpap-data'):
  pk = user id (Google 'sub' claim)
  sk = record type:
     'PROFILE'          -> user profile
     'ITEM#<uuid>'      -> a maintenance item
     'NOTIF#<uuid>'     -> a notification rule
     'PUSH#<uuid>'      -> a browser push subscription

All timestamps are epoch milliseconds (numbers).
"""
import os
import time
import uuid
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ.get("TABLE_NAME", "cpap-data")
DAY_MS = 86_400_000
HOUR_MS = 3_600_000

_dynamodb = boto3.resource("dynamodb")
_table = _dynamodb.Table(TABLE_NAME)


def now_ms() -> int:
    return int(time.time() * 1000)


def new_id() -> str:
    return uuid.uuid4().hex


# ---------------------------------------------------------------------------
# Default seed data (created on a user's first login)
# ---------------------------------------------------------------------------
# category is one of: "Maintenance", "Replacement", "Orders"
DEFAULT_ITEMS = [
    ("Maintenance", "Weekly Maintenance",
     "Rinse tubing and wash humidifier chamber", 7),
    ("Replacement", "Nasal Cushion & Filter Replacement",
     "Replace the nasal cushion and filter", 14),
    ("Replacement", "Mask Frame & Tubing Replacement",
     "Replace the mask frame and tubing", 90),
    ("Replacement", "Humidifier Chamber & Headgear Replacement",
     "Replace the humidifier chamber and headgear", 180),
    ("Orders", "3 Month Order - Mask Frame, Heated Tubing, 6 Nasal Pillows, 6 Filters",
     "Place the quarterly supply order", 90),
    ("Orders", "6 Month Order - Humidifier Chamber, Headgear",
     "Place the semi-annual supply order", 180),
]

CATEGORY_ORDER = {"Maintenance": 0, "Replacement": 1, "Orders": 2}

# Two notification rules that exist when the app launches.
#   offset_hours : when to fire, relative to the due moment (0 = at due)
#   recurring    : whether it repeats
#   every_hours  : repeat interval (only used when recurring)
#   scope        : {"type": "all"} | {"type": "category", "category": ...} | {"type": "item", "itemId": ...}
DEFAULT_NOTIFICATIONS = [
    {
        "label": "When an item becomes due",
        "enabled": True,
        "offsetHours": 0,
        "recurring": False,
        "everyHours": 0,
        "scope": {"type": "all"},
    },
    {
        "label": "Daily reminder while overdue",
        "enabled": True,
        "offsetHours": 24,
        "recurring": True,
        "everyHours": 24,
        "scope": {"type": "all"},
    },
]


# ---------------------------------------------------------------------------
# (De)serialization helpers — DynamoDB resource returns Decimal for numbers
# ---------------------------------------------------------------------------
def _clean(obj):
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    return obj


def _to_dynamo(obj):
    """Convert floats to Decimal so DynamoDB accepts them."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, list):
        return [_to_dynamo(v) for v in obj]
    if isinstance(obj, dict):
        return {k: _to_dynamo(v) for k, v in obj.items()}
    return obj


# ---------------------------------------------------------------------------
# User bootstrap + reads
# ---------------------------------------------------------------------------
def ensure_user(user_id: str, email: str = "", name: str = "") -> bool:
    """Create profile + default items/notifications if this user is new.
    Returns True if the user was just seeded."""
    existing = _table.get_item(Key={"pk": user_id, "sk": "PROFILE"}).get("Item")
    if existing:
        return False

    ts = now_ms()
    with _table.batch_writer() as batch:
        batch.put_item(Item={
            "pk": user_id, "sk": "PROFILE",
            "email": email, "name": name, "createdAt": ts,
        })
        for idx, (category, name_, desc, days) in enumerate(DEFAULT_ITEMS):
            batch.put_item(Item=_to_dynamo({
                "pk": user_id, "sk": f"ITEM#{new_id()}",
                "category": category, "name": name_, "description": desc,
                "intervalDays": days, "lastPerformedAt": ts,
                "sortOrder": idx, "notifyLog": {},
            }))
        for idx, notif in enumerate(DEFAULT_NOTIFICATIONS):
            item = {"pk": user_id, "sk": f"NOTIF#{new_id()}", "sortOrder": idx}
            item.update(notif)
            batch.put_item(Item=_to_dynamo(item))
    return True


def get_user_records(user_id: str):
    resp = _table.query(KeyConditionExpression=Key("pk").eq(user_id))
    return [_clean(i) for i in resp.get("Items", [])]


def split_records(records):
    profile, items, notifs, subs = None, [], [], []
    for r in records:
        sk = r["sk"]
        if sk == "PROFILE":
            profile = r
        elif sk.startswith("ITEM#"):
            items.append(r)
        elif sk.startswith("NOTIF#"):
            notifs.append(r)
        elif sk.startswith("PUSH#"):
            subs.append(r)
    items.sort(key=lambda i: i.get("sortOrder", 0))
    notifs.sort(key=lambda n: n.get("sortOrder", 0))
    return profile, items, notifs, subs


# ---------------------------------------------------------------------------
# Domain: due-date math
# ---------------------------------------------------------------------------
def due_at(item) -> int:
    return int(item["lastPerformedAt"]) + int(item["intervalDays"]) * DAY_MS


def item_view(item):
    """Shape an item for the client, adding computed due info."""
    d = due_at(item)
    n = now_ms()
    return {
        "id": item["sk"].split("#", 1)[1],
        "category": item["category"],
        "name": item["name"],
        "description": item.get("description", ""),
        "intervalDays": int(item["intervalDays"]),
        "lastPerformedAt": int(item["lastPerformedAt"]),
        "dueAt": d,
        "pastDue": n >= d,
        "msUntilDue": d - n,
    }


def notif_view(n):
    return {
        "id": n["sk"].split("#", 1)[1],
        "label": n.get("label", ""),
        "enabled": bool(n.get("enabled", True)),
        "offsetHours": int(n.get("offsetHours", 0)),
        "recurring": bool(n.get("recurring", False)),
        "everyHours": int(n.get("everyHours", 24)),
        "scope": n.get("scope", {"type": "all"}),
    }


def scope_matches(scope, item) -> bool:
    t = scope.get("type", "all")
    if t == "all":
        return True
    if t == "category":
        return item.get("category") == scope.get("category")
    if t == "item":
        return item["sk"].split("#", 1)[1] == scope.get("itemId")
    return False
