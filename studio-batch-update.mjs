// Owner-supplied ZIP, visually reviewed 6 October 2026. No prices supplied.
export const studioBatch = [
  [
    1,
    "red-daisy-keychain",
    "Red daisy keychain",
    "Keychains",
    "Red pipe-cleaner petals around a white centre, attached to a metal key ring. The photo shows two examples of this design; confirm the supplied quantity with the studio."
  ],
  [
    2,
    "blue-daisy-keychain",
    "Blue daisy keychain",
    "Keychains",
    "Deep blue petals with a pale blue and white centre on a metal key ring. The photo shows two examples; confirm the supplied quantity with the studio."
  ],
  [
    3,
    "sunflower-keychain",
    "Sunflower keychain",
    "Keychains",
    "Golden yellow pipe-cleaner petals with a brown centre and a metal key ring. The photo shows two examples; confirm the supplied quantity with the studio."
  ],
  [
    4,
    "blue-eye-keychain",
    "Blue eye keychain",
    "Keychains",
    "A round blue, white and dark-centred eye design on a metal key ring."
  ],
  [
    5,
    "red-flower-dark-pot",
    "Red flowers in a dark pot",
    "Flower Pots",
    "Red flowers with green stems and leaves arranged in a dark little pot."
  ],
  [
    6,
    "sunflower-pot",
    "Sunflower pot",
    "Flower Pots",
    "Two golden yellow sunflowers with brown centres and green leaves in a brown pot."
  ],
  [
    8,
    "pink-loop-flower-pot",
    "Pink loop-petal flower pot",
    "Flower Pots",
    "Pink and deep pink loop-shaped flower petals with green leaves and a small flower detail on the pot."
  ],
  [
    9,
    "lavender-daisy-pot",
    "Lavender daisy pot",
    "Flower Pots",
    "Two lavender daisies with pale centres and green leaves in a brown pot with pastel trim."
  ],
  [
    10,
    "purple-bud-pot",
    "Purple flower-bud pot",
    "Flower Pots",
    "A cluster of purple flower buds with green leaves in a small pot decorated with a purple flower."
  ],
  [
    11,
    "lilac-flower-pot",
    "Lilac flower pot",
    "Flower Pots",
    "A cluster of lilac flowers with pale centres and green leaves in a pot with pale blue trim."
  ],
  [
    12,
    "red-flower-pink-pot",
    "Red flowers in a pink pot",
    "Flower Pots",
    "Red flowers and green leaves in a pink pot with a white rim."
  ],
  [
    13,
    "pink-daisy-pot",
    "Pink daisy pot",
    "Flower Pots",
    "Two soft pink daisies with pale centres and green leaves in a brown pot with pink trim."
  ],
  [
    14,
    "mint-daisy-pot",
    "Mint daisy pot",
    "Flower Pots",
    "A mint-coloured daisy with a pale centre and green leaves in a white pot."
  ],
  [
    15,
    "deep-pink-daisy-pot",
    "Deep pink daisy pot",
    "Flower Pots",
    "A deep pink daisy with a pale centre and green leaves in a pink-and-white pot."
  ],
  [
    16,
    "blue-daisy-pot",
    "Blue daisy pot",
    "Flower Pots",
    "A deep blue daisy with a pale blue and white centre and green leaves in a white pot with blue trim."
  ]
];
export async function addStudioBatch(db) {
 if(await db.prepare("SELECT 1 FROM metadata WHERE key='studio-zip-oct6-v1'").get()) return;
 const now=new Date().toISOString();
 await db.batch([
 ...studioBatch.map(([photo,id,name,category,description])=>({sql:'INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,?,?,?,1,?)',args:[id,name,category,description+' Handmade by siaa. Price, size and customisation are confirmed by the studio.','/assets/studio-batch-'+photo+'.jpeg','',null,null,now]})),
 {sql:"UPDATE products SET category='Flower Pots' WHERE id IN ('blue-flower-pot','flower-craft')",args:[]},
 {sql:"UPDATE products SET name='Pink flower-bud pot' WHERE id='flower-craft' AND name='Pipe-cleaner flower craft'",args:[]},
 {sql:"INSERT OR IGNORE INTO product_images(product_id,image,source,alt) SELECT id,?,'',? FROM products WHERE id='flower-craft'",args:['/assets/studio-batch-7.jpeg','Pink flower-bud pot photographed by the studio']},
 {sql:"INSERT OR IGNORE INTO metadata VALUES('studio-zip-oct6-v1','1')",args:[]}
 ]);
}
