// Exercise actual buyer purchase and staff review screens with an isolated SDK fixture.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
await page.route('**/src/lib/supabaseClient.js*',route=>route.fulfill({contentType:'application/javascript',body:`
const id='00000000-0000-0000-0000-000000000001';
const user={id,email:'staff@example.test'};
const role=sessionStorage.getItem('fixtureRole') || 'manager';
window.commandCalls=[];window.failBuyOnce=false;
const car={id:'00000000-0000-0000-0000-000000000002',vehicle_title:'Agent inspection car',listing_type:'auction',status:'draft',visibility:'hidden',tl_review_status:'pending',submitted_by_agent_id:'00000000-0000-0000-0000-000000000004',created_at:'2026-10-25T00:00:00Z',images:[],documents:[]};
if(role==='buyer')Object.assign(car,{vehicle_title:'Fixture Buy Now car',listing_type:'buy_now_only',status:'live',visibility:'visible',tl_review_status:'approved',access_type:'all',buy_now_price:123000,base_price_buyer:1});
const purchase={id:'00000000-0000-0000-0000-000000000003',status:'pending',buyer_name:'Fixture Buyer',buyer_phone:'9999999999',offer_price:100000,created_at:'2026-10-25T00:00:00Z',cars:{vehicle_title:'Buyer car'}};
export const isSupabaseConfigured=true;
export const supabase={
 auth:{getSession:async()=>({data:{session:{user}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 channel(){const c={on:()=>c,subscribe:()=>c};return c;},removeChannel(){},
 rpc:async(name,args)=>{window.commandCalls.push({name,args});if(args?.p_action==='purchase_request'){if(window.failBuyOnce){window.failBuyOnce=false;return {error:{message:'Connection lost. Retry to confirm.',code:'08006'}};}return {data:{request:{id:'purchase-fixture'}}};}if(name==='backend_car_command')return {data:{car:{...car,status:'live',tl_review_status:'approved',access_type:'dealer_only'}}};return {data:{}};},
 from(table){let single=false;const q={select:()=>q,eq:()=>q,in:()=>q,neq:()=>q,not:()=>q,order:()=>q,limit:()=>q,abortSignal:()=>q,maybeSingle:()=>{single=true;return q;},then(resolve,reject){let data=[];if(table==='profiles')data=single?{id,role,status:'approved',full_name:'Fixture Staff'}:[];if(table==='cars_catalog')data=single?car:role==='buyer'?[]:[car];if(table==='car_purchase_requests')data=[purchase];return Promise.resolve({data,count:Array.isArray(data)?data.length:1}).then(resolve,reject);}};return q;}
};
`}));
try {
 await page.goto('http://127.0.0.1:5173/admin/agent-submissions');
 await page.getByText('Agent inspection car',{exact:true}).waitFor();
 await page.getByRole('button',{name:'View details',exact:true}).first().click();
 await page.getByRole('button',{name:'Approve & Publish'}).click();
 await page.getByRole('button',{name:'Approve & Publish'}).waitFor({state:'hidden'});
 let calls=await page.evaluate(()=>window.commandCalls.filter(c=>c.name==='backend_car_command'));
 assert.equal(calls.length,1);assert.equal(calls[0].args.p_action,'agent_review');assert.equal(calls[0].args.p_payload.decision,'approved');
 assert.equal(calls[0].args.p_payload.fields,undefined);
 await page.goto('http://127.0.0.1:5173/admin/buy-requests');
 await page.getByText(/Fixture Buyer/).waitFor();
 await page.getByRole('button',{name:'View details',exact:true}).first().click();
 await page.getByRole('button',{name:'Mark Sold',exact:true}).click();
 calls=await page.evaluate(()=>window.commandCalls.filter(c=>c.name==='backend_car_command'));assert.equal(calls[0].args.p_action,'purchase_complete');
 await page.evaluate(()=>sessionStorage.setItem('fixtureRole','team_lead'));
 await page.goto('http://127.0.0.1:5173/admin/buy-requests');
 await page.getByText(/Fixture Buyer/).waitFor();await page.getByRole('button',{name:'View details',exact:true}).first().click();assert(await page.getByRole('button',{name:'Mark Sold',exact:true}).isDisabled());
 await page.goto('http://127.0.0.1:5173/admin/agent-submissions');
 await page.getByRole('button',{name:'View details',exact:true}).first().click();await page.getByRole('button',{name:'Approve & Publish'}).waitFor();assert(await page.getByRole('button',{name:'Approve & Publish'}).isEnabled());
 await page.evaluate(()=>sessionStorage.setItem('fixtureRole','buyer'));
 await page.goto('http://127.0.0.1:5173/cars/00000000-0000-0000-0000-000000000002');
 await page.getByRole('button',{name:'Buy Now — ₹1,23,000',exact:true}).first().click();
 await page.getByPlaceholder('Your phone number',{exact:true}).fill('9999999999');
 await page.evaluate(()=>window.failBuyOnce=true);
 await page.getByRole('button',{name:'Confirm — ₹1,23,000',exact:true}).click();
 await page.getByText('Connection lost. Retry to confirm.',{exact:true}).waitFor();
 assert.equal(await page.getByText('Request sent!',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Confirm — ₹1,23,000',exact:true}).click();
 await page.getByText('Request sent!',{exact:true}).waitFor();
 calls=await page.evaluate(()=>window.commandCalls.filter(c=>c.args?.p_action==='purchase_request'));
 assert.equal(calls.length,2);assert.equal(calls[0].args.p_operation_id,calls[1].args.p_operation_id);assert.equal(calls[0].args.p_payload.expected_price,123000);
 console.log('PASS mobile buyer purchase: listed Buy Now price, confirmed save and same-operation retry after uncertain response');
 assert.deepEqual(errors,[]);
 console.log('PASS mobile staff workflows: transactional review, purchase completion, team-lead review authority and read-only sales controls');
} finally {await browser.close();}
