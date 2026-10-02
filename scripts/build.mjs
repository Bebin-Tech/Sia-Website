import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
const result=await build({entryPoints:{store:'src/store.jsx',admin:'src/admin.jsx'},bundle:true,minify:true,outdir:'public/build',entryNames:'[name]-[hash]',metafile:true,format:'esm',platform:'browser',target:['es2022'],define:{'process.env.NODE_ENV':'"production"'}});
for(const [file,info] of Object.entries(result.metafile.outputs)){if(!info.entryPoint)continue;const entry=info.entryPoint.includes('store.jsx')?'store':'admin';const html=entry==='store'?'public/index.html':'public/admin.html';const text=readFileSync(html,'utf8');writeFileSync(html,text.replace(new RegExp('/build/'+entry+'(?:-[A-Z0-9]+)?\\.js'),'/'+file.replaceAll('\\','/').replace(/^public\//,'')));}
console.log('React storefront and studio built.');
