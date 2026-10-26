// Synthetic read-only API. This mock never opens a network connection.
import {createHash} from 'node:crypto';
const rows=Array.from({length:1001},(_,i)=>JSON.stringify({usedCarSkuId:`sku-${String(i).padStart(5,'0')}`,listed_price:100000+i}));
const digest=createHash('md5');for(const row of rows)digest.update(createHash('md5').update(row).digest('hex'));const hash=digest.digest('hex');let states=0;
const mode=process.env.WCD_BACKUP_TEST_MODE;
globalThis.fetch=async(url,options)=>{
 if(!String(url).endsWith('/database/query/read-only')||options.method!=='POST')throw new Error('Backup tried a non-read-only endpoint.');
 if(mode==='denied')return new Response('{"error":"fixture-secret-row-must-not-be-logged"}',{status:401});
 const {query}=JSON.parse(options.body);let result;
 if(query.includes('AS schema_export'))result=[{schema_export:{relations:[{name:'cars',kind:'r'},{name:'car_master_data',kind:'r'}],sequences:[],backup_auth_tables:[]}}];
 else if(query.includes('AS snapshot'))result=[{snapshot:'{"captured_at":"2026-10-26T00:00:00Z","tables":{"public.cars":[{"private":"fixture-sensitive-value","int64":9223372036854775807}]},"sequence_values":{},"storage_objects":[]}'}];
 else if(query.includes('count(*)::text AS rows'))result=[{rows:String(rows.length),hash:++states===2&&mode==='drift'?'changed':hash}];
 else {
  const limit=Number(query.match(/LIMIT (\d+)/)?.[1]),offset=Number(query.match(/OFFSET (\d+)/)?.[1]);
  if(!Number.isSafeInteger(limit)||!Number.isSafeInteger(offset))throw new Error('Unexpected query');
  result=[{rows:JSON.stringify(rows.slice(offset,offset+(mode==='capped'?Math.min(100,limit):limit)))}];
 }
 return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
};
