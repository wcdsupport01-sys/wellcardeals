import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {open,stat,rename,unlink} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {createGzip,createGunzip} from 'node:zlib';
const MAGIC=Buffer.from('WCDBAK01'),IV_LENGTH=12,TAG_LENGTH=16;
export function backupKey(value){
 if(typeof value!=='string'||! /^[a-fA-F0-9]{64}$/.test(value.trim()))throw new Error('WCD_BACKUP_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters.');
 return Buffer.from(value.trim(),'hex');
}
export async function encryptBackup(records,output,key){
 const partial=output+'.partial',iv=randomBytes(IV_LENGTH),cipher=createCipheriv('aes-256-gcm',key,iv);
 let owned=false;
 try{
  const file=await open(partial,'wx',0o600);owned=true;
  await file.write(Buffer.concat([MAGIC,iv]));await file.close();
  await pipeline(records,createGzip({level:6}),cipher,createWriteStream(partial,{flags:'a',mode:0o600}));
  const f=await open(partial,'a');try{await f.write(cipher.getAuthTag());}finally{await f.close();}
  // Refuse to replace a previous completed archive.
  try{await stat(output);throw new Error('Output already exists. Choose a new backup filename.');}catch(e){if(e.code!=='ENOENT')throw e;}
  await rename(partial,output);owned=false;
 }finally{if(owned)await unlink(partial).catch(()=>{});}
}
export async function decryptBackup(input,output,key){
 const info=await stat(input);if(info.size<=MAGIC.length+IV_LENGTH+TAG_LENGTH)throw new Error('Truncated backup.');
 const file=await open(input,'r');let prefix,tag;
 try{
  prefix=Buffer.alloc(MAGIC.length+IV_LENGTH);await file.read(prefix,0,prefix.length,0);
  tag=Buffer.alloc(TAG_LENGTH);await file.read(tag,0,TAG_LENGTH,info.size-TAG_LENGTH);
 }finally{await file.close();}
 if(!prefix.subarray(0,MAGIC.length).equals(MAGIC))throw new Error('Unsupported backup format.');
 const cipher=createDecipheriv('aes-256-gcm',key,prefix.subarray(MAGIC.length));cipher.setAuthTag(tag);
 const partial=output+'.partial';let owned=false;
 try{
  const f=await open(partial,'wx',0o600);await f.close();owned=true;
  await pipeline(createReadStream(input,{start:prefix.length,end:info.size-TAG_LENGTH-1}),cipher,createGunzip(),createWriteStream(partial,{flags:'w',mode:0o600}));
  try{await stat(output);throw new Error('Output already exists. Choose a new restore filename.');}catch(e){if(e.code!=='ENOENT')throw e;}
  await rename(partial,output);owned=false;
 }finally{if(owned)await unlink(partial).catch(()=>{});}
}
