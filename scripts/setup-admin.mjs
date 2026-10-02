import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {randomBytes,scryptSync} from 'node:crypto';
import {mkdirSync,writeFileSync,existsSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
let muted=false;
const output=new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk,encoding);callback();}});
const rl=createInterface({input:process.stdin,output,terminal:!!process.stdin.isTTY});
try{
 const dataDir=process.env.DATA_DIR||'data';mkdirSync(dataDir,{recursive:true});const file=resolve(dataDir,'admin.json');
 if(existsSync(file)){const answer=await rl.question('Replace the existing owner login? Type REPLACE: ');if(answer!=='REPLACE')process.exit(0);}
 const email=(await rl.question('Owner email: ')).trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email.');
 process.stdout.write('New password (at least 12 characters, hidden): ');muted=true;const password=await rl.question('');muted=false;process.stdout.write('\n');
 if(password.length<12||password.length>200)throw Error('Password must contain 12–200 characters.');
 process.stdout.write('Repeat password (hidden): ');muted=true;const confirm=await rl.question('');muted=false;process.stdout.write('\n');if(confirm!==password)throw Error('Passwords do not match.');
 const salt=randomBytes(32).toString('hex'),hash=scryptSync(password,salt,64).toString('hex');writeFileSync(file+'.tmp',JSON.stringify({email,salt,hash}),{mode:0o600});renameSync(file+'.tmp',file);
 // Resetting owner credentials also revokes all existing sessions.
 const {DatabaseSync}=await import('node:sqlite');const database=resolve(dataDir,'store.sqlite');if(existsSync(database)){const db=new DatabaseSync(database);db.exec('DELETE FROM sessions');db.close();}
 console.log('Owner login saved. Open /admin and sign in.');
}catch(e){muted=false;console.error(e.message);process.exitCode=1;}finally{rl.close();}
