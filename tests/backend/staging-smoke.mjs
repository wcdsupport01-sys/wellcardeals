// Explicit disposable staging test. Credentials arrive through stdin, never argv,
// source control, screenshots or logs. This never sends email/SMS or calls payments.
import assert from 'node:assert/strict';
import {randomUUID, randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
let input='';for await(const chunk of process.stdin)input+=chunk;
const {url,anonKey,serviceKey,expectedProject}=JSON.parse(input);input='';
assert.equal(expectedProject,'efxroxbhwfdwxlbtsaxp','Only the explicitly created disposable test project is allowed');
assert.equal(url,`https://${expectedProject}.supabase.co`);
for(const key of [anonKey,serviceKey])assert.equal(JSON.parse(Buffer.from(key.split('.')[1],'base64url')).ref,expectedProject,'Wrong project credentials');
const options={global:{fetch:(resource,init={})=>fetch(resource,{...init,signal:init.signal || AbortSignal.timeout(30000)})},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const service=createClient(url,serviceKey,options),anonymous=createClient(url,anonKey,options);
const run='wcd-test-'+randomUUID().slice(0,8),users=[],cars=[],requests=[],apps=[],objects=[],lookups=[];
const good=(result,label)=>{if(result.error)throw new Error(`${label}: ${result.error.code || ''} ${result.error.message}`);return result.data;};
const denied=(result,label)=>assert(result.error,`${label} must fail`);
async function account(label,role,status='approved'){
 const email=`${run}-${label}@example.invalid`,password=randomBytes(24).toString('base64url')+'!7aA';
 const user=good(await service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:`TEST ${label}`}}),'Create synthetic account').user;
 users.push(user.id);
 good(await service.from('profiles').upsert({id:user.id,role,status,email,full_name:`TEST ${label}`,phone:'9999999999',must_change_password:false}),'Seed synthetic profile');
 const client=createClient(url,anonKey,options),session=good(await client.auth.signInWithPassword({email,password}),'Real password login').session;
 return {id:user.id,email,password,client,session};
}
async function command(actor,action,payload,operation=randomUUID()){
 return actor.client.rpc('backend_car_command',{p_action:action,p_payload:payload,p_operation_id:operation});
}
async function edge(actor,name,body,operation=randomUUID()){
 const response=await fetch(`${url}/functions/v1/${name}`,{method:'POST',headers:{apikey:anonKey,Authorization:`Bearer ${actor?.session?.access_token || 'invalid-jwt'}`,'Content-Type':'application/json','Idempotency-Key':operation},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 let data;try{data=await response.json();}catch{data={error:'Non-JSON response'};}
 return {status:response.status,data,headers:response.headers};
}
async function edgeOk(actor,name,body,operation){const r=await edge(actor,name,body,operation);if(r.status!==200)throw new Error(`${name}: HTTP ${r.status} ${r.data?.error || 'failed'}`);return r.data;}
try{
 const admin=await account('admin','admin'),manager=await account('manager','manager'),lead=await account('lead','team_lead'),agent=await account('agent','agent'),buyer=await account('buyer','buyer'),other=await account('other','buyer'),dealer=await account('dealer','dealer'),pending=await account('pending','dealer','pending'),suspended=await account('suspended','admin','suspended');
 console.log('PASS staging: real Auth login and profiles for nine role/status accounts');
 assert.equal((await edge(null,'add-car',{vehicle_title:'Denied'})).status,401);
 for(const actor of [buyer,lead,pending,suspended])assert.equal((await edge(actor,'add-car',{vehicle_title:'Denied'})).status,403);
 denied(await buyer.client.from('profiles').update({role:'admin'}).eq('id',buyer.id),'Self promotion');
 const brand=good(await edgeOk(admin,'manage-lookup',{action:'insert',table:'brands',values:{name:run+' Brand'}}),'Lookup');
 // manage-lookup returns {data:{...}}, unlike PostgREST's {data,error}.
 const brandId=brand?.id;assert(brandId);lookups.push({table:'brands',id:brandId});
 const buyFields={vehicle_title:run+' Buyer car',brand_id:brandId,year:2020,listing_type:'buy_now_only',buy_now_price:100000,status:'live',visibility:'visible',access_type:'all',seller_phone:'private-seller',seller_name:'TEST private seller'};
 const operation=randomUUID(),created=await edgeOk(admin,'add-car',buyFields,operation),car=created.data.id;cars.push(car);
 assert.equal((await edgeOk(admin,'add-car',buyFields,operation)).data.id,car);
 const catalog=good(await anonymous.from('cars_catalog').select('*').eq('id',car).single(),'Anonymous catalog');assert.equal(catalog.seller_phone,null);assert.equal(Number(catalog.buy_now_price),100000);
 denied(await buyer.client.from('cars').select('seller_phone').eq('id',car),'Raw private fields');
 denied(await buyer.client.from('car_purchase_requests').insert({car_id:car,buyer_id:buyer.id}),'Direct purchase bypass');
 const requestPayload={car_id:car,phone:'9999999999',message:'TEST purchase enquiry',expected_price:100000},requestOp=randomUUID();
 const order=good(await command(buyer,'purchase_request',requestPayload,requestOp),'Buyer request').request;requests.push(order.id);
 assert.equal(good(await command(buyer,'purchase_request',requestPayload,requestOp),'Purchase retry').request.id,order.id);
 assert.equal(good(await command(buyer,'purchase_request',{...requestPayload,message:'Updated TEST enquiry'}),'Repeated enquiry').request.id,order.id);
 denied(await command(other,'purchase_request',{...requestPayload,expected_price:1}),'Stale price');
 const second=good(await command(other,'purchase_request',requestPayload),'Competing buyer request').request;requests.push(second.id);
 const completed=await Promise.all([command(admin,'purchase_complete',{id:order.id}),command(manager,'purchase_complete',{id:second.id})]);assert.equal(completed.filter(r=>!r.error).length,1);
 const sold=good(await service.from('cars').select('status,current_bid_buyer').eq('id',car).single(),'Sold car');assert.equal(sold.status,'sold');assert.equal(Number(sold.current_bid_buyer),100000);
 console.log('PASS staging: Edge auth/roles, catalog privacy, verified buyer request, retry/deduplication and competing sale completion');
 const auction=(await edgeOk(manager,'add-car',{vehicle_title:run+' Auction',listing_type:'auction',access_type:'dealer_only',status:'live',visibility:'visible',base_price_dealer:100000,buy_now_price:999999,minimum_increment:1000,auction_end:new Date(Date.now()+3600000).toISOString()})).data.id;cars.push(auction);
 assert.equal(good(await anonymous.from('cars_catalog').select('id').eq('id',auction),'Anonymous auction hiding').length,0);
 assert.equal(good(await buyer.client.from('cars_catalog').select('id').eq('id',auction),'Buyer auction hiding').length,0);
 const bidOp=randomUUID(),bid=good(await dealer.client.rpc('place_dealer_bid_v2',{p_car_id:auction,p_amount:101000,p_request_id:bidOp}),'Dealer bid');assert.equal(bid.amount,101000);assert.equal(bid.car.seller_phone,undefined);
 assert.equal(good(await dealer.client.rpc('place_dealer_bid_v2',{p_car_id:auction,p_amount:101000,p_request_id:bidOp}),'Bid retry').bid_id,bid.bid_id);
 for(const actor of [buyer,pending,suspended])denied(await actor.client.rpc('place_dealer_bid_v2',{p_car_id:auction,p_amount:102000,p_request_id:randomUUID()}),'Unapproved bid');
 good(await dealer.client.rpc('place_dealer_bid_v2',{p_car_id:auction,p_amount:102000,p_request_id:randomUUID()}),'Per-car bid increment');
 const update=await edge(admin,'update-car',{id:auction,base_price_dealer:1});assert(update.status>=400,'Accepted terms must be immutable');
 const early=await edge(admin,'mark-sold',{carId:auction,role:'dealer'});assert(early.status>=400,'Auction cannot close early');
 // Service-role setup changes only this run's auction to an ended clock.
 good(await service.from('cars').update({auction_end:new Date(Date.now()-60000).toISOString()}).eq('id',auction),'Close synthetic clock');
 good(await service.from('cars').update({current_bid_dealer:101000}).eq('id',auction),'Simulate stale standing cache');
 assert((await edge(admin,'mark-sold',{carId:auction,role:'dealer'})).status>=400,'A real lower bid cannot be accepted as the winner');
 good(await service.from('cars').update({current_bid_dealer:102000}).eq('id',auction),'Restore this test auction standing');
 await edgeOk(admin,'mark-sold',{carId:auction,role:'dealer'});
 const saleRows=good(await service.from('sheet_sync_queue').select('payload').eq('sheet_tab','Sales_Log').eq('row_key',auction),'Auction outbox');assert.equal(Number(saleRows.at(-1).payload.final_sale_price),102000);
 const audit=good(await admin.client.rpc('get_dealer_bid_audit_page',{p_limit:1}),'Staff bid audit');assert.equal(audit.rows.length,1);assert(audit.next_cursor);
 console.log('PASS staging: approved dealer bidding, UUID receipts, retry, custom increments, immutable terms, auction sale and correct outbox price');
 const request=good(await buyer.client.from('car_auction_requests').insert({buyer_id:buyer.id,buyer_name:'TEST Seller',buyer_phone:'9999999999',vehicle_title:run+' Agent submission'}).select().single(),'Seller listing request');requests.push(request.id);
 good(await manager.client.from('car_auction_requests').update({status:'approved',assigned_agent_id:agent.id,agent_status:'assigned',listing_type:'buy_now_only'}).eq('id',request.id),'Assign synthetic agent');
 const submitted=await edgeOk(agent,'agent-add-car',{requestId:request.id,vehicle_title:run+' Agent inspected car',buy_now_price:120000});const agentCar=submitted.data.id;cars.push(agentCar);assert.equal(submitted.data.visibility,'hidden');
 const reviewed=good(await command(lead,'agent_review',{id:agentCar,decision:'approved'}),'Team lead review');assert.equal(reviewed.car.status,'live');
 const agentQueue=good(await service.from('sheet_sync_queue').select('payload').eq('sheet_tab','Cars_Master').eq('row_key',agentCar).order('id',{ascending:true}).limit(1),'Assigned agent outbox');assert.equal(agentQueue[0].payload.assigned_agent_id,agent.id);
 // Private object HTTP API, not merely synthetic storage.objects rows.
 const object=buyer.id+'/'+run+'.pdf';objects.push(object);
 good(await buyer.client.storage.from('dealer-docs').upload(object,Buffer.from('%PDF-1.4\n% Synthetic permission test\n'),{contentType:'application/pdf'}),'Private document upload');
 good(await buyer.client.storage.from('dealer-docs').createSignedUrl(object,60),'Owner document signing');
 good(await admin.client.storage.from('dealer-docs').createSignedUrl(object,60),'Staff document signing');
 denied(await other.client.storage.from('dealer-docs').createSignedUrl(object,60),'Other buyer document signing');
 const publicResponse=await fetch(`${url}/storage/v1/object/public/dealer-docs/${object}`);assert.notEqual(publicResponse.status,200,'Private document cannot be public');
 console.log('PASS staging: seller request/assignment, agent Edge submission, team-lead review, durable agent mapping and private Storage HTTP access');
 // Dealer onboarding uses a new synthetic email and never changes an existing login.
 const application={id:randomUUID(),email:run+'-provisioned@example.invalid',dealer_name:'TEST Provisioned Dealer',business_name:'TEST dealership',business_address:'TEST Address',mobile_number:'9999999999'};apps.push(application.id);
 good(await anonymous.from('dealer_applications').insert(application),'Synthetic dealer application');
 const approval=await edgeOk(admin,'approve-dealer-application',{applicationId:application.id});
 const linked=good(await service.from('dealer_applications').select('*').eq('id',application.id).single(),'Approved application');assert.equal(linked.status,'approved');assert(linked.auth_user_id);users.push(linked.auth_user_id);
 const provisioned=createClient(url,anonKey,options);good(await provisioned.auth.signInWithPassword({email:application.email,password:approval.tempPassword}),'Provisioned dealer real login');
 const own=good(await provisioned.from('profiles').select('role,status,dealer_id').eq('id',linked.auth_user_id).single(),'Provisioned profile');assert.equal(own.role,'dealer');assert.equal(own.status,'approved');assert(own.dealer_id);
 assert.equal((await edge(admin,'approve-dealer-application',{applicationId:application.id})).status,409);
 const resetResponse=await edge(admin,'reset-user-password',{userId:manager.id});assert.equal(resetResponse.status,200);assert.equal(resetResponse.headers.get('cache-control'),'no-store');
 const reset=resetResponse.data;assert.match(reset.password,/./);
 good(await createClient(url,anonKey,options).auth.signInWithPassword({email:manager.email,password:reset.password}),'Synthetic password reset login');
 const contact={name:'TEST Contact',email:run+'@example.invalid',phone:'9999999999',message:'Synthetic staging contact'};
 good(await anonymous.from('contact_messages').insert(contact),'Public contact submission');
 const anonymousContacts=await anonymous.from('contact_messages').select('*');assert(anonymousContacts.error || anonymousContacts.data.length===0,'Anonymous contact read must be blocked');
 console.log('PASS staging: dealer provisioning, real dealer login, safe repeat approval, synthetic password reset and public form privacy');
 console.log('PASS: authenticated Supabase staging smoke; no production data, email/SMS, payments or external Sheet delivery exercised');
}finally{
 // Clean up only identifiers created by this exact run in this exact test project.
 if(objects.length)good(await service.storage.from('dealer-docs').remove(objects),'Clean test objects');
 if(cars.length){
  const histories=good(await service.from('car_price_status_history').select('id').in('car_id',cars),'Locate test price history');
  if(histories.length)good(await service.from('sheet_sync_queue').delete().in('row_key',histories.map(r=>r.id)),'Clean test history outbox');
  for(const table of ['car_bids','car_purchase_requests','car_auction_requests'])good(await service.from(table).delete().in('car_id',cars),'Clean '+table);
  good(await service.from('cars').delete().in('id',cars),'Clean test cars');
 }
 for(const table of ['car_auction_requests','car_purchase_requests'])if(requests.length)good(await service.from(table).delete().in('id',requests),'Clean requests');
 if(apps.length)good(await service.from('dealer_applications').delete().in('id',apps),'Clean applications');
 good(await service.from('contact_messages').delete().eq('email',run+'@example.invalid'),'Clean contact');
 if(users.length){
  good(await service.from('backend_audit_events').delete().in('actor_id',users),'Clean audit');
  good(await service.from('backend_operations').delete().in('actor_id',users),'Clean operations');
 }
 if(users.length || cars.length)good(await service.from('sheet_sync_queue').delete().in('row_key',[...users,...cars]),'Clean outbox');
 for(const lookup of lookups)good(await service.from(lookup.table).delete().eq('id',lookup.id),'Clean lookup');
 for(const id of users)good(await service.auth.admin.deleteUser(id),'Clean synthetic login');
 console.log('Cleaned this run\'s synthetic accounts, listings, requests, documents and operations.');
}
