// Product photographs and INR prices supplied by the owner on 6 October 2026.
export async function addKeychains(db) {
  if (await db.prepare("SELECT 1 FROM metadata WHERE key='owner-keychains-v1'").get()) return;
  const products = [
    ['cherry-keychain', 'Cherry bow keychain', 'Two red pipe-cleaner cherries with a green bow and a metal key ring. Handmade by siaa. Personalisation requests are confirmed separately.', '/assets/cherry-keychain.jpeg', 5000],
    ['shield-keychain', 'Star shield keychain', 'A handmade round keychain with a red, white and blue shield design and a white star. Personalisation requests are confirmed separately.', '/assets/shield-keychain.jpeg', 7000],
  ];
  await db.batch([
    ...products.map(([id,name,description,image,price]) => ({sql: 'INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,?,?,?,1,?)', args: [id,name,'Keychains',description,image,'',price,'INR',new Date().toISOString()]})),
    {sql: "UPDATE products SET category='Keychains' WHERE id='duck-keychain' AND category='Crafts'",args:[]},
    {sql: "INSERT OR IGNORE INTO metadata VALUES('owner-keychains-v1','1')",args:[]},
  ]);
}
