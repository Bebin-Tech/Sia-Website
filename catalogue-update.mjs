// Photos reviewed on the public @siaa_sketchncraft__ account, 2 October 2026.
// Names are descriptive. Availability and prices still require owner confirmation.
const source=id=>`https://www.instagram.com/siaa_sketchncraft__/reel/${id}/`;
export const additionalProducts=[
 {id:'blue-flower-pot',name:'Blue flower pot',category:'Crafts',image:'/assets/flower-pot.jpg',source:source('DaaW2xCzf4r'),description:'A blue pipe-cleaner flower with an eye-inspired centre, green leaves and a striped little pot. A handmade piece from siaa’s studio. Ask about colours, dimensions and availability.',price:null,currency:null},
 {id:'bunny-dolls',name:'Bunny pipe-cleaner dolls',category:'Crafts',image:'/assets/craft-figure.jpg',source:source('DbdU58tTmXx'),description:'Blue and pink bunny figures from siaa’s pipe-cleaner doll-making post. The photograph shows two designs; tell the studio which one you like. Quantity, size and whether pieces are supplied individually are confirmed on request.',price:null,currency:null},
 {id:'duck-keychain',name:'Little duck keychain',category:'Crafts',image:'/assets/duck-craft.jpg',source:source('Db5okD0hyjW'),description:'A cheerful yellow duck illustration on a pink round keychain, from siaa’s handmade keychain collection. A tiny creative detail for your everyday essentials. Ask the studio about availability and personalisation.',price:null,currency:null},
 {id:'blue-haired-portrait',name:'Blue-haired character study',category:'Drawings',image:'/assets/drawing-study.jpg',source:source('Ddbf1XqBWKN'),description:'An expressive character drawing with blue hair, a green jacket and hand-drawn details. Featured in siaa’s sketchbook. Size, medium and availability are confirmed by the studio.',price:null,currency:null},
 {id:'marinette-drawing',name:'Marinette, in siaa’s style',category:'Drawings',image:'/assets/drawing-art.jpg',source:source('DcqoBv0I3AJ'),description:'A full character drawing of Marinette in a pink jacket, shared as “Marinette, but make it MY style!” on Instagram. An example of siaa’s character illustration work; ask about size, medium and availability.',price:null,currency:null}
];
export const photoGallery=[
 {product:'blue-bouquet',image:'/assets/rose-bouquet.jpg',source:source('Dafg5LnTZo2'),alt:'Another view of siaa’s blue and white pipe-cleaner bouquet'},
 {product:'blue-bouquet',image:'/assets/bouquet-detail.jpg',source:source('DanPUA5TRyE'),alt:'The blue bouquet beside handmade flower pots in the studio'},
 {product:'blue-flower-pot',image:'/assets/crochet.jpg',source:source('DdG4VY2hDZY'),alt:'A closer view of the blue pipe-cleaner flower pot'},
 {product:'chibi-drawing',image:'/assets/sketchbook.jpg',source:source('Dc8lHw-BV3I'),alt:'Another view of siaa’s chibi character sketchbook'}
];
export function extendCatalogue(db){
 db.exec('CREATE TABLE IF NOT EXISTS product_images(product_id TEXT NOT NULL REFERENCES products(id),image TEXT NOT NULL,source TEXT NOT NULL,alt TEXT NOT NULL,PRIMARY KEY(product_id,image))');
 if(db.prepare("SELECT 1 FROM metadata WHERE key='instagram-gallery-v2'").get())return;
 db.exec('BEGIN');
 try{const insert=db.prepare('INSERT OR IGNORE INTO products(id,name,category,description,image,source,price,currency,active,updated) VALUES(?,?,?,?,?,?,?,?,1,?)');for(const p of additionalProducts)insert.run(p.id,p.name,p.category,p.description,p.image,p.source,p.price,p.currency,new Date().toISOString());
 const add=db.prepare('INSERT OR IGNORE INTO product_images VALUES(?,?,?,?)');for(const p of photoGallery)add.run(p.product,p.image,p.source,p.alt);
 db.prepare('INSERT INTO metadata VALUES(?,?)').run('instagram-gallery-v2','1');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
