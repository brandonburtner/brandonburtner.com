"""CPAP API Lambda — invoked via a Lambda Function URL (payload format 2.0).

Authenticates every request with a Google ID token (Bearer) and reads/writes
the user's maintenance items, notification rules, and push subscriptions.
"""
import json
import os

import google.auth.transport.requests
from google.oauth2 import id_token as google_id_token

import common

GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
ALLOWED_ORIGINS = {
    "https://brandonburtner.com",
    "http://localhost:5173",
    "http://localhost:4173",
}
_g_request = google.auth.transport.requests.Request()


def _cors_headers(origin):
    allow = origin if origin in ALLOWED_ORIGINS else "https://brandonburtner.com"
    return {
        "Access-Control-Allow-Origin": allow,
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "authorization,content-type",
        "Access-Control-Max-Age": "3600",
        "Vary": "Origin",
    }


def _resp(status, body, origin):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", **_cors_headers(origin)},
        "body": json.dumps(body),
    }


def _verify(token):
    claims = google_id_token.verify_oauth2_token(
        token, _g_request, GOOGLE_CLIENT_ID, clock_skew_in_seconds=10
    )
    return claims  # contains sub, email, name, ...


def handler(event, context):
    ctx = event.get("requestContext", {}).get("http", {})
    method = ctx.get("method", "GET")
    path = event.get("rawPath", "/")
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    origin = headers.get("origin", "")

    if method == "OPTIONS":
        return _resp(204, {}, origin)

    # ---- auth ----
    auth = headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return _resp(401, {"error": "missing bearer token"}, origin)
    try:
        claims = _verify(auth[7:].strip())
    except Exception as e:  # noqa: BLE001
        return _resp(401, {"error": "invalid token", "detail": str(e)}, origin)

    user_id = claims["sub"]
    email = claims.get("email", "")
    name = claims.get("name", "")

    try:
        body = json.loads(event["body"]) if event.get("body") else {}
    except (ValueError, TypeError):
        body = {}

    try:
        return _route(method, path, body, user_id, email, name, origin)
    except KeyError as e:
        return _resp(400, {"error": f"missing field {e}"}, origin)
    except Exception as e:  # noqa: BLE001
        return _resp(500, {"error": "server error", "detail": str(e)}, origin)


def _state_body(user_id):
    records = common.get_user_records(user_id)
    _, items, notifs, subs = common.split_records(records)
    return {
        "items": [common.item_view(i) for i in items],
        "notifications": [common.notif_view(n) for n in notifs],
        "pushEnabled": len(subs) > 0,
        "serverTime": common.now_ms(),
        "vapidPublicKey": VAPID_PUBLIC_KEY,
    }


def _find_item(user_id, item_id):
    key = {"pk": user_id, "sk": f"ITEM#{item_id}"}
    got = common._table.get_item(Key=key).get("Item")
    return key, (common._clean(got) if got else None)


def _route(method, path, body, user_id, email, name, origin):
    parts = [p for p in path.strip("/").split("/") if p]

    # GET /state  (seeds a new user on first hit)
    if method == "GET" and parts == ["state"]:
        common.ensure_user(user_id, email, name)
        return _resp(200, _state_body(user_id), origin)

    # ---- items ----
    if parts and parts[0] == "items":
        # POST /items  -> create custom item
        if method == "POST" and len(parts) == 1:
            item_id = common.new_id()
            interval = max(1, int(body.get("intervalDays", 30)))
            common._table.put_item(Item=common._to_dynamo({
                "pk": user_id, "sk": f"ITEM#{item_id}",
                "category": body.get("category", "Maintenance"),
                "name": body.get("name", "New item"),
                "description": body.get("description", ""),
                "intervalDays": interval,
                "lastPerformedAt": common.now_ms(),
                "sortOrder": int(body.get("sortOrder", 999)),
                "notifyLog": {},
            }))
            return _resp(200, _state_body(user_id), origin)

        if len(parts) >= 2:
            item_id = parts[1]
            key, item = _find_item(user_id, item_id)
            if not item:
                return _resp(404, {"error": "item not found"}, origin)

            # POST /items/{id}/perform  -> reset the timer to now
            if method == "POST" and len(parts) == 3 and parts[2] == "perform":
                common._table.update_item(
                    Key=key,
                    UpdateExpression="SET lastPerformedAt = :t, notifyLog = :empty",
                    ExpressionAttributeValues={":t": common.now_ms(), ":empty": {}},
                )
                return _resp(200, _state_body(user_id), origin)

            # PATCH /items/{id}  -> edit interval / name / description
            if method == "PATCH" and len(parts) == 2:
                updates, vals = [], {}
                if "intervalDays" in body:
                    updates.append("intervalDays = :iv")
                    vals[":iv"] = max(1, int(body["intervalDays"]))
                if "name" in body:
                    updates.append("#nm = :nm")
                    vals[":nm"] = str(body["name"])
                if "description" in body:
                    updates.append("description = :de")
                    vals[":de"] = str(body["description"])
                if updates:
                    kwargs = {
                        "Key": key,
                        "UpdateExpression": "SET " + ", ".join(updates),
                        "ExpressionAttributeValues": common._to_dynamo(vals),
                    }
                    if "name" in body:
                        kwargs["ExpressionAttributeNames"] = {"#nm": "name"}
                    common._table.update_item(**kwargs)
                return _resp(200, _state_body(user_id), origin)

            # DELETE /items/{id}
            if method == "DELETE" and len(parts) == 2:
                common._table.delete_item(Key=key)
                return _resp(200, _state_body(user_id), origin)

    # ---- notifications ----
    if parts and parts[0] == "notifications":
        if method == "POST" and len(parts) == 1:
            nid = common.new_id()
            common._table.put_item(Item=common._to_dynamo({
                "pk": user_id, "sk": f"NOTIF#{nid}",
                "label": body.get("label", "New notification"),
                "enabled": bool(body.get("enabled", True)),
                "offsetHours": int(body.get("offsetHours", 0)),
                "recurring": bool(body.get("recurring", False)),
                "everyHours": int(body.get("everyHours", 24)),
                "scope": body.get("scope", {"type": "all"}),
                "sortOrder": 999,
            }))
            return _resp(200, _state_body(user_id), origin)

        if len(parts) == 2:
            nid = parts[1]
            key = {"pk": user_id, "sk": f"NOTIF#{nid}"}
            if method == "DELETE":
                common._table.delete_item(Key=key)
                return _resp(200, _state_body(user_id), origin)
            if method == "PATCH":
                allowed = ["label", "enabled", "offsetHours", "recurring",
                           "everyHours", "scope"]
                updates, vals = [], {}
                for i, field in enumerate(allowed):
                    if field in body:
                        updates.append(f"{field} = :v{i}")
                        vals[f":v{i}"] = body[field]
                if updates:
                    common._table.update_item(
                        Key=key,
                        UpdateExpression="SET " + ", ".join(updates),
                        ExpressionAttributeValues=common._to_dynamo(vals),
                    )
                return _resp(200, _state_body(user_id), origin)

    # ---- push subscriptions ----
    if parts == ["push", "subscribe"] and method == "POST":
        sub = body.get("subscription", {})
        keys = sub.get("keys", {})
        endpoint = sub.get("endpoint")
        if not endpoint or "p256dh" not in keys or "auth" not in keys:
            return _resp(400, {"error": "invalid subscription"}, origin)
        # de-dupe on endpoint: deterministic id
        import hashlib
        sid = hashlib.sha256(endpoint.encode()).hexdigest()[:24]
        common._table.put_item(Item={
            "pk": user_id, "sk": f"PUSH#{sid}",
            "endpoint": endpoint, "p256dh": keys["p256dh"], "auth": keys["auth"],
            "createdAt": common.now_ms(),
        })
        return _resp(200, {"ok": True, "pushEnabled": True}, origin)

    if parts == ["push", "test"] and method == "POST":
        # Fire a one-off test push to all of this user's subscriptions.
        import push_sender
        records = common.get_user_records(user_id)
        _, _, _, subs = common.split_records(records)
        sent = push_sender.send_to_subs(
            subs,
            {"title": "CPAP Reminders", "body": "🎉 Test notification — you're all set!",
             "tag": "cpap-test"},
            on_dead=lambda sid: common._table.delete_item(
                Key={"pk": user_id, "sk": f"PUSH#{sid}"}),
        )
        return _resp(200, {"ok": True, "sent": sent}, origin)

    return _resp(404, {"error": "not found", "path": path, "method": method}, origin)
