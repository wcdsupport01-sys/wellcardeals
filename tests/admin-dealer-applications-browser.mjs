// Actual admin screens and API logic; all Supabase operations are isolated fixtures.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/src/auth/AuthContext.jsx*',r=>r.fulfill({contentType:'application/javascript',body:`
const role=sessionStorage.getItem('fixtureRole')||'admin';
export const useAuth=()=>({user:{id:'staff-fixture'},session:{user:{id:'staff-fixture'}},role,profile:{id:'staff-fixture',role,status:'approved',full_name:'Fixture Admin'},loading:false,signOut:async()=>{}});
export const AuthProvider=({children})=>children;
export const AuthRecovery=()=>null;
`}));
await page.route('**/src/lib/supabaseClient.js*',r=>r.fulfill({contentType:'application/javascript',body:`
window.adminCalls=[];window.rejectMode='ok';window.approveMode='ok';
const applications=[{id:'pending-fixture',status:'pending',business_name:'Fixture Pending Motors',dealer_name:'Sample Contact',email:'pending@example.test',created_at:'2026-10-29T00:00:00Z'},{id:'approved-fixture',status:'approved',business_name:'Fixture Approved Motors',dealer_name:'Sample Contact',email:'approved@example.test',dealer_id:'DLR-FIXTURE',auth_user_id:'dealer-profile-fixture',created_at:'2026-10-28T00:00:00Z'}];
export const isSupabaseConfigured=true;
export const supabase={
functions:{invoke:async(name,args)=>{window.adminCalls.push({type:'approve',name,args});if(window.approveMode==='failure')return {error:{message:'Fixture approval failed'}};if(window.approveMode==='mismatch')return {data:{...applications[1],ok:true}};const a=applications[0];Object.assign(a,{status:'approved',dealer_id:'DLR-NEW',auth_user_id:'new-profile'});return {data:{...a,ok:true,tempPassword:'fixture-one-time-password'}};}},
from(table){let where=[],update=null,single=false;const q={select:()=>q,eq:(k,v)=>{where.push([k,v]);return q;},order:()=>q,limit:()=>q,in:()=>q,or:()=>q,update:v=>{update=v;return q;},maybeSingle:()=>{single=true;return q;},then(resolve,reject){let result;
if(update){window.adminCalls.push({type:'reject',table,where,update});if(window.rejectMode==='failure')result={data:null,error:{message:'Fixture rejection failed'}};else if(window.rejectMode==='race')result={data:null,error:null};else{const a=applications.find(a=>where.every(([k,v])=>a[k]===v));if(a)Object.assign(a,update);result={data:a||null,error:null};}}
else{let data=table==='dealer_applications'?applications.filter(a=>where.every(([k,v])=>a[k]===v)):table==='profiles'?[{id:'dealer-profile-fixture',dealer_id:'DLR-FIXTURE',role:'dealer',status:'approved',full_name:'Linked Fixture Dealer',business_name:'Fixture Approved Motors',email:'approved@example.test',created_at:'2026-10-28T00:00:00Z'}]:[];result={data:single?data[0]:data,count:data.length,error:null};}
return Promise.resolve(result).then(resolve,reject);}};return q;},
channel(){const c={on:()=>c,subscribe:()=>c};return c;},removeChannel(){}
};
`}));
const base='http://127.0.0.1:5173';
const load=async()=>{await page.goto(base+'/admin/dealer-applications');await page.getByText('Fixture Pending Motors',{exact:true}).waitFor();};
try {
await load();
await page.getByRole('button',{name:/^approved$/i}).click();
await page.getByText('Fixture Approved Motors',{exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:'Reject',exact:true}).count(),0);
assert.equal(await page.getByRole('button',{name:'Approve',exact:true}).count(),0);
assert.equal(await page.getByRole('link',{name:'Manage account',exact:true}).first().getAttribute('href'),'/admin/dealers?dealer=dealer-profile-fixture');
await page.getByRole('button',{name:'View Details',exact:true}).click();
assert.equal(await page.getByRole('button',{name:'Reject',exact:true}).count(),0);
await page.getByRole('link',{name:'Manage account',exact:true}).last().click();
await page.waitForURL(url=>url.pathname==='/admin/dealers');
await page.getByRole('heading',{name:'Manage Dealers',exact:true}).waitFor();
await page.getByText('Fixture Approved Motors',{exact:true}).waitFor();
assert.equal(await page.getByPlaceholder(/Search/i).inputValue(),'dealer-profile-fixture');
console.log('PASS approved application has no approve/reject actions; linked account opens and is found by profile ID');

await load();await page.getByRole('button',{name:'View Details',exact:true}).click();
await page.evaluate(()=>window.rejectMode='race');
await page.getByRole('button',{name:'Reject',exact:true}).last().click();
await page.getByRole('alert').filter({hasText:'no longer pending'}).waitFor();
assert.equal(await page.getByRole('button',{name:'Reject',exact:true}).last().isVisible(),true);
let call=await page.evaluate(()=>window.adminCalls[0]);assert.deepEqual(call.where,[['id','pending-fixture'],['status','pending']]);
assert.equal(await page.getByRole('heading',{name:'Dealer approved · Login credentials',exact:true}).count(),0);
await page.evaluate(()=>window.rejectMode='failure');await page.getByRole('button',{name:'Reject',exact:true}).last().click();
await page.getByRole('alert').filter({hasText:'Fixture rejection failed'}).waitFor();
assert.equal(await page.getByRole('button',{name:'Reject',exact:true}).last().isVisible(),true);
await page.evaluate(()=>window.rejectMode='ok');await page.getByRole('button',{name:'Reject',exact:true}).last().click();
await page.getByRole('button',{name:'Reject',exact:true}).last().waitFor({state:'hidden'});
console.log('PASS pending-only rejection, race and failure preserve review controls; verified rejection removes actions');

await load();await page.getByRole('button',{name:'View Details',exact:true}).click();
for(const mode of ['failure','mismatch']){await page.evaluate(m=>window.approveMode=m,mode);await page.getByRole('button',{name:'Approve',exact:true}).last().click();await page.getByRole('alert').filter({hasText:mode==='failure'?'Fixture approval failed':'could not be verified'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Dealer approved · Login credentials',exact:true}).count(),0);assert(await page.getByRole('button',{name:'Approve',exact:true}).last().isVisible());}
await page.evaluate(()=>window.approveMode='ok');await page.getByRole('button',{name:'Approve',exact:true}).last().click();
await page.getByRole('heading',{name:'Dealer approved · Login credentials',exact:true}).waitFor();assert.equal(await page.getByLabel('New password',{exact:true}).inputValue(),'fixture-one-time-password');
await page.getByRole('button',{name:'Done',exact:true}).click();assert.equal(await page.getByLabel('New password',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Reject',exact:true}).count(),0);
console.log('PASS approval transport failure and mismatched receipt do not fake success; valid receipt shows one-time credentials');
await page.evaluate(()=>sessionStorage.setItem('fixtureRole','manager'));await load();assert(await page.getByRole('button',{name:'Approve',exact:true}).isVisible());
await page.evaluate(()=>sessionStorage.setItem('fixtureRole','team_lead'));await page.goto(base+'/admin/dealer-applications');await page.waitForURL(url=>!url.pathname.includes('dealer-applications'));assert.equal(await page.getByRole('button',{name:'Approve',exact:true}).count(),0);
assert.deepEqual(errors,[]);console.log('PASS existing admin/manager access and team-lead restriction');
}finally{await browser.close();}
