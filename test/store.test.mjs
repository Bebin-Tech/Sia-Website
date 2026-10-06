import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import { createApp } from "../server.mjs";

test("persistent order lifecycle, authentication, validation and product management", async () => {
  const dir = mkdtempSync(resolve("data", "test-"));
  const salt = randomBytes(32).toString("hex");
  const password = randomBytes(24).toString("hex");
  writeFileSync(
    resolve(dir, "admin.json"),
    JSON.stringify({
      email: "test@example.invalid",
      salt,
      hash: scryptSync(password, salt, 64).toString("hex"),
    }),
  );
  let app = await createApp({ dataDir: dir, notifications: false });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  let base = "http://127.0.0.1:" + app.server.address().port;
  let cookie = "",
    csrf = "";
  async function call(
    path,
    { method = "GET", body, authenticated = false, origin = base } = {},
  ) {
    const headers = { Origin: origin, "Content-Type": "application/json" };
    if (authenticated) {
      headers.Cookie = cookie;
      headers["X-CSRF-Token"] = csrf;
    }
    const r = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  try {
    const catalogue = await call("/api/products");
    assert.equal(catalogue.status, 200);
    assert.equal(catalogue.data.length, 35);
    assert.equal(catalogue.data[0].price, null);
    assert.equal(catalogue.data[0].images.length, 3);
    assert.equal(
      catalogue.data.reduce((n, p) => n + p.images.length, 0),
      41,
    );
    assert.equal((await call("/api/admin/orders")).status, 401);
    assert.equal(
      (await call("/api/admin/products", { method: "POST", body: {} })).status,
      401,
    );
    const customer = {
      name: "Test Customer",
      email: "buyer@example.invalid",
      phone: "",
      instagram: "",
      address: "Test address",
      city: "Test city",
      region: "Test region",
      postal: "00000",
      country: "Test country",
      notes: "Do not fulfil — automated test",
      consent: "on",
    };
    const body = {
      customer,
      items: [{ id: "blue-bouquet", quantity: 2, notes: "Blue ribbon" }],
      idempotencyKey: crypto.randomUUID(),
    };
    assert.equal(
      (
        await call("/api/orders", {
          method: "POST",
          body: { ...body, customer: { ...customer, email: "bad" } },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/api/orders", {
          method: "POST",
          body: { ...body, items: [{ id: "blue-bouquet", quantity: -1 }] },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/api/orders", {
          method: "POST",
          body,
          origin: "https://evil.example",
        })
      ).status,
      403,
    );
    const order = await call("/api/orders", { method: "POST", body });
    assert.equal(order.status, 201);
    assert.match(order.data.reference, /^SIAA-/);
    const duplicate = await call("/api/orders", { method: "POST", body });
    assert.equal(duplicate.data.reference, order.data.reference);
    assert.equal(
      (await app.db.prepare("SELECT count(*) AS n FROM orders").get()).n,
      1,
    );
    assert.equal(
      (
        await call("/api/orders", {
          method: "POST",
          body: {
            ...body,
            customer: { ...customer, name: "Different customer" },
          },
        })
      ).status,
      409,
    );
    const login = await call("/api/admin/login", {
      method: "POST",
      body: { email: "test@example.invalid", password },
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";")[0];
    csrf = login.data.csrf;
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    assert.match(login.headers.get("set-cookie"), /SameSite=Strict/);
    const orders = await call("/api/admin/orders", { authenticated: true });
    assert.equal(orders.data[0].customer.address, "Test address");
    assert.equal(orders.data[0].items[0].quantity, 2);
    assert.equal(orders.data[0].items[0].unitPrice, null);
    const id = orders.data[0].id;
    const payment={reference:order.data.reference,accessKey:body.idempotencyKey,amount:25000,transactionId:"123456789012"};
    assert.equal((await call("/api/payments/report",{method:"POST",body:{...payment,accessKey:crypto.randomUUID()}})).status,403);
    assert.equal((await call("/api/payments/report",{method:"POST",body:{...payment,amount:-1}})).status,400);
    assert.equal((await call("/api/payments/report",{method:"POST",body:{...payment,transactionId:"invalid"}})).status,400);
    const reported=await call("/api/payments/report",{method:"POST",body:payment});
    assert.equal(reported.status,201);
    assert.equal(reported.data.status,"Awaiting verification");
    assert.equal((await call("/api/payments/report",{method:"POST",body:payment})).status,200);
    assert.equal((await call("/api/payments/report",{method:"POST",body:{...payment,amount:50000}})).status,409);
    assert.equal((await call("/api/admin/payments/"+id,{method:"PATCH",body:{status:"Verified received"}})).status,401);
    assert.equal((await call("/api/admin/payments/"+id,{method:"PATCH",authenticated:true,body:{status:"Verified received"}})).status,200);
    const paid=await call("/api/admin/orders",{authenticated:true});
    assert.equal(paid.data[0].payment_status,"Verified received");
    assert.equal(paid.data[0].payment_amount,25000);
    const badCsrf = await fetch(base + "/api/admin/orders/" + id, {
      method: "PATCH",
      headers: {
        Cookie: cookie,
        Origin: base,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "Confirmed" }),
    });
    assert.equal(badCsrf.status, 403);
    assert.equal(
      (
        await call("/api/admin/orders/" + id, {
          method: "PATCH",
          authenticated: true,
          body: { status: "Confirmed" },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/api/admin/orders/" + id, {
          method: "PATCH",
          authenticated: true,
          body: { status: "invalid" },
        })
      ).status,
      400,
    );
    const p = catalogue.data[0];
    assert.equal(
      (
        await call("/api/admin/products/" + p.id, {
          method: "PUT",
          authenticated: true,
          body: { ...p, price: 125000, currency: "INR", active: true },
        })
      ).status,
      200,
    );
    assert.equal((await call("/api/products")).data[0].price, 125000);
    assert.equal(
      (
        await call("/api/admin/upload", {
          method: "POST",
          authenticated: true,
          body: { data: "data:image/png;base64,PHNjcmlwdD4=" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/api/admin/products/" + p.id, {
          method: "PUT",
          authenticated: true,
          body: { ...p, image: "https://example.com/a.jpg" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/api/admin/products/" + p.id, {
          method: "PUT",
          authenticated: true,
          body: { ...p, active: false },
        })
      ).status,
      200,
    );
    assert.equal((await call("/api/products")).data.length, 34);
    assert.equal(
      (
        await call("/api/orders", {
          method: "POST",
          body: { ...body, idempotencyKey: crypto.randomUUID() },
        })
      ).status,
      409,
    );
    const keychain=catalogue.data.find(p=>p.id==='cherry-keychain');
    assert.equal((await call('/api/admin/products/'+keychain.id,{method:'PUT',authenticated:true,body:{...keychain,pair_price:8000}})).status,200);
    assert.equal((await call('/api/products')).data.find(p=>p.id===keychain.id).pair_price,8000);
    assert.equal((await call('/api/admin/products/'+keychain.id,{method:'PUT',authenticated:true,body:{...keychain,pair_price:-1}})).status,400);
    const deletePath='/api/admin/products/'+p.id;
    assert.equal((await call(deletePath,{method:'DELETE'})).status,401);
    const deniedDelete=await fetch(base+deletePath,{method:'DELETE',headers:{Cookie:cookie,Origin:base}});
    assert.equal(deniedDelete.status,403);
    assert.equal((await call(deletePath,{method:'DELETE',authenticated:true})).status,200);
    assert.equal((await call(deletePath,{method:'DELETE',authenticated:true})).status,404);
    assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id=?').get(p.id)).n,0);
    assert.equal((await call('/api/admin/products',{authenticated:true})).data.some(x=>x.id===p.id),false);
    assert.equal((await call('/api/admin/orders',{authenticated:true})).data[0].items[0].name,p.name);
    const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XcAAAAASUVORK5CYII=";
    const upload = await call("/api/admin/upload", {method:"POST",authenticated:true,body:{data:"data:image/png;base64,"+pixel}});
    assert.equal(upload.status,201);
    await app.db.prepare("INSERT INTO metadata VALUES(?,?)").run("owner-credentials",readFileSync(resolve(dir,"admin.json"),"utf8"));
    unlinkSync(resolve(dir,"admin.json"));
    await new Promise((r) => app.server.close(r));
    app = await createApp({ dataDir: dir, notifications: false });
    await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
    base = "http://127.0.0.1:" + app.server.address().port;
    const image = await fetch(base+upload.data.image);
    assert.equal(image.status,200);
    assert.equal(Buffer.from(await image.arrayBuffer()).toString("base64"),pixel);
    assert.equal((await call('/api/admin/products',{authenticated:true})).data.some(x=>x.id===p.id),false);
    const persisted = await call("/api/admin/orders", { authenticated: true });
    assert.equal(persisted.data[0].status, "Confirmed");
    assert.equal(persisted.data[0].reference, order.data.reference);
    await call("/api/admin/logout", {
      method: "POST",
      authenticated: true,
      body: {},
    });
    assert.equal(
      (await call("/api/admin/orders", { authenticated: true })).status,
      401,
    );
    assert.equal((await call("/api/products")).data.length, 34);
    assert.equal((await call("/api/admin/login",{method:"POST",body:{email:"test@example.invalid",password}})).status,200);
  } finally {
    await new Promise((r) => app.server.close(r));
  }
});
