import { setImmediate } from 'node:timers';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackendCommands } from '../src/lib/backendOperations.js';
import { privateObjectPath, resolveProfileMedia } from '../src/lib/privateMedia.js';
function storage() {const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),values};}
test('lost save reply and reload reuse the operation ID without persisting form data',async()=>{
 const saved=storage();const calls=[];let fails=true;
 const db={auth:{getSession:async()=>({data:{session:{user:{id:'actor'}}}})},rpc:async(_,args)=>{calls.push(args);return fails?{error:{message:'network unavailable'}}:{data:{car_id:'car'}};}};
 const first=createBackendCommands(db,saved);
 await assert.rejects(first('create',{fields:{seller_phone:'private',vehicle_title:'Car'}}));
 assert(!JSON.stringify([...saved.values]).includes('private'));
 fails=false;
 await createBackendCommands(db,saved)('create',{fields:{vehicle_title:'Car',seller_phone:'private'}});
 assert.equal(calls[0].p_operation_id,calls[1].p_operation_id);
 assert.equal(saved.values.size,0);
});
test('simultaneous identical saves share one RPC and different actors never share keys',async()=>{
 const saved=storage();let actor='one',finish;const calls=[];
 const db={auth:{getSession:async()=>({data:{session:{user:{id:actor}}}})},rpc:async(_,args)=>{calls.push(args);await new Promise(r=>finish=r);return {data:{ok:true}};}};
 const command=createBackendCommands(db,saved);const a=command('update',{id:'car'}),b=command('update',{id:'car'});
 while(!finish) await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));finish();await Promise.all([a,b]);assert.equal(calls.length,1);
 actor='two';const c=command('update',{id:'car'});while(calls.length<2) await new Promise(r=>setImmediate(r));finish();await c;assert.notEqual(calls[0].p_operation_id,calls[1].p_operation_id);
});
test('only configured Supabase bucket URLs are converted to private object paths',async()=>{
 assert.deepEqual(privateObjectPath('https://db.example.test/storage/v1/object/public/dealer-docs/owner/license.pdf','https://db.example.test'),{bucket:'dealer-docs',path:'owner/license.pdf'});
 assert.equal(privateObjectPath('https://evil.test/storage/v1/object/public/dealer-docs/owner/license.pdf','https://db.example.test'),null);
 const calls=[];const db={storage:{from:bucket=>({createSignedUrl:async(path,expires)=>{calls.push({bucket,path,expires});return {data:{signedUrl:'temporary-url'}};}})}};
 const resolved=await resolveProfileMedia(db,{id:'owner',license_url:'storage://dealer-docs/owner/license.pdf'},'https://db.example.test');
 assert.equal(resolved.license_url,'temporary-url');assert.equal(calls[0].expires,600);
});

test('paged reads handle a server cap smaller than requested and propagate a failed page', async()=>{
 const {readPages}=await import('../src/lib/readPages.js');
 const items=Array.from({length:6},(_,i)=>({id:String(9-i),created_at:'2026-10-25T00:00:00Z'}));
 let calls=0,fail=false;
 function makeQuery(){let after=99;const query={order:()=>query,limit:()=>query,or:filter=>{after=Number(filter.match(/id.lt.(\d+)/)[1]);return query;},then:(resolve,reject)=>{calls++;const remaining=items.filter(x=>Number(x.id)<after);return Promise.resolve(fail&&calls===2?{error:new Error('offline')}:{data:remaining.slice(0,2),count:remaining.length}).then(resolve,reject);}};return query;}
 assert.deepEqual(await readPages(makeQuery,{pageSize:500}),items);assert.equal(calls,3);
 fail=true;calls=0;await assert.rejects(readPages(makeQuery),/offline/);
});
