// Owner photographs reviewed on 6 October 2026; prices intentionally unset.
const entries=[
  [
    "red-white-bouquet",
    "Red and white flower bouquet",
    "Bouquets",
    "Red and white pipe-cleaner flowers in black star-patterned wrapping with white ribbon. The photo shows two examples; confirm the requested bouquet quantity with the studio.",
    "bouquet-batch-1.jpeg"
  ],
  [
    "lavender-gold-bouquet",
    "Lavender bouquet with gold-trim wrap",
    "Bouquets",
    "Lavender and purple flowers with green leaves, purple gold-trimmed wrapping and layered ribbons.",
    "bouquet-batch-2.jpeg"
  ],
  [
    "red-lily-bouquet",
    "Red lily-style bouquet",
    "Bouquets",
    "Red lily-style flowers and a red bud in black and gold wrapping, finished with red and white ribbons.",
    "bouquet-batch-3.jpeg"
  ],
  [
    "lilac-mixed-bouquet",
    "Lilac mixed-flower bouquet",
    "Bouquets",
    "A mix of lilac flower shapes and a purple flower spike in purple and translucent wrapping with a white ribbon.",
    "bouquet-batch-4.jpeg"
  ],
  [
    "sunflower-mini-bouquet",
    "Single sunflower bouquet",
    "Bouquets",
    "A golden yellow sunflower with a brown centre in black star-patterned wrapping, tied with yellow and white ribbons.",
    "bouquet-batch-5.jpeg"
  ],
  [
    "spider-hero-canvas",
    "Spider-Man mini canvas art",
    "Drawings",
    "A red and black Spider-Man portrait against a light blue background on a small square canvas. Dimensions and availability are confirmed by the studio.",
    "spider-hero-art.jpeg"
  ]
];
export async function addBouquets(db){
 if(await db.prepare("SELECT 1 FROM metadata WHERE key='bouquets-art-oct6-v1'").get())return;
 await db.batch([
 ...entries.map(([id,name,category,description,file])=>({sql:'INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,?,?,?,1,?)',args:[id,name,category,description+' Price and customisation are confirmed by the studio.','/assets/'+file,'',null,null,new Date().toISOString()]})),
 {sql:"INSERT OR IGNORE INTO product_images(product_id,image,source,alt) SELECT id,?,'',? FROM products WHERE id='sunflower-keychain'",args:['/assets/sunflower-single.jpeg','Single sunflower keychain photographed by siaa']},
 {sql:"INSERT OR IGNORE INTO metadata VALUES('bouquets-art-oct6-v1','1')",args:[]}
 ]);
}
