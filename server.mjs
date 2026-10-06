import {addFigures} from './figures-update.mjs';
import {addRoundArt} from './round-art-update.mjs';
import {addBouquets} from './bouquets-update.mjs';
import {addStudioBatch} from './studio-batch-update.mjs';
import {orderPricing} from './pricing.mjs';
import {addKeychains} from './keychains-update.mjs';
import http from "node:http";
import { openDatabase } from "./database.mjs";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { products as seed } from "./seed.mjs";
import { extendCatalogue } from "./catalogue-update.mjs";
export async function createApp({
  dataDir = process.env.DATA_DIR || "data",
  production = process.env.NODE_ENV === "production" || !!process.env.VERCEL,
  notifications = true,
} = {}) {
  const db = openDatabase(dataDir);
  await db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,image TEXT NOT NULL,source TEXT NOT NULL,price INTEGER,currency TEXT,active INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,reference TEXT UNIQUE NOT NULL,created TEXT NOT NULL,status TEXT NOT NULL,customer TEXT NOT NULL,items TEXT NOT NULL,idempotency_key TEXT UNIQUE NOT NULL,payload_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS notifications(order_id TEXT PRIMARY KEY REFERENCES orders(id),status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,last_attempt TEXT,error TEXT);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,expires INTEGER NOT NULL,csrf TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS uploads(path TEXT PRIMARY KEY,content_type TEXT NOT NULL,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS keychain_prices(product_id TEXT PRIMARY KEY REFERENCES products(id),pair_price INTEGER);
 CREATE TABLE IF NOT EXISTS payment_reports(order_id TEXT PRIMARY KEY REFERENCES orders(id),transaction_id TEXT UNIQUE NOT NULL,amount INTEGER NOT NULL,status TEXT NOT NULL,updated TEXT NOT NULL);`);
  if (!(await db.prepare("SELECT 1 FROM metadata WHERE key='seeded'").get())) {
    const insert = db.prepare(
      "INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,?,?,?,1,?)",
    );
    for (const p of seed)
      await insert.run(
        p.id,
        p.name,
        p.category,
        p.description,
        p.image,
        p.source,
        p.price,
        p.currency,
        new Date().toISOString(),
      );
    await db
      .prepare("INSERT OR IGNORE INTO metadata VALUES(?,?)")
      .run("seeded", "1");
  }
  await extendCatalogue(db);
  await addKeychains(db);
  await addStudioBatch(db);
  await addBouquets(db);
  await addRoundArt(db);
  await addFigures(db);
  const withPair = async p => ({...p,pair_price:(await db.prepare("SELECT pair_price FROM keychain_prices WHERE product_id=?").get(p.id))?.pair_price ?? null});
  const withImages = async (p) => ({
    ...await withPair(p),
    images: [
      { image: p.image, source: p.source, alt: p.name + " by siaa" },
      ...(await db
        .prepare(
          "SELECT image,source,alt FROM product_images WHERE product_id=? AND image!=? ORDER BY rowid",
        )
        .all(p.id, p.image)),
    ],
  });
  const limits = new Map();
  const publicDir = resolve("public");
  function limit(key, max) {
    const now = Date.now();
    let x = limits.get(key);
    if (!x || x.until < now) x = { count: 0, until: now + 15 * 60e3 };
    x.count++;
    limits.set(key, x);
    if (limits.size > 10000)
      for (const [k, v] of limits) if (v.until < now) limits.delete(k);
    return x.count <= max;
  }
  function json(res, status, data, headers = {}) {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    });
    res.end(JSON.stringify(data));
  }
  function fail(message, status = 400) {
    throw Object.assign(Error(message), { status });
  }
  async function body(req, max = 120000) {
    let size = 0,
      parts = [];
    for await (const p of req) {
      size += p.length;
      if (size > max) fail("Request is too large.", 413);
      parts.push(p);
    }
    try {
      const value = JSON.parse(Buffer.concat(parts).toString());
      if (!value || typeof value !== "object" || Array.isArray(value))
        fail("Invalid JSON request.");
      return value;
    } catch {
      fail("Invalid JSON request.");
    }
  }
  function str(value, name, max, required = true) {
    if (
      typeof value !== "string" ||
      value.length > max ||
      (required && !value.trim())
    )
      fail(`Please enter a valid ${name}.`);
    return value.trim();
  }
  const hash = (s) => createHash("sha256").update(s).digest("hex");
  async function auth(req, write = false) {
    const raw = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("siaa_session="))
      ?.slice(13);
    const session =
      raw &&
      (await db
        .prepare("SELECT * FROM sessions WHERE hash=? AND expires>?")
        .get(hash(raw), Date.now()));
    if (!session) fail("Please sign in to the studio.", 401);
    if (write && req.headers["x-csrf-token"] !== session.csrf)
      fail("Your session needs refreshing. Please sign in again.", 403);
    return session;
  }
  function checkOrigin(req) {
    const origin = req.headers.origin;
    if (origin) {
      const expected =
        process.env.PUBLIC_ORIGIN ||
        `${production ? "https" : "http"}://${req.headers.host}`;
      if (origin !== expected) fail("Request origin is not allowed.", 403);
    } else if (production) fail("Request origin is required.", 403);
  }
  async function productInput(b) {
    const name = str(b.name, "product name", 150),
      category = str(b.category, "category", 30);
    if (!["Bouquets", "Drawings", "Crafts", "Keychains", "Flower Pots"].includes(category))
      fail("Choose a supported category.");
    const description = str(b.description, "description", 3000);
    const image = str(b.image, "image", 300);
    if (
      !/^\/(assets|uploads)\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(
        image,
      ) ||
      (!existsSync(resolve(publicDir, "." + image)) &&
        !(await db.prepare("SELECT 1 FROM uploads WHERE path=?").get(image)))
    )
      fail("Upload a valid product image.");
    const source = str(b.source, "Instagram source", 300, false);
    if (source && !/^https:\/\/www\.instagram\.com\//.test(source))
      fail("Source must be an Instagram link.");
    const price = b.price === null ? null : Number(b.price);
    if (
      price !== null &&
      (!Number.isSafeInteger(price) || price < 1 || price > 100000000)
    )
      fail("Price must be a positive amount.");
    const pairPrice = b.category === 'Keychains' ? b.pair_price ?? null : null;
    if (pairPrice !== null && (!Number.isSafeInteger(pairPrice) || pairPrice < 1 || pairPrice > 100000000)) fail("Pair price must be a positive amount.");
    let currency = null;
    if (price !== null || pairPrice !== null) {
      currency = str(b.currency, "three-letter currency code", 3).toUpperCase();
      try {
        new Intl.NumberFormat("en", { style: "currency", currency });
      } catch {
        fail("Enter a valid currency code.");
      }
      if (!/^[A-Z]{3}$/.test(currency)) fail("Enter a valid currency code.");
    }
    return [
      name,
      category,
      description,
      image,
      source,
      price,
      currency,
      b.active === false ? 0 : 1,
      new Date().toISOString(),
    ];
  }
  async function galleryInput(b) {
    if (b.images === undefined) return null;
    if (!Array.isArray(b.images) || b.images.length < 1 || b.images.length > 12) fail("Choose between 1 and 12 photos.");
    const seen=new Set();
    for (const photo of b.images) {
      if (!photo || typeof photo.image !== 'string' || !/^\/(assets|uploads)\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(photo.image) || (!existsSync(resolve(publicDir,'.'+photo.image)) && !(await db.prepare('SELECT 1 FROM uploads WHERE path=?').get(photo.image)))) fail("Choose valid uploaded photos.");
      if(seen.has(photo.image)) fail("Remove duplicate photos."); seen.add(photo.image);
      str(photo.alt??'',"photo description",300,false);
      if(photo.source && !/^https:\/\/www\.instagram\.com\//.test(photo.source)) fail("Invalid photo source.");
    }
    if(b.images[0].image!==b.image) fail("The first photo must be the cover photo.");
    return b.images;
  }
  const galleryStatements=(id,photos)=>photos===null?[]:[
    {sql:'DELETE FROM product_images WHERE product_id=?',args:[id]},
    ...photos.map(p=>({sql:'INSERT INTO product_images VALUES(?,?,?,?)',args:[id,p.image,p.source||'',p.alt||'']}))
  ];
  async function notifyOwner() {
    if (
      !process.env.RESEND_API_KEY ||
      !process.env.OWNER_EMAIL ||
      !process.env.MAIL_FROM
    )
      return;
    const pending = await db
      .prepare(
        "SELECT n.*,o.reference,o.customer,o.items FROM notifications n JOIN orders o ON n.order_id=o.id WHERE n.status='pending' AND n.attempts<5 AND (n.last_attempt IS NULL OR n.last_attempt<?) LIMIT 10",
      )
      .all(new Date(Date.now() - 60000).toISOString());
    for (const n of pending) {
      await db
        .prepare(
          "UPDATE notifications SET attempts=attempts+1,last_attempt=? WHERE order_id=?",
        )
        .run(new Date().toISOString(), n.order_id);
      try {
        const customer = JSON.parse(n.customer);
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `order-${n.order_id}`,
          },
          body: JSON.stringify({
            from: process.env.MAIL_FROM,
            to: [process.env.OWNER_EMAIL],
            subject: `New studio request ${n.reference}`,
            text: `New request ${n.reference}\n\n${JSON.stringify(customer, null, 2)}\n\nItems:\n${JSON.stringify(JSON.parse(n.items), null, 2)}\n\nOpen your protected studio dashboard to manage this request.`,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw Error("Email provider returned " + r.status);
        await db
          .prepare(
            "UPDATE notifications SET status='sent',error=NULL WHERE order_id=?",
          )
          .run(n.order_id);
      } catch (e) {
        await db
          .prepare("UPDATE notifications SET error=? WHERE order_id=?")
          .run(e.message.slice(0, 200), n.order_id);
      }
    }
  }
  let notifying = false;
  const dispatch = async () => {
    if (notifying || !notifications) return;
    notifying = true;
    try {
      await notifyOwner();
    } catch (e) {
      console.error("Notification dispatch failed:", e.message);
    } finally {
      notifying = false;
    }
  };
  const timer = setInterval(dispatch, 60000);
  timer.unref();
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    if (production)
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    try {
      const url = new URL(req.url, "http://localhost"),
        path = url.pathname,
        method = req.method;
      const ip = process.env.VERCEL
        ? req.headers["x-forwarded-for"]?.split(",")[0]
        : req.socket.remoteAddress;
      if (method !== "GET" && method !== "HEAD") checkOrigin(req);
      if (path === "/api/health" && method === "GET")
        return json(res, 200, { ok: true });
      if (path === "/api/products" && method === "GET")
        return json(
          res,
          200,
          await Promise.all(
            (
              await db
                .prepare("SELECT * FROM products WHERE active=1 ORDER BY rowid")
                .all()
            ).map(withImages),
          ),
        );
      if (path === "/api/orders/payment-details" && method === "POST") {
        if (!limit("details:" + ip, 30)) fail("Too many requests. Try again later.",429);
        const b = await body(req);
        const order = await db.prepare("SELECT reference,items,status FROM orders WHERE reference=? AND idempotency_key=?").get(str(b.reference,"reference",40),str(b.accessKey,"access key",100));
        if (!order) fail("Order access could not be verified.",403);
        if (order.status === "Cancelled") fail("This order has been cancelled.",409);
        const items=JSON.parse(order.items);
        return json(res,200,{reference:order.reference,items,pricing:orderPricing(items)});
      }
      if (path === "/api/payments/report" && method === "POST") {
        if (!limit("payment:" + ip, 15)) fail("Too many requests. Please try again later.", 429);
        const b = await body(req);
        const reference = str(b.reference, "order reference", 40);
        const accessKey = str(b.accessKey, "order access key", 100);
        const order = await db.prepare("SELECT id,status,items FROM orders WHERE reference=? AND idempotency_key=?").get(reference,accessKey);
        if (!order) fail("Order access could not be verified. Use the browser where you placed the request.",403);
        if (order.status === "Cancelled") fail("This request has been cancelled. Please contact the studio.",409);
        const transactionId = str(b.transactionId,"12-digit UPI reference",12);
        if (!/^\d{12}$/.test(transactionId)) fail("Enter the 12-digit UPI reference from your payment app.");
        if (!Number.isSafeInteger(b.amount) || b.amount < 100 || b.amount > 100000000) fail("Enter a valid amount in INR.");
        const pricing = orderPricing(JSON.parse(order.items));
        if (!pricing.quoteRequired && ( !Number.isSafeInteger(b.deliveryAmount) || b.deliveryAmount < 0 || b.amount !== pricing.total + b.deliveryAmount)) fail("Payment amount must match the saved product total plus the agreed delivery charge.");
        const prior = await db.prepare("SELECT * FROM payment_reports WHERE order_id=?").get(order.id);
        if (prior) {
          if (prior.transaction_id === transactionId && prior.amount === b.amount) return json(res,200,{status:prior.status});
          fail("Payment details have already been submitted. Contact the studio to correct them.",409);
        }
        try {
          await db.prepare("INSERT INTO payment_reports VALUES(?,?,?,?,?)").run(order.id,transactionId,b.amount,"Awaiting verification",new Date().toISOString());
        } catch (e) {
          if (String(e.message).includes("UNIQUE")) fail("This payment reference has already been submitted.",409);
          throw e;
        }
        return json(res,201,{status:"Awaiting verification"});
      }
      if (path === "/api/orders" && method === "POST") {
        if (!limit("order:" + ip, 15))
          fail("Too many requests. Please try again in 15 minutes.", 429);
        const b = await body(req);
        const c = b.customer;
        if (!c || c.consent !== "on")
          fail("Please agree to the order request terms.");
        const customer = {};
        for (const [k, max] of Object.entries({
          name: 100,
          email: 254,
          phone: 30,
          instagram: 60,
          address: 1000,
          city: 100,
          region: 100,
          postal: 20,
          country: 100,
          notes: 2000,
        }))
          customer[k] = str(
            c[k] ?? "",
            k,
            max,
            !["phone", "instagram", "notes"].includes(k),
          );
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
          fail("Enter a valid email address.");
        const key = str(b.idempotencyKey, "request key", 100);
        if (!/^[a-zA-Z0-9-]{20,100}$/.test(key)) fail("Invalid request key.");
        if (
          !Array.isArray(b.items) ||
          b.items.length < 1 ||
          b.items.length > 20
        )
          fail("Add between 1 and 20 items.");
        const payloadHash = hash(JSON.stringify({ customer, items: b.items }));
        const prior = await db
          .prepare(
            "SELECT reference,payload_hash,items FROM orders WHERE idempotency_key=?",
          )
          .get(key);
        if (prior) {
          if (prior.payload_hash !== payloadHash)
            fail("This request key was already used. Reopen checkout.", 409);
          return json(res, 200, { reference: prior.reference, items: JSON.parse(prior.items), pricing: orderPricing(JSON.parse(prior.items)) });
        }
        const items = await Promise.all(
          b.items.map(async (x) => {
            if (!x || typeof x.id !== "string") fail("Invalid item.");
            const p = await db
              .prepare("SELECT * FROM products WHERE id=? AND active=1")
              .get(x.id);
            if (!p)
              fail(
                "A piece is no longer available. Please refresh your bag.",
                409,
              );
            if (
              !Number.isInteger(x.quantity) ||
              x.quantity < 1 ||
              x.quantity > 20
            )
              fail("Quantity must be between 1 and 20.");
            const variant=x.variant ?? 'single';
            if (!['single','pair'].includes(variant) || (variant==='pair' && p.category!=='Keychains')) fail("Choose a valid product option.");
            const optionPrice=variant==='pair'?(await withPair(p)).pair_price:p.price;
            return {
              variant: p.category==='Keychains'?variant:'single',
              piecesPerUnit: variant==='pair'?2:1,
              productId: p.id,
              name: p.name,
              quantity: x.quantity,
              notes: str(x.notes ?? "", "personalisation", 2000, false),
              unitPrice: optionPrice,
              currency: p.currency,
            };
          }),
        );
        const id = randomUUID(),
          reference = "SIAA-" + randomBytes(5).toString("hex").toUpperCase();
        try {
          await db.batch([
            {
              sql: "INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)",
              args: [
                id,
                reference,
                new Date().toISOString(),
                "New request",
                JSON.stringify(customer),
                JSON.stringify(items),
                key,
                payloadHash,
              ],
            },
            {
              sql: "INSERT INTO notifications(order_id) VALUES(?)",
              args: [id],
            },
          ]);
        } catch (e) {
          const existing = await db
            .prepare(
              "SELECT reference,payload_hash FROM orders WHERE idempotency_key=?",
            )
            .get(key);
          if (!existing) throw e;
          if (existing.payload_hash !== payloadHash)
            fail("This request key was already used. Reopen checkout.", 409);
          return json(res, 200, { reference: existing.reference, items: JSON.parse(existing.items), pricing: orderPricing(JSON.parse(existing.items)) });
        }
        await dispatch();
        json(res, 201, { reference, items, pricing: orderPricing(items) });
        return;
      }
      if (path === "/api/admin/login" && method === "POST") {
        if (!limit("login:" + ip, 8))
          fail("Too many sign-in attempts. Please wait 15 minutes.", 429);
        const b = await body(req);
        let config;
        try {
          const owner = await db.prepare("SELECT value FROM metadata WHERE key='owner-credentials'").get();
          config = JSON.parse(
            process.env.ADMIN_CREDENTIALS ||
              owner?.value ||
              readFileSync(resolve(dataDir, "admin.json"), "utf8"),
          );
        } catch {
          fail(
            "Studio login has not been configured. Run the owner setup command on the server.",
            503,
          );
        }
        const email =
          typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
        const password =
          typeof b.password === "string" && b.password.length <= 200
            ? b.password
            : "";
        const actual = scryptSync(password, config.salt, 64),
          expected = Buffer.from(config.hash, "hex");
        if (!timingSafeEqual(actual, expected) || email !== config.email)
          fail("Email or password is incorrect.", 401);
        await db
          .prepare("DELETE FROM sessions WHERE expires<?")
          .run(Date.now());
        const token = randomBytes(32).toString("hex"),
          csrf = randomBytes(24).toString("hex");
        await db
          .prepare("INSERT INTO sessions VALUES(?,?,?)")
          .run(hash(token), Date.now() + 8 * 60 * 60e3, csrf);
        return json(
          res,
          200,
          { csrf },
          {
            "Set-Cookie": `siaa_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production ? "; Secure" : ""}`,
          },
        );
      }
      if (path.startsWith("/api/admin/")) {
        const session = await auth(req, method !== "GET");
        if (path === "/api/admin/session" && method === "GET")
          return json(res, 200, {
            csrf: session.csrf,
            emailNotifications: !!(
              process.env.RESEND_API_KEY &&
              process.env.OWNER_EMAIL &&
              process.env.MAIL_FROM
            ),
          });
        if (path === "/api/admin/logout" && method === "POST") {
          await db
            .prepare("DELETE FROM sessions WHERE hash=?")
            .run(session.hash);
          return json(
            res,
            200,
            { ok: true },
            {
              "Set-Cookie": `siaa_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? "; Secure" : ""}`,
            },
          );
        }
        if (path === "/api/admin/products" && method === "GET")
          return json(
            res,
            200,
            await Promise.all((await db.prepare("SELECT * FROM products ORDER BY rowid DESC").all()).map(withImages)),
          );
        if (path === "/api/admin/products" && method === "POST") {
          const b = await body(req), values = await productInput(b),
            id = randomUUID();
          const photos=await galleryInput(b);
          await db.batch([
            {sql:"INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?,?)",args:[id,...values]},
            {sql:"INSERT INTO keychain_prices VALUES(?,?)",args:[id,b.category==='Keychains'?b.pair_price??null:null]},
            ...galleryStatements(id,photos)
          ]);
          return json(res, 201, { id });
        }
        if (path.startsWith("/api/admin/products/") && method === "DELETE") {
          const id = path.split("/").pop();
          if (!(await db.prepare("SELECT id FROM products WHERE id=?").get(id))) fail("Product not found.",404);
          // Order items hold their own price/name snapshots; retain shared image files.
          await db.batch([
            {sql:"DELETE FROM keychain_prices WHERE product_id=?",args:[id]},
            {sql:"DELETE FROM product_images WHERE product_id=?",args:[id]},
            {sql:"DELETE FROM products WHERE id=?",args:[id]},
          ]);
          return json(res,200,{ok:true});
        }
        if (path.startsWith("/api/admin/products/") && method === "PUT") {
          const id = path.split("/").pop();
          const b=await body(req), values=await productInput(b), photos=await galleryInput(b);
          if (!(await db.prepare("SELECT id FROM products WHERE id=?").get(id))) fail("Product not found.",404);
          await db.batch([
            {sql:"UPDATE products SET name=?,category=?,description=?,image=?,source=?,price=?,currency=?,active=?,updated=? WHERE id=?",args:[...values,id]},
            {sql:"INSERT INTO keychain_prices VALUES(?,?) ON CONFLICT(product_id) DO UPDATE SET pair_price=excluded.pair_price",args:[id,b.category==='Keychains'?b.pair_price??null:null]},
            ...galleryStatements(id,photos)
          ]);
          return json(res, 200, { ok: true });
        }
        if (path === "/api/admin/upload" && method === "POST") {
          const b = await body(req, 1.5e6);
          if (
            typeof b.data !== "string" ||
            !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.data)
          )
            fail("Choose a PNG, JPEG or WebP image.");
          const [meta, base64] = b.data.split(","),
            buffer = Buffer.from(base64, "base64");
          if (buffer.length > 1e6) fail("Images must be smaller than 1 MB.");
          const jpg = buffer
              .subarray(0, 3)
              .equals(Buffer.from([255, 216, 255])),
            png = buffer
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
            webp =
              buffer.toString("ascii", 0, 4) === "RIFF" &&
              buffer.toString("ascii", 8, 12) === "WEBP";
          if (!jpg && !png && !webp)
            fail("This file is not a supported image.");
          const filename =
            randomUUID() + "." + (jpg ? "jpg" : png ? "png" : "webp");
          await db
            .prepare("INSERT INTO uploads VALUES(?,?,?)")
            .run(
              "/uploads/" + filename,
              jpg ? "image/jpeg" : png ? "image/png" : "image/webp",
              buffer.toString("base64"),
            );
          return json(res, 201, { image: "/uploads/" + filename });
        }
        if (path === "/api/admin/orders" && method === "GET")
          return json(
            res,
            200,
            (
              await db
                .prepare(
                  "SELECT o.*,n.status AS notification_status,n.error AS notification_error,p.transaction_id AS payment_reference,p.amount AS payment_amount,p.status AS payment_status FROM orders o LEFT JOIN notifications n ON o.id=n.order_id LEFT JOIN payment_reports p ON o.id=p.order_id ORDER BY created DESC LIMIT 500",
                )
                .all()
            ).map((o) => ({
              ...o,
              customer: JSON.parse(o.customer),
              items: JSON.parse(o.items),
              payload_hash: undefined,
              idempotency_key: undefined,
            })),
          );
        if (path.startsWith("/api/admin/payments/") && method === "PATCH") {
          const b=await body(req);
          if (!["Verified received","Not found","Awaiting verification"].includes(b.status)) fail("Invalid payment status.");
          const result=await db.prepare("UPDATE payment_reports SET status=?,updated=? WHERE order_id=?").run(b.status,new Date().toISOString(),path.split("/").pop());
          if(!result.changes) fail("Payment report not found.",404);
          return json(res,200,{ok:true});
        }
        if (path.startsWith("/api/admin/orders/") && method === "PATCH") {
          const b = await body(req);
          if (
            ![
              "New request",
              "Awaiting confirmation",
              "Confirmed",
              "In progress",
              "Ready to dispatch",
              "Dispatched",
              "Completed",
              "Cancelled",
            ].includes(b.status)
          )
            fail("Invalid order status.");
          const r = await db
            .prepare("UPDATE orders SET status=? WHERE id=?")
            .run(b.status, path.split("/").pop());
          if (!r.changes) fail("Order not found.", 404);
          return json(res, 200, { ok: true });
        }
        fail("Not found.", 404);
      }
      if (path.startsWith("/api/")) fail("Not found.", 404);
      if (method !== "GET" && method !== "HEAD")
        fail("Method not allowed.", 405);
      if (path.startsWith("/uploads/")) {
        const upload = await db
          .prepare("SELECT * FROM uploads WHERE path=?")
          .get(path);
        if (upload) {
          res.writeHead(200, {
            "Content-Type": upload.content_type,
            "Cache-Control": "public,max-age=31536000,immutable",
          });
          res.end(
            method === "HEAD" ? undefined : Buffer.from(upload.data, "base64"),
          );
          return;
        }
      }
      const target =
        path === "/"
          ? "/index.html"
          : path === "/admin"
            ? "/admin.html"
            : decodeURIComponent(path);
      const file = resolve(publicDir, "." + target);
      if (
        !file.startsWith(publicDir + "\\") &&
        !file.startsWith(publicDir + "/")
      )
        fail("Not found.", 404);
      const ext = extname(file);
      const types = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css",
        ".js": "text/javascript",
        ".svg": "image/svg+xml",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
      };
      if (!types[ext] || !existsSync(file)) fail("Not found.", 404);
      res.writeHead(200, {
        "Content-Type": types[ext],
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=300",
      });
      res.end(method === "HEAD" ? undefined : readFileSync(file));
    } catch (e) {
      json(res, e.status || 500, {
        error: e.status
          ? e.message
          : "The studio could not complete this request. Please try again.",
      });
      if (!e.status) console.error("Request failed:", e.message);
    }
  });
  server.on("close", () => {
    clearInterval(timer);
    db.close();
  });
  return { server, db };
}
let deployedApp;
export default async function handler(req, res) {
  deployedApp ||= createApp().catch((error) => { deployedApp = undefined; throw error; });
  const app = await deployedApp;
  app.server.emit("request", req, res);
}
if (!process.env.VERCEL && process.argv[1] && resolve(process.argv[1]) === resolve("server.mjs")) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "127.0.0.1";
  (await createApp()).server.listen(port, host, () =>
    console.log(`siaa studio ready at http://${host}:${port}`),
  );
}
