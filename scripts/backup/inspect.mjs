// Inspect an authenticated, decrypted backup without displaying row contents.
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
const path=process.argv[2];if(!path)throw new Error('Pass a private decrypted JSONL file.');
let header,schema,snapshot,complete,count=0,pages=0;const hash=createHash('md5');
for await(const line of createInterface({input:createReadStream(path),crlfDelay:Infinity})){
 const record=JSON.parse(line);
 if(record.kind==='header')header=record.data;
 else if(record.kind==='schema')schema=record.data;
 else if(record.kind==='snapshot')snapshot=JSON.parse(record.data);
 else if(record.kind==='catalog_page'){
  if(record.data.offset!==count)throw new Error('Catalog pages are missing or reordered.');
  for(const row of record.data.rows){if(typeof row!=='string')throw new Error('Invalid raw catalog record.');hash.update(createHash('md5').update(row).digest('hex'));count++;}pages++;
 }else if(record.kind==='complete')complete=record.data;
 else throw new Error('Unknown backup record.');
}
if(header?.format!=='wellcardeals-database-v1'||!schema?.relations||!snapshot?.tables||!complete||complete.catalog_rows!==count||complete.catalog_pages!==pages||complete.catalog_hash!==hash.digest('hex'))throw new Error('Backup is incomplete or catalog verification failed.');
console.log(JSON.stringify({project:header.project,captured_at:snapshot.captured_at,public_tables:complete.public_tables,account_tables:complete.account_tables,catalog_rows:count,table_counts:Object.fromEntries(Object.entries(snapshot.tables).map(([table,rows])=>[table,rows.length])),catalog_verified:true}));
