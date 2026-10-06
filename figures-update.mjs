// Original owner photographs supplied 6 October 2026; no price supplied.
export async function addFigures(db) {
  if (await db.prepare("SELECT 1 FROM metadata WHERE key='figures-oct6-v1'").get()) return;
  await db.batch([
    {sql:'INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,?,?,?,1,?)',args:[
      'red-sprout-figure','Red sprout pipe-cleaner figure','Crafts',
      'A little red-and-white pipe-cleaner figure with two green leaves, black eyes and pink cheeks. A handmade decorative creation by siaa. Price, dimensions and availability are confirmed by the studio.',
      '/assets/red-sprout-figure.jpeg','',null,null,new Date().toISOString()
    ]},
    {sql:"INSERT OR IGNORE INTO product_images(product_id,image,source,alt) SELECT id,?,'',? FROM products WHERE id='bunny-dolls'",args:[
      '/assets/bunny-dolls-owner.jpeg','Blue and pink pipe-cleaner bunny figures photographed by the studio'
    ]},
    {sql:"INSERT OR IGNORE INTO metadata VALUES('figures-oct6-v1','1')",args:[]}
  ]);
}
