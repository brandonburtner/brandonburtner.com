"""Web Push delivery via VAPID (used by both the API test endpoint and the notifier)."""
import json
import os

from pywebpush import webpush, WebPushException

VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:brandonburtner@gmail.com")

# pywebpush parses a PEM most reliably from a file path. The private key arrives
# as a PEM string in the env; write it to /tmp once per cold start.
_raw = os.environ["VAPID_PRIVATE_KEY"]
if _raw.lstrip().startswith("-----BEGIN"):
    VAPID_KEY = "/tmp/vapid_key.pem"
    if not os.path.exists(VAPID_KEY):
        with open(VAPID_KEY, "w") as _f:
            _f.write(_raw)
else:
    VAPID_KEY = _raw  # already a path


def send_one(sub, payload):
    """Send a single push. Returns True if delivered, False if the subscription
    is dead (404/410) and should be removed. Raises for transient errors."""
    try:
        webpush(
            subscription_info={
                "endpoint": sub["endpoint"],
                "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
            },
            data=json.dumps(payload),
            vapid_private_key=VAPID_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
            ttl=86400,
        )
        return True
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        if status in (404, 410):
            return False  # gone — caller should delete
        raise


def send_to_subs(subs, payload, on_dead=None):
    """Send payload to a list of subscription records. Returns count delivered."""
    sent = 0
    for sub in subs:
        sid = sub["sk"].split("#", 1)[1]
        try:
            if send_one(sub, payload):
                sent += 1
            elif on_dead:
                on_dead(sid)
        except Exception as e:  # noqa: BLE001
            print(f"push error for {sid}: {e}")
    return sent
