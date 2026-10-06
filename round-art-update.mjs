// Owner-supplied photos reviewed 6 October 2026. No material, size or price assumed.
const entries=[
  [
    "iron-man-round-art",
    "Iron Man round artwork",
    1,
    "Iron Man in red and gold on a light blue circular artwork. This listing is for the Iron Man design on the left of the shared photo; Spider-Man is listed separately."
  ],
  [
    "spider-man-round-art",
    "Spider-Man round artwork",
    2,
    "Spider-Man making a peace-sign pose against a yellow background on a circular artwork."
  ],
  [
    "spider-gwen-round-art",
    "Spider-Gwen round artwork",
    3,
    "Spider-Gwen in a white hood with pink web details against a light blue background on a circular artwork."
  ],
  [
    "batman-round-art",
    "Batman round artwork",
    4,
    "Batman in a dark cape with bat silhouettes against a bright yellow background on a circular artwork."
  ]
];
export async function addRoundArt(db){
 if(await db.prepare("SELECT 1 FROM metadata WHERE key='round-art-oct6-v1'").get())return;
 await db.batch([
 ...entries.map(([id,name,photo,description])=>({sql:'INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,?,?,?,1,?)',args:[id,name,'Drawings',description+' Size, price and availability are confirmed by the studio.','/assets/studio-evening-'+photo+'.jpeg','',null,null,new Date().toISOString()]})),
 {sql:"INSERT OR IGNORE INTO product_images VALUES(?,?,?,?)",args:['spider-man-round-art','/assets/studio-evening-1.jpeg','','Spider-Man on the right, shown beside the separately listed Iron Man artwork']},
 {sql:"INSERT OR IGNORE INTO metadata VALUES('round-art-oct6-v1','1')",args:[]}
 ]);
}
