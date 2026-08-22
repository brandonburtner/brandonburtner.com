"""CPAP notifier Lambda — runs on an EventBridge schedule (hourly).

For every user it evaluates each notification rule against each maintenance item
and sends browser push notifications when a rule fires. Per-item firing state is
kept in the item's `notifyLog` map so we never double-send within a due cycle and
so recurring reminders respect their interval.
"""
import boto3

import common
import push_sender

_table = common._table


def _scan_all():
    items = []
    resp = _table.scan()
    items.extend(resp.get("Items", []))
    while "LastEvaluatedKey" in resp:
        resp = _table.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
        items.extend(resp.get("Items", []))
    return [common._clean(i) for i in items]


def _group_by_user(records):
    users = {}
    for r in records:
        users.setdefault(r["pk"], []).append(r)
    return users


def _should_fire(notif, item, now):
    """Return (fire?, new_log_for_this_notif). Mutates nothing."""
    nid = notif["sk"].split("#", 1)[1]
    d = common.due_at(item)
    fire_time = d + int(notif.get("offsetHours", 0)) * common.HOUR_MS
    log = (item.get("notifyLog") or {}).get(nid, {})
    # A fresh due cycle resets this notification's state.
    same_cycle = log.get("cycle") == d

    if now < fire_time:
        return False, log if same_cycle else {}

    if notif.get("recurring"):
        # Only while the item is actually past due.
        if now < d:
            return False, log if same_cycle else {}
        last = log.get("lastFiredAt") if same_cycle else None
        every = max(1, int(notif.get("everyHours", 24))) * common.HOUR_MS
        if last is None or (now - last) >= every:
            return True, {"cycle": d, "lastFiredAt": now, "fired": True}
        return False, log
    else:
        if same_cycle and log.get("fired"):
            return False, log
        return True, {"cycle": d, "lastFiredAt": now, "fired": True}


def _message(notif, item):
    cat = item.get("category", "")
    verb = {"Maintenance": "Maintenance due",
            "Replacement": "Replacement due",
            "Orders": "Order due"}.get(cat, "Due")
    return {
        "title": f"CPAP • {verb}",
        "body": item["name"],
        "tag": f"cpap-{item['sk'].split('#',1)[1]}",
        "url": "https://brandonburtner.com/cpap/",
    }


def handler(event, context):
    now = common.now_ms()
    users = _group_by_user(_scan_all())
    total_sent = 0

    for user_id, records in users.items():
        _, items, notifs, subs = common.split_records(records)
        if not subs or not notifs:
            continue
        enabled_notifs = [n for n in notifs if n.get("enabled")]

        for item in items:
            log_updates = {}
            fired_any = False
            for notif in enabled_notifs:
                if not common.scope_matches(notif.get("scope", {"type": "all"}), item):
                    continue
                fire, new_log = _should_fire(notif, item, now)
                nid = notif["sk"].split("#", 1)[1]
                log_updates[nid] = new_log
                if fire:
                    fired_any = True
                    sent = push_sender.send_to_subs(
                        subs, _message(notif, item),
                        on_dead=lambda sid, u=user_id: _table.delete_item(
                            Key={"pk": u, "sk": f"PUSH#{sid}"}),
                    )
                    total_sent += sent

            # Persist notifyLog if anything changed.
            existing_log = item.get("notifyLog") or {}
            merged = dict(existing_log)
            for nid, val in log_updates.items():
                merged[nid] = val
            if merged != existing_log or fired_any:
                _table.update_item(
                    Key={"pk": user_id, "sk": item["sk"]},
                    UpdateExpression="SET notifyLog = :l",
                    ExpressionAttributeValues={":l": common._to_dynamo(merged)},
                )

    print(f"notifier run complete: {total_sent} push message(s) sent, "
          f"{len(users)} user(s) scanned")
    return {"sent": total_sent, "users": len(users)}
