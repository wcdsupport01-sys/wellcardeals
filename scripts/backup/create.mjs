// Read-only Supabase Management API export. Only encrypted output reaches disk.
import {createHash} from 'node:crypto';
import {readFile,mkdir,stat} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {backupKey,encryptBackup} from './crypto.mjs';
const project=process.env.WCD_BACKUP_PROJECT_REF;
if(!/^[a-z]{20}$/.test(project||''))throw new Error('Set WCD_BACKUP_PROJECT_REF to the intended project.');
const token=process.env.WCD_BACKUP_READ_TOKEN;if(!token)throw new Error('Set WCD_BACKUP_READ_TOKEN to a project-scoped Database Read token.');
const key=backupKey(process.env.WCD_BACKUP_ENCRYPTION_KEY);
const output=resolve(process.argv[2]||`backups/wellcardeals-${new Date().toISOString().replace(/[:.]/g,'-')}.wcdbackup`);
await mkdir(dirname(output),{recursive:true,mode:0o700});
const q=value=>'"'+value.replaceAll('"','""')+'"',lit=value=>"'"+value.replaceAll("'","''")+"'";
async function sql(query){
 for(let attempt=0;attempt<3;attempt++){
  let response;
  try{response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query/read-only`,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(45000)});}
  catch{if(attempt<2)continue;throw new Error('Read-only backup connection failed. Check network access.');}
  if(response.status===429 || response.status>=500){if(attempt<2){await new Promise(r=>setTimeout(r,1000*(attempt+1)));continue;}}
  if(!response.ok)throw new Error(`Read-only backup request refused (HTTP ${response.status}). Check project, token expiry and Database Read access.`);
  return response.json();
 }
 throw new Error('Backup read unavailable.');
}
function catalogStateQuery(){return `SELECT count(*)::text AS rows,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY "usedCarSkuId" COLLATE "C"),'')) AS hash FROM public.car_master_data t`;}
function entry(kind,data){return JSON.stringify({kind,data})+'\n';}
let stats;
async function* records(){
 const metadata=(await sql(await readFile(fileURLToPath(new URL('./schema-export.sql',import.meta.url)),'utf8')))[0]?.schema_export;
 if(!metadata?.relations?.length)throw new Error('Schema inventory unavailable; refusing an incomplete backup.');
 const unsupported=metadata.relations.filter(r=>!['r','S','v'].includes(r.kind));if(unsupported.length)throw new Error('Unsupported relation kind requires backup review.');
 const tables=metadata.relations.filter(r=>r.kind==='r').map(r=>({schema:'public',name:r.name}));
 if(!tables.some(t=>t.name==='car_master_data'))throw new Error('Expected imported catalog is missing.');
 const small=tables.filter(t=>t.name!=='car_master_data').concat(metadata.backup_auth_tables||[]);
 const selects=small.map(t=>`SELECT ${lit(t.schema+'.'+t.name)} AS name,(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM ${q(t.schema)}.${q(t.name)} t) AS rows`);
 const sequences=(metadata.sequences||[]).map(s=>`SELECT ${lit(s.name)} AS name,(SELECT jsonb_build_object('last_value',last_value::text,'is_called',is_called) FROM public.${q(s.name)}) AS data`);
 const snapshotQuery=`SELECT jsonb_build_object('captured_at',statement_timestamp(),'server_version',current_setting('server_version'),'tables',(SELECT jsonb_object_agg(name,rows) FROM (${selects.join(' UNION ALL ')}) s),'sequence_values',${sequences.length?`(SELECT jsonb_object_agg(name,data) FROM (${sequences.join(' UNION ALL ')}) s)`:`'{}'::jsonb`},'storage_objects',(SELECT coalesce(jsonb_agg(to_jsonb(o)),'[]'::jsonb) FROM storage.objects o))::text AS snapshot`;
 const snapshot=(await sql(snapshotQuery))[0]?.snapshot;if(typeof snapshot!=='string')throw new Error('Consistent application snapshot unavailable.');
 const before=(await sql(catalogStateQuery()))[0];const expected=Number(before.rows);if(!Number.isSafeInteger(expected)||expected<0)throw new Error('Invalid catalog count.');
 yield entry('header',{format:'wellcardeals-database-v1',project,created_at:new Date().toISOString(),encryption:'AES-256-GCM',key_id:createHash('sha256').update(key).digest('hex').slice(0,16),scope:'Database schema/application/account data and storage inventory. Excludes storage file bytes, active Auth sessions, provider and platform secrets.'});
 yield entry('schema',metadata);yield entry('snapshot',snapshot);
 const digest=createHash('md5');let total=0,pages=0;
 for(let offset=0;offset<expected;offset+=500){
  const count=Math.min(500,expected-offset);
  const query=`SELECT coalesce(jsonb_agg(to_jsonb(t)::text),'[]'::jsonb)::text AS rows FROM (SELECT * FROM public.car_master_data ORDER BY "usedCarSkuId" COLLATE "C" LIMIT ${count} OFFSET ${offset}) t`;
  const rows=JSON.parse((await sql(query))[0].rows);
  if(rows.length!==count || rows.some(r=>typeof r!=='string'))throw new Error('Catalog page was incomplete.');
  for(const row of rows)digest.update(createHash('md5').update(row).digest('hex'));
  total+=rows.length;pages++;yield entry('catalog_page',{offset,rows});
 }
 const after=(await sql(catalogStateQuery()))[0];
 if(before.rows!==after.rows || before.hash!==after.hash || digest.digest('hex')!==before.hash || total!==expected)throw new Error('Catalog changed during backup or a page failed verification; archive was not published.');
 stats={public_tables:tables.length,account_tables:(metadata.backup_auth_tables||[]).length,catalog_rows:total,catalog_pages:pages};
 yield entry('complete',{...stats,catalog_hash:before.hash});
}
try{
 await encryptBackup(Readable.from(records()),output,key);
 console.log(JSON.stringify({status:'encrypted_backup_complete',file:output,bytes:(await stat(output)).size,...stats}));
}catch(error){console.error(error instanceof Error?error.message:'Backup failed.');process.exitCode=1;}
