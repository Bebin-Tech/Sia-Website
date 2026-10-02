# siaa • Sketch & Craft

A React storefront and React owner dashboard with a Node.js backend and a persistent SQLite database. No mock checkout, no invented product prices, and no default admin password.

## Run

Requires Node.js 24 or newer.

```powershell
npm ci
npm run build
npm run setup-admin
npm start
```

Store: http://127.0.0.1:3000 — Owner dashboard: http://127.0.0.1:3000/admin

The owner setup command asks for an email and a hidden password (minimum 12 characters). It stores a salted scrypt hash, not the password. Re-running setup revokes existing sessions. There is deliberately no browser-accessible first-user registration endpoint.

Run `npm run build` after changing `src/`. The Node server serves the generated React bundles in `public/build/`.

## What works

- Responsive catalogue, category filters, original Instagram images and product details.
- Expanded Instagram collection: 13 verified photographs across 9 pieces (3 bouquet views, 5 drawing photos, 5 craft photos).
- Swipeable product galleries, thumbnail navigation, keyboard photo controls and tap-to-zoom.
- Category photo cards, collection sorting, hover previews and reduced-motion-aware transitions.
- Local-device shopping bag, quantities and personalisation notes.
- Validated order-request checkout with contact and delivery information.
- Server-authoritative product snapshots and prices; idempotent request submission.
- SQLite transactions persist requests and notification jobs together.
- Authenticated dashboard displays complete order details and refreshes every 30 seconds.
- Product creation/editing, image uploads, optional prices and currency, and publish/hide controls.
- Order statuses from New request through Completed or Cancelled.
- HttpOnly SameSite sessions, CSRF and origin checks, login/order throttling, prepared SQL queries, security headers, and constrained image uploads.
- Optional owner email notifications with a durable outbox and provider idempotency keys.

## Verified content and commercial limits

Research was performed on 2 October 2026 using the public Instagram profile and posts. See `research.json` for source links and observations. Product names on this website are descriptive labels, not claimed official catalogue names.

No prices, stock counts, shipping rates, delivery areas, production times, business phone or business email were verified. All initial pieces are therefore offered as **requests requiring studio confirmation**, not as guaranteed available merchandise. Customisation fields collect preferences; they do not promise that every request can be fulfilled. No payment gateway is configured, and the site takes no payments.

The owner can enter approved prices and currency in the dashboard. Even priced items remain request-based until the business supplies its shipping and payment arrangements. The source thumbnails are original Instagram media, stored locally to avoid expiring CDN links. Higher-resolution owner uploads can replace them in the dashboard.

## Email notifications

Copy `.env.example` to `.env`. Configure `OWNER_EMAIL`, `MAIL_FROM` (a verified sender), and `RESEND_API_KEY` to enable transactional new-order alerts via Resend's HTTPS API. Never put secrets into React source or Git.

Without those settings, requests still arrive in the secure dashboard and email jobs remain pending. With settings present, the server retries pending delivery up to five times at intervals of at least one minute. Delivery state and failures appear with each order. Restart the server after changing environment settings. The application does not send customer confirmation emails or claim email delivery unless the provider accepts it.

## Deploy

Deploy this repository to Vercel with Node.js 24 and the included configuration. The root Node server serves the React build and API. Connect the dedicated Turso Starter database to the project to supply TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. Products, orders, sessions and uploaded images persist in Turso; original Instagram assets are bundled with deployments. Uploads are limited to 1 MB each.

For owner login, run npm run setup-admin locally, then copy the generated data/admin.json content into the sensitive Vercel environment variable ADMIN_CREDENTIALS. Never commit that file or use a default password. Redeploy after setting credentials. Credentials are salted scrypt hashes. When rotating credentials, also revoke sessions in the database.

Set NODE_ENV=production. PUBLIC_ORIGIN can be set to the exact production HTTPS origin; otherwise same-origin checks use the request host. Optional Resend settings enable owner email alerts. Notification delivery is awaited during checkout on Vercel; pending jobs are retried on subsequent order requests. For automatic scheduled retries, configure a separate scheduler. The persistent admin order queue remains available regardless of email configuration.

For local or container hosting, omit Turso settings to use data/store.sqlite. Preserve the data directory. New uploaded image bytes are stored in the database. Back up the database and restrict access to credentials. The supplied Dockerfile remains supported.

## Checks

`npm test` exercises catalogue reads, invalid checkout inputs, cross-origin rejection, order persistence after server restart, duplicate submission protection, protected admin endpoints, CSRF checks, price updates, hiding products, invalid uploads, status changes, and logout revocation. Tests use isolated SQLite databases under ignored `data/test-*` with email delivery explicitly disabled.

## Structure

- `src/store.jsx`: React shopping experience
- `src/admin.jsx`: React owner dashboard
- `src/shared.jsx`: shared API and accessible dialog/form components
- `server.mjs`: HTTP API, authentication, database and notification worker
- `seed.mjs`: verified initial collection
- `catalogue-update.mjs`: additive, one-time gallery migration that preserves existing owner edits
- `src/gallery.jsx`: collection cards, galleries and scroll reveal
- `public/refinements.css`: responsive design and accessible motion refinements
- `public/assets/`: original Instagram media
- `scripts/setup-admin.mjs`: local owner provisioning
- `test/store.test.mjs`: isolated backend integration checks

Remaining launch inputs: approved catalogue/prices, owner login setup, notification recipient and verified email sender, delivery/returns policies, and an optional custom domain.


