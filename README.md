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

This checkout is running locally. It has **not** been published to a public host. The available Sites skill referenced setup/hosting files that were absent from the installed plugin, so no Sites deployment was attempted with an invented configuration.

Use a Node.js 24 host or the supplied Dockerfile, with HTTPS at a trusted reverse proxy. Set `NODE_ENV=production`, `HOST=0.0.0.0`, and `PUBLIC_ORIGIN` to the exact HTTPS site origin. Production cookies require HTTPS. Expose only the proxy, not the raw Node port. Preserve `data/` and `public/uploads/` on persistent storage. Do not deploy to ephemeral/serverless local disk.

Example container workflow:

```sh
docker build -t siaa-store .
docker run --rm -it -v siaa-data:/app/data siaa-store npm run setup-admin
docker run -d --name siaa-store --env-file .env.production -p 127.0.0.1:3000:3000 -v siaa-data:/app/data -v siaa-uploads:/app/public/uploads siaa-store
```

Back up the SQLite database and uploads, restrict server filesystem access, and confirm the owner's policies and notification settings before accepting public customer requests. For deletion requests, the operator must remove the corresponding order data and notification record using a trusted database administration process; the dashboard does not currently offer deletion.

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

Remaining launch inputs: approved catalogue/prices, owner login setup, notification recipient and verified email sender, delivery/returns policies, and hosting/domain configuration.


