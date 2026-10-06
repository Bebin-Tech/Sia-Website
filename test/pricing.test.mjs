import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {createApp} from '../server.mjs';
test('saved prices, quantities, retries, quotes and tampered payment totals',async()=>{
 const dir=mkdtempSync(resolve('data','pricing-'));
 const app=await createApp({dataDir:dir,notifications:false});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port;
 const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try {
  const key=crypto.randomUUID();
  const body={idempotencyKey:key,customer:{name:'Test',email:'test@example.invalid',address:'Test',city:'Test',region:'Test',postal:'00000',country:'Test',consent:'on'},items:[{id:'cherry-keychain',quantity:2,price:1},{id:'shield-keychain',quantity:3,price:1}]};
  const order=await post('/api/orders',body);
  assert.equal(order.status,201);assert.equal(order.data.pricing.total,31000);
  assert.equal(order.data.items[0].unitPrice,5000);
  const access={reference:order.data.reference,accessKey:key};
  assert.equal((await post('/api/orders/payment-details',{...access,accessKey:'wrong'})).status,403);
  await app.db.prepare("UPDATE products SET price=9000 WHERE id='cherry-keychain'").run();
  assert.equal((await post('/api/orders',body)).data.pricing.total,31000);
  assert.equal((await post('/api/orders/payment-details',access)).data.pricing.total,31000);
  const payment={...access,transactionId:'234567890123',amount:31000,deliveryAmount:0};
  assert.equal((await post('/api/payments/report',{...payment,amount:1})).status,400);
  assert.equal((await post('/api/payments/report',{...payment,amount:32000})).status,400);
  assert.equal((await post('/api/payments/report',{...payment,amount:30000,deliveryAmount:-1000})).status,400);
  assert.equal((await post('/api/payments/report',{...payment,amount:33000,deliveryAmount:2000})).status,201);
  const mixed=await post('/api/orders',{...body,idempotencyKey:crypto.randomUUID(),items:[{id:'cherry-keychain',quantity:1},{id:'blue-bouquet',quantity:1}]});
  assert.equal(mixed.data.pricing.total,null);assert.equal(mixed.data.pricing.quoteRequired,true);
  assert.equal(mixed.data.pricing.subtotal,9000);
  await app.db.prepare("UPDATE orders SET status='Cancelled' WHERE reference=?").run(order.data.reference);
  assert.equal((await post('/api/orders/payment-details',access)).status,409);
 } finally {await new Promise(r=>app.server.close(r));}
});
