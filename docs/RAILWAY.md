# One Railway deployment

One service runs the entire platform; stores do not create Railway services. Use Node.js 24 and the included Dockerfile/railway.json.

1. Create a Railway service from the [VÉRA GitHub repository](https://github.com/202402972-stack/vera), or run `railway up` from an authenticated Railway CLI session. Keep credentials in Railway Variables and runtime data on the private persistent volume.
2. Add **one persistent volume mounted at `/data`**. Set `DATA_DIR=/data`. Database schema creation runs at application startup, when the volume is mounted; do not move it to a build/pre-deploy command.
3. Generate a public Railway domain or connect your platform domain. Set `PUBLIC_URL=https://your-domain` (no path or trailing slash), `NODE_ENV=production`, `OWNER_EMAILS=your-verified-google-email`, and `SUPPORT_EMAIL=your-support-email`.
4. Configure the Google credentials and exact callback in [INTEGRATIONS.md](INTEGRATIONS.md). Configure Paymob when the merchant account and recurring integrations are approved. Secret values belong in Railway Variables, never public Vite variables.
5. Deploy. The service starts with `npm start`; `/api/health` returns 200 when SQLite can be queried. Railway provides `PORT`; the server binds the service interface automatically.
6. Sign in with your owner Google account and open `/owner`. Check provider configuration indicators, support email, displayed plan price, template preview, create a store and place a test COD order. Do not accept live subscriptions until the live-provider checks pass.

The HTTPS domain must match Google callback registration and `PUBLIC_URL`. Changing domains requires updating both Google and Paymob callbacks. Requests use same-origin cookies. No customer dashboard password is put in environment variables; each store has its own salted hash.

## Data and backups

The volume contains `store.sqlite` (including WAL files), `uploads/`, and `.encryption-key`. The key decrypts Telegram credentials and pending payment URLs. **Keep the key with the database backup.** Copying only the SQLite main file while WAL writes are active is not a consistent backup.

Use the existing online backup script:

```bash
node scripts/backup.js /tmp/vera-backup-2026-10-07
```

Download the complete output to private storage outside the service. Enable Railway volume backups as well. To restore, stop application writes and replace the complete data directory from a validated backup; restore the matching encryption key and uploads, then restart and check tenant/store access. Test restoration before launch.

## Capacity

Keep `numReplicas: 1`. This release is a single writer with a persistent local SQLite volume. It provides no multi-region replication or zero-downtime volume migration. For larger multi-instance operation, migrate the repository/storage layer to PostgreSQL and uploads to object storage before adding replicas; tenant context and authorization remain required.

## Existing standalone store

A pre-existing boutique database is not deleted. Its original unprefixed tables remain preserved. To make that existing merchant data available under a platform customer account, sign in once, back up the volume, and run the import utility described in [ARCHITECTURE.md](ARCHITECTURE.md). A fresh installation creates empty platform accounts and the public read-only Atelier preview.
