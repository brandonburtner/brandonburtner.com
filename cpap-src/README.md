# CPAP Reminders

A CPAP-maintenance reminder PWA hosted at **https://brandonburtner.com/cpap**.

- **Frontend:** React + Vite, built to the sibling `/cpap` folder (served by GitHub Pages).
- **Auth:** Google Identity Services (ID tokens verified server-side).
- **Backend:** AWS — DynamoDB + two Python Lambdas behind an HTTP API Gateway.
- **Notifications:** Browser Web Push (VAPID), sent from AWS on an hourly schedule.

## Layout

```
cpap-src/           source (this folder)
  src/              React app
  public/           service worker, manifest, icons
  backend/          AWS Lambda code + deploy scripts
../cpap/            BUILT output that GitHub Pages actually serves
```

## Frontend: build & deploy

Requires Node 20+.

```bash
cd cpap-src
npm install
npm run build            # outputs to cpap-src/dist
rm -rf ../cpap && cp -R dist/. ../cpap && cp ../cpap/index.html ../cpap/404.html
git add cpap cpap-src && git commit -m "Update CPAP app" && git push
```

Public config lives in `src/config.js` (API base URL, Google client ID, VAPID
public key — all non-secret). Local UI preview without a real login:
`npm run dev` then open `http://localhost:5173/cpap/?mock=1`.

## Backend (AWS)

All resources live in `us-east-1`:

| Resource | Name | Purpose |
|---|---|---|
| DynamoDB table | `cpap-data` | Per-user items, notification rules, push subs (single-table, pk=userId, sk=type) |
| Lambda | `cpap-api` | REST API (via HTTP API Gateway `cpap-http-api`); verifies Google ID tokens |
| Lambda | `cpap-notifier` | Hourly scan → sends Web Push for due/overdue items |
| Scheduler | `cpap-notifier-hourly` | `rate(1 hour)` trigger for the notifier |
| IAM roles | `cpap-lambda-role`, `cpap-scheduler-role` | Execution + invoke permissions |

> Note: the org blocks public Lambda **Function URLs**, so the API is fronted by
> **API Gateway** (a public HTTP API) instead.

### Redeploy the backend

```bash
cd cpap-src/backend
python3 -m venv env && ./env/bin/pip install boto3 pywebpush cryptography google-auth requests Pillow
# VAPID keys already generated; keep vapid_private.pem OUT of git (it is a secret).
bash package.sh              # builds Linux Lambda zips (api.zip, notifier.zip)
./env/bin/python deploy.py   # creates/updates table, roles, lambdas, schedule
./env/bin/python deploy_apigw.py   # ensures the HTTP API is in place
```

`deploy.py` embeds the Google client ID and VAPID **public** key. The VAPID
**private** key is read from `vapid_private.pem` (regenerate with `gen_vapid.py`
if lost, then re-run `deploy.py` and update `VAPID_PUBLIC_KEY` in `src/config.js`).

## Notification rules

Rules are evaluated per item by the notifier. Each rule has an offset relative to
an item's due time, an optional repeat interval (while overdue), and a scope
(all items / a category / one item). Two defaults are seeded on first login:

1. **When an item becomes due** — fires once at the due moment.
2. **Daily reminder while overdue** — first fires 24h after due, then every 24h
   until the item is marked done.
