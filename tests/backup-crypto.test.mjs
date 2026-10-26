import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,stat,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {backupKey,encryptBackup,decryptBackup} from '../scripts/backup/crypto.mjs';
async function fixture(fn){const dir=await mkdtemp(join(tmpdir(),'wcd-crypto-'));try{await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('backup encryption authenticates streamed data, preserves exact integers and keeps files private',async()=>fixture(async dir=>{
 const key=randomBytes(32),source='{"private":"synthetic-secret","int64":9223372036854775807}\n',archive=join(dir,'a.wcdbackup'),restored=join(dir,'restore.jsonl');
 await encryptBackup(Readable.from([source.slice(0,10),source.slice(10)]),archive,key);
 assert(!(await readFile(archive)).includes(Buffer.from('synthetic-secret')));
 await decryptBackup(archive,restored,key);assert.equal(await readFile(restored,'utf8'),source);
 assert.equal((await stat(archive)).mode&0o777,0o600);assert.equal((await stat(restored)).mode&0o777,0o600);
}));
test('wrong keys and tampered ciphertext never publish unauthenticated plaintext',async()=>fixture(async dir=>{
 const key=randomBytes(32),archive=join(dir,'a.wcdbackup');await encryptBackup(Readable.from(['private fixture']),archive,key);
 await assert.rejects(decryptBackup(archive,join(dir,'wrong'),randomBytes(32)));
 const data=await readFile(archive);data[24]^=1;await writeFile(archive,data);
 await assert.rejects(decryptBackup(archive,join(dir,'tampered'),key));
 assert.deepEqual(await readdir(dir),['a.wcdbackup']);
}));
test('a failed export leaves no apparently completed backup and cannot overwrite a prior archive',async()=>fixture(async dir=>{
 const key=randomBytes(32),archive=join(dir,'a.wcdbackup');
 async function* broken(){yield 'first chunk';throw new Error('export failed');}
 await assert.rejects(encryptBackup(Readable.from(broken()),archive,key),/export failed/);assert.deepEqual(await readdir(dir),[]);
 await encryptBackup(Readable.from(['first complete backup']),archive,key);const original=await readFile(archive);
 await assert.rejects(encryptBackup(Readable.from(['replacement']),archive,key),/already exists/);assert.deepEqual(await readFile(archive),original);
}));
test('only 32-byte hexadecimal encryption keys are accepted',()=>{
 const hex=randomBytes(32).toString('hex');assert.equal(backupKey(hex+'\n').length,32);
 for(const value of [undefined,'password','g'.repeat(64),'a'.repeat(63)])assert.throws(()=>backupKey(value));
});
