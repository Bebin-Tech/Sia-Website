// Product photographs and INR prices supplied by the owner on 6 October 2026.
export async function addKeychains(db) {
  await addCharacterKeychains(db);
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

async function addCharacterKeychains(db) {
  if (await db.prepare("SELECT 1 FROM metadata WHERE key='owner-character-keychains-v1'").get()) return;
  // Original owner photos; the two character designs share one photograph.
  const products = [
    ['dog-portrait-keychain', 'Golden dog keychain', 'A round pink keychain featuring a golden dog illustration with a red collar and a metal key ring. Price and personalisation are confirmed by the studio.', '/assets/dog-keychain.jpeg'],
    ['dinosaur-keychain', 'Little dinosaur keychain', 'A cheerful green and yellow dinosaur on a pale round keychain. This listing is for the dinosaur design on the left of the shared photograph; the black dragon design is listed separately. Price is confirmed by the studio.', '/assets/character-keychains.jpeg'],
    ['black-dragon-keychain', 'Black dragon keychain', 'A smiling black dragon illustration on a yellow round keychain. This listing is for the dragon design on the right of the shared photograph; the dinosaur design is listed separately. Price is confirmed by the studio.', '/assets/character-keychains.jpeg'],
  ];
  await db.batch([
    ...products.map(([id,name,description,image]) => ({sql: 'INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,?,?,?,1,?)', args: [id,name,'Keychains',description,image,'',null,null,new Date().toISOString()]})),
    {sql: "INSERT OR IGNORE INTO metadata VALUES('owner-character-keychains-v1','1')",args:[]},
  ]);
}
