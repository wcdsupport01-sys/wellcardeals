import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {decryptBackup} from '../scripts/backup/crypto.mjs';
async function exercise(mode,verify){
 const dir=await mkdtemp(join(tmpdir(),'wcd-export-')),output=join(dir,'test.wcdbackup'),key=randomBytes(32);
 try{
  const r=spawnSync(process.execPath,['--import',resolve('tests/fixtures/backup-api.mjs'),'scripts/backup/create.mjs',output],{encoding:'utf8',env:{...process.env,WCD_BACKUP_TEST_MODE:mode,WCD_BACKUP_PROJECT_REF:'a'.repeat(20),WCD_BACKUP_READ_TOKEN:'fixture-token-do-not-log',WCD_BACKUP_ENCRYPTION_KEY:key.toString('hex')},timeout:15000});
  assert(!String(r.stdout+r.stderr).includes('fixture-sensitive-value'));assert(!String(r.stdout+r.stderr).includes('fixture-token-do-not-log'));
  await verify({dir,output,key,r});
 }finally{await rm(dir,{recursive:true,force:true});}
}
test('export passes the 1,000-row cap and preserves raw int64 values inside authenticated encryption',()=>exercise('ok',async({dir,output,key,r})=>{
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).catalog_rows,1001);
 const plain=join(dir,'private.jsonl');await decryptBackup(output,plain,key);const text=await readFile(plain,'utf8');
 const records=text.trim().split('\n').map(JSON.parse);const snapshot=records.find(r=>r.kind==='snapshot').data;
 assert(snapshot.includes('9223372036854775807'));assert.equal(records.filter(r=>r.kind==='catalog_page').length,3);
 const inspect=spawnSync(process.execPath,['scripts/backup/inspect.mjs',plain],{encoding:'utf8'});assert.equal(inspect.status,0,inspect.stderr);assert.equal(JSON.parse(inspect.stdout).catalog_verified,true);
}));
for(const [mode,message] of [['drift','Catalog changed'],['capped','Catalog page was incomplete'],['denied','HTTP 401']])test(`${mode} export fails without publishing a partial backup`,()=>exercise(mode,async({dir,r})=>{
 assert.equal(r.status,1);assert(r.stderr.includes(message),r.stderr);assert(!r.stderr.includes('fixture-secret-row-must-not-be-logged'));assert.deepEqual(await readdir(dir),[]);
}));
