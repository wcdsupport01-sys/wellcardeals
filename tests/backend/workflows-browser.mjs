// Exercise the actual staff review/purchase screens with an isolated SDK fixture.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
await page.route('**/src/lib/supabaseClient.js*',route=>route.fulfill({contentType:'application/javascript',body:`
const id='00000000-0000-0000-0000-000000000001';
const user={id,email:'staff@example.test'};
const role=sessionStorage.getItem('fixtureRole') || 'manager';
window.commandCalls=[];
const car={id:'00000000-0000-0000-0000-000000000002',vehicle_title:'Agent inspection car',listing_type:'auction',status:'draft',visibility:'hidden',tl_review_status:'pending',submitted_by_agent_id:'00000000-0000-0000-0000-000000000004',created_at:'2026-10-25T00:00:00Z',images:[],documents:[]};
const purchase={id:'00000000-0000-0000-0000-000000000003',status:'pending',buyer_name:'Fixture Buyer',buyer_phone:'9999999999',offer_price:100000,created_at:'2026-10-25T00:00:00Z',cars:{vehicle_title:'Buyer car'}};
export const isSupabaseConfigured=true;
export const supabase={
 auth:{getSession:async()=>({data:{session:{user}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 channel(){const c={on:()=>c,subscribe:()=>c};return c;},removeChannel(){},
 rpc:async(name,args)=>{window.commandCalls.push({name,args});if(name==='backend_car_command')return {data:{car:{...car,status:'live',tl_review_status:'approved',access_type:'dealer_only'}}};return {data:{}};},
 from(table){let single=false;const q={select:()=>q,eq:()=>q,in:()=>q,not:()=>q,order:()=>q,limit:()=>q,abortSignal:()=>q,maybeSingle:()=>{single=true;return q;},then(resolve,reject){let data=[];if(table==='profiles')data=single?{id,role,status:'approved',full_name:'Fixture Staff'}:[];if(table==='cars_catalog')data=[car];if(table==='car_purchase_requests')data=[purchase];return Promise.resolve({data,count:Array.isArray(data)?data.length:1}).then(resolve,reject);}};return q;}
};
`}));
try {
 await page.goto('http://127.0.0.1:5173/admin/agent-submissions');
 await page.getByText('Agent inspection car',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Approve & Publish'}).click();
 await page.getByRole('button',{name:'Approve & Publish'}).waitFor({state:'hidden'});
 let calls=await page.evaluate(()=>window.commandCalls);
 assert.equal(calls.length,1);assert.equal(calls[0].args.p_action,'agent_review');assert.equal(calls[0].args.p_payload.decision,'approved');
 assert.equal(calls[0].args.p_payload.fields,undefined);
 await page.goto('http://127.0.0.1:5173/admin/buy-requests');
 await page.getByText(/Fixture Buyer/).waitFor();
 await page.getByRole('button',{name:'Mark Sold',exact:true}).click();
 calls=await page.evaluate(()=>window.commandCalls);assert.equal(calls[0].args.p_action,'purchase_complete');
 await page.evaluate(()=>sessionStorage.setItem('fixtureRole','team_lead'));
 await page.goto('http://127.0.0.1:5173/admin/buy-requests');
 await page.getByText(/Fixture Buyer/).waitFor();assert(await page.getByRole('button',{name:'Mark Sold',exact:true}).isDisabled());
 await page.goto('http://127.0.0.1:5173/admin/agent-submissions');
 await page.getByRole('button',{name:'Approve & Publish'}).waitFor();assert(await page.getByRole('button',{name:'Approve & Publish'}).isEnabled());
 assert.deepEqual(errors,[]);
 console.log('PASS mobile staff workflows: transactional review, purchase completion, team-lead review authority and read-only sales controls');
} finally {await browser.close();}
