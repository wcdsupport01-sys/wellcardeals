// Synthetic schema derived from the 2026-10-25 metadata, never customer rows.
// Reviewed live trigger bodies are included; managed Auth/Storage HTTP uses staging.
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
const container = `wcd-backend-test-${process.pid}`;
function docker(args, input) {
  const result = spawnSync('docker', args, {input, encoding:'utf8', timeout:60000});
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || String(result.error));
  return result.stdout.trim();
}
function sql(query) { return docker(['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'], query); }
function asyncSql(query) {
  return new Promise(resolve => {
    const p = spawn('docker',['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atq']); let out='',error='';
    p.stdout.on('data', c=>out+=c);p.stderr.on('data', c=>error+=c);
    p.on('exit', code=>resolve({code,out,error}));p.stdin.end(query);
  });
}
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const admin=id(1),manager=id(2),lead=id(3),agent=id(4),buyer=id(5),dealer=id(6),other=id(7),suspended=id(8),newDealer=id(9);
const literal = value => `'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
function as(actor,query,role='authenticated') {return `BEGIN; SET LOCAL ROLE ${role}; SET LOCAL request.jwt.claim.sub='${actor || ''}'; SET LOCAL request.jwt.claim.role='${role}'; ${query}; COMMIT;`;}
function cmd(actor,action,payload,operation=id(++serial)) {return as(actor,`SELECT public.backend_car_command('${action}',${literal(payload)},'${operation}')`);}
function ok(actor,action,payload,operation) {return JSON.parse(sql(cmd(actor,action,payload,operation)));}
function denied(actor,query,pattern) {assert.throws(()=>sql(as(actor,query)), pattern);}
let serial=500;
try {
  docker(['run','-d','--name',container,'-e','POSTGRES_PASSWORD=synthetic-local-test','postgres:16','-c','wal_level=logical']);
  for(let i=0;i<60;i++) {try {docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']);break;} catch {await new Promise(r=>setTimeout(r,250));}}
  sql(readFileSync('tests/backend/production-schema-fixture.sql','utf8'));
  sql(readFileSync('tests/backend/legacy-live-triggers.sql','utf8'));
  sql(readFileSync('supabase/dealer_auction_v2_migration.sql','utf8'));
  const releaseCheck=()=>JSON.parse(sql('BEGIN READ ONLY;'+readFileSync('supabase/backend_release_check.sql','utf8')+'COMMIT;'));
  assert.equal(releaseCheck().state,'commands_not_installed');
  sql(readFileSync('supabase/backend_commands_v3.sql','utf8'));
  assert.equal(releaseCheck().state,'commands_ready_access_pending');
  sql("GRANT SELECT(seller_phone) ON public.cars TO authenticated");
  sql(readFileSync('supabase/backend_access_v3.sql','utf8'));
  const release=releaseCheck();
  assert.equal(release.state,'database_checks_passed',JSON.stringify(release));
  assert.equal(release.edge_and_netlify,'not_checked');
  // Configuration drift must never be presented as a fully applied release.
  sql('ALTER TABLE public.car_purchase_requests DISABLE TRIGGER backend_request_guard');
  assert.equal(releaseCheck().access_checks.request_guards_active,false);
  assert.equal(releaseCheck().state,'commands_ready_access_pending');
  sql('ALTER TABLE public.car_purchase_requests ENABLE TRIGGER backend_request_guard');
  sql('GRANT SELECT(seller_phone) ON public.cars TO authenticated');
  assert.equal(releaseCheck().access_checks.raw_private_car_columns_blocked,false);
  sql('REVOKE SELECT(seller_phone) ON public.cars FROM authenticated');
  assert.equal(releaseCheck().state,'database_checks_passed');
  for (const [actor,role,status] of [[admin,'admin','approved'],[manager,'manager','approved'],[lead,'team_lead','approved'],[agent,'agent','approved'],[buyer,'buyer','approved'],[dealer,'dealer','approved'],[other,'buyer','approved'],[suspended,'admin','suspended']]) {
    sql(`INSERT INTO auth.users(id,email) VALUES('${actor}','user${actor.slice(-2)}@example.test'); INSERT INTO public.profiles(id,role,status,email) VALUES('${actor}','${role}','${status}','user${actor.slice(-2)}@example.test')`);
  }
  // Approved admin workspace: additive read-only activity, role checks and stable pagination.
  sql(readFileSync('supabase/admin_workspace_activity.sql','utf8'));
  sql(readFileSync('supabase/admin_workspace_activity.sql','utf8')); // Reapplying is safe.
  for(const actor of [buyer,dealer,agent,suspended]) denied(actor,'SELECT public.backend_staff_activity()',/Active staff/);
  assert.throws(()=>sql(as('', 'SELECT public.backend_staff_activity()', 'anon')),/permission denied/);
  assert.throws(()=>sql(as(admin,'SELECT public.backend_staff_activity(NULL,NULL,201)')),/Invalid activity/);
  assert.throws(()=>sql(as(admin,'SELECT public.backend_staff_activity(now(),NULL)')),/Invalid activity/);
  for(const actor of [admin,manager,lead]) assert.deepEqual(JSON.parse(sql(as(actor,'SELECT public.backend_staff_activity()'))).rows,[]);
  for(let n=1;n<=3;n++)sql(`INSERT INTO public.backend_audit_events(id,actor_id,action,entity_id,operation_id,details,created_at) VALUES('${id(8000+n)}','${admin}','update','fixture-${n}','${id(8100+n)}','{"status":"draft","password":"synthetic-never-return","seller_phone":"synthetic-private"}',now()-interval '1 day')`);
  const activity=JSON.parse(sql(as(admin,'SELECT public.backend_staff_activity(NULL,NULL,2)')));
  assert.equal(activity.rows.length,2);assert.equal(activity.rows[0].id,id(8003));assert(activity.next_cursor);
  assert.deepEqual(activity.rows[0].details,{status:'draft'});
  assert.equal(JSON.stringify(activity).includes('synthetic-never-return'),false);
  const activityNext=JSON.parse(sql(as(lead,`SELECT public.backend_staff_activity('${activity.next_cursor.time}','${activity.next_cursor.id}',2,'${activity.as_of}')`)));
  assert.deepEqual(activityNext.rows.map(r=>r.id),[id(8001)]);assert.equal(activityNext.next_cursor,null);
  assert.equal(sql('SELECT count(*) FROM public.backend_audit_events'),'3','reads must not mutate history');
  assert.equal(sql("SELECT has_table_privilege('authenticated','public.backend_audit_events','SELECT')"),'f');
  sql(`DELETE FROM public.backend_audit_events WHERE id IN ('${id(8001)}','${id(8002)}','${id(8003)}')`);
  console.log('PASS admin activity SQL: idempotent migration, staff-only access, redacted details, stable tie pagination and no raw table grants');
  assert.throws(()=>ok(buyer,'create',{fields:{vehicle_title:'Forbidden'}}),/cannot perform/);
  assert.throws(()=>ok(lead,'create',{fields:{vehicle_title:'Forbidden'}}),/cannot perform/);
  assert.throws(()=>ok(suspended,'create',{fields:{vehicle_title:'Forbidden'}}),/cannot perform/);
  const create={fields:{vehicle_title:'Direct buyer car',listing_type:'buy_now_only',buy_now_price:100000,status:'live',visibility:'visible',seller_phone:'secret-phone',seller_name:'secret-owner'}};
  const receipt=ok(admin,'create',create,id(100));const car=receipt.car_id;
  assert.equal(ok(admin,'create',create,id(100)).car_id,car);
  assert.equal(sql(`SELECT count(*) FROM public.backend_audit_events WHERE operation_id='${id(100)}'`),'1');
  assert.throws(()=>ok(admin,'create',{fields:{...create.fields,vehicle_title:'Changed'}},id(100)),/another command/);
  assert.equal(sql(as('',`SELECT count(*) FROM public.cars_catalog WHERE id='${car}'`,'anon')),'1');
  assert.equal(sql(as('',`SELECT coalesce(seller_phone,'MASKED') FROM public.cars_catalog WHERE id='${car}'`,'anon')),'MASKED');
  denied(buyer,`SELECT seller_phone FROM public.cars`,/permission denied/);
  denied(buyer,`UPDATE public.profiles SET role='admin' WHERE id='${buyer}'`,/Protected/);
  denied(dealer,`UPDATE public.profiles SET status='approved',dealer_id='FAKE' WHERE id='${dealer}'`,/Protected/);
  sql(`INSERT INTO auth.users(id) VALUES('${newDealer}')`);
  denied(newDealer,`INSERT INTO public.profiles(id,role,status) VALUES('${newDealer}','dealer','approved')`,/Invalid self-service/);
  sql(as(newDealer,`INSERT INTO public.profiles(id,role,status) VALUES('${newDealer}','dealer','pending')`));
  denied(newDealer,`UPDATE public.profiles SET status='approved' WHERE id='${newDealer}'`,/Protected/);
  sql(as(manager,`UPDATE public.profiles SET status='approved' WHERE id='${newDealer}'`));
  denied(buyer,`INSERT INTO public.car_purchase_requests(car_id,buyer_id,status) VALUES('${car}','${buyer}','completed')`,/permission denied/);
  assert.throws(()=>ok(dealer,'purchase_request',{car_id:car,phone:'9999999999',message:'',expected_price:100000}),/cannot perform/);
  assert.throws(()=>ok(buyer,'purchase_request',{car_id:car,phone:'9999999999',message:'',expected_price:1}),/Price changed/);
  const order1=ok(buyer,'purchase_request',{car_id:car,phone:'9999999999',message:'Contact me',expected_price:100000},id(101));
  assert.equal(ok(buyer,'purchase_request',{car_id:car,phone:'9999999999',message:'Contact me',expected_price:100000},id(101)).request.id,order1.request.id);
  const order2=ok(other,'purchase_request',{car_id:car,phone:'8888888888',message:'',expected_price:100000},id(102));
  const repeated=ok(buyer,'purchase_request',{car_id:car,phone:'9999999998',message:'Updated contact',expected_price:100000});
  assert.equal(repeated.request.id,order1.request.id);
  assert.equal(sql(`SELECT count(*) FROM public.car_purchase_requests WHERE car_id='${car}' AND buyer_id='${buyer}'`),'1');
  denied(manager,`UPDATE public.car_purchase_requests SET status='completed' WHERE id='${order1.request.id}'`,/verified purchase/);
  const results=await Promise.all([asyncSql(cmd(admin,'purchase_complete',{id:order1.request.id})),asyncSql(cmd(manager,'purchase_complete',{id:order2.request.id}))]);
  assert.equal(results.filter(r=>r.code===0).length,1,'one competing buyer must win');
  assert.equal(sql(`SELECT count(*) FROM public.car_purchase_requests WHERE car_id='${car}' AND status='completed'`),'1');
  assert.equal(sql(`SELECT status FROM public.cars WHERE id='${car}'`),'sold');
  assert.equal(sql(`SELECT payload->>'final_sale_price' FROM public.sheet_sync_queue WHERE sheet_tab='Sales_Log' AND row_key='${car}' ORDER BY id DESC LIMIT 1`),'100000');
  assert.throws(()=>ok(admin,'update',{id:car,fields:{buy_now_price:1}}),/Sold cars/);
  sql(`INSERT INTO public.car_auction_requests(id,buyer_id,status,assigned_agent_id,agent_status,listing_type,vehicle_title) VALUES('${id(103)}','${buyer}','approved','${agent}','assigned','buy_now_only','Assigned car')`);
  const assigned={request_id:id(103),fields:{vehicle_title:'Agent car',buy_now_price:120000}};
  const assignedResults=await Promise.all([asyncSql(cmd(agent,'agent_submit',assigned)),asyncSql(cmd(agent,'agent_submit',assigned))]);
  assert(assignedResults.every(r=>r.code===0),assignedResults.map(r=>r.error).join('\n'));
  const linked=sql(`SELECT car_id FROM public.car_auction_requests WHERE id='${id(103)}'`);
  assert.equal(sql("SELECT count(*) FROM public.cars WHERE vehicle_title='Agent car'"),'1');
  assert.equal(sql(`SELECT status||':'||tl_review_status FROM public.cars WHERE id='${linked}'`),'draft:pending');
  ok(lead,'agent_review',{id:linked,decision:'approved'});
  assert.equal(sql(`SELECT status||':'||access_type FROM public.cars WHERE id='${linked}'`),'live:all');
  assert.throws(()=>ok(lead,'agent_review',{id:linked,decision:'rejected',reason:'stale review'}),/Agent submission/);
  const standalone=ok(agent,'agent_submit',{fields:{vehicle_title:'Standalone',buy_now_price:200000}});
  assert.equal(standalone.car.tl_review_status,'pending');
  const auction=ok(admin,'create',{fields:{vehicle_title:'Dealer auction',listing_type:'auction',access_type:'dealer_only',visibility:'visible',status:'live',base_price_dealer:100000,buy_now_price:999999,minimum_increment:1000,auction_end:new Date(Date.now()+3600000).toISOString()}}).car_id;
  assert.equal(sql(as('',`SELECT count(*) FROM public.cars_catalog WHERE id='${auction}'`,'anon')),'0');
  assert.equal(sql(as(dealer,`SELECT count(*) FROM public.cars_catalog WHERE id='${auction}'`)),'1');
  const bid=JSON.parse(sql(as(dealer,`SELECT public.place_dealer_bid_v2('${auction}',101000,'${id(104)}')`)));
  assert.equal(bid.amount,101000);assert.equal(bid.car.seller_phone,undefined);
  ok(admin,'update',{id:auction,fields:{base_price_dealer:100000,buy_now_price:999999,minimum_increment:1000,auction_end:new Date(bid.car.auction_end).toISOString(),vehicle_title:'Edited description'}});
  assert.equal(sql(`SELECT current_bid_dealer FROM public.cars WHERE id='${auction}'`),'101000');
  sql(as(dealer,`SELECT public.place_dealer_bid_v2('${auction}',102000,'${id(108)}')`));
  assert.throws(()=>ok(admin,'update',{id:auction,fields:{base_price_dealer:1}}),/terms cannot change/);
  assert.throws(()=>ok(admin,'sale',{id:auction,track:'dealer'}),/Closed auction/);
  sql(`UPDATE public.cars SET auction_end=now()-interval '1 minute' WHERE id='${auction}'`);
  sql(`UPDATE public.cars SET current_bid_dealer=101000 WHERE id='${auction}'`);
  assert.throws(()=>ok(admin,'sale',{id:auction,track:'dealer'}),/verified highest bidder/);
  sql(`UPDATE public.cars SET current_bid_dealer=102000 WHERE id='${auction}'`);
  ok(admin,'sale',{id:auction,track:'dealer'});
  ok(admin,'sale',{id:auction,track:'dealer'});
  assert.equal(sql(`SELECT status FROM public.cars WHERE id='${auction}'`),'sold');
  assert.equal(sql(`SELECT payload->>'final_sale_price' FROM public.sheet_sync_queue WHERE sheet_tab='Sales_Log' AND row_key='${auction}' ORDER BY id DESC LIMIT 1`),'102000');
  assert.equal(sql(`SELECT payload->>'assigned_agent_id' FROM public.sheet_sync_queue WHERE sheet_tab='Cars_Master' AND row_key='${linked}' ORDER BY id LIMIT 1`),agent);
  assert.throws(()=>sql(as(buyer,'TRUNCATE public.cars CASCADE')),/permission denied/);
  assert.throws(()=>ok(admin,'sale',{id:auction,track:'buyer'}),/Direct buyer/);
  // Anonymous storage writes fail; own dealer docs + staff reads survive.
  assert.throws(()=>sql(as('',"INSERT INTO storage.objects(bucket_id,name) VALUES('car-media','anonymous/file.png')",'anon')),/row-level security/);
  sql(as(dealer,`INSERT INTO storage.objects(bucket_id,name) VALUES('dealer-docs','${dealer}/license.pdf')`));
  assert.equal(sql(as(buyer,"SELECT count(*) FROM storage.objects WHERE bucket_id='dealer-docs'")),'0');
  assert.equal(sql(as(manager,"SELECT count(*) FROM storage.objects WHERE bucket_id='dealer-docs'")),'1');
  assert.equal(sql("SELECT bool_and(NOT public) FROM storage.buckets WHERE id IN ('dealer-docs','sell-requests-media')"),'t');
  sql(as('',"INSERT INTO public.contact_messages(name,email,message) VALUES('Test','test@example.test','Hello')",'anon'));
  assert.throws(()=>sql(as('',"INSERT INTO public.dealer_applications(dealer_name,business_name,business_address,mobile_number,email,status) VALUES('Test','Business','Address','9999999999','test@example.test','approved')",'anon')),/start pending/);
  for(let n=0;n<9;n++) sql(as('',"INSERT INTO public.contact_messages(name,email,message) VALUES('Test','test@example.test','Hello')",'anon'));
  assert.throws(()=>sql(as('',"INSERT INTO public.contact_messages(name,email,message) VALUES('Test','test@example.test','Hello')",'anon')),/Too many requests/);
  // Only trusted Auth application bindings may be finalized.
  sql(`INSERT INTO public.dealer_applications(id,dealer_name,business_name,business_address,mobile_number,email) VALUES('${id(105)}','Test dealer','Business','Address','9999999999','new@example.test'); INSERT INTO auth.users(id,email) VALUES('${id(106)}','new@example.test')`);
  assert.throws(()=>ok(admin,'dealer_finalize',{application_id:id(105),auth_user_id:id(106)}),/not provisioned/);
  sql(`UPDATE auth.users SET raw_app_meta_data=jsonb_build_object('dealer_application_id','${id(105)}') WHERE id='${id(106)}'`);
  const approved=ok(admin,'dealer_finalize',{application_id:id(105),auth_user_id:id(106)});
  assert.equal(approved.status,'approved');assert.equal(sql(`SELECT status||':'||role FROM public.profiles WHERE id='${id(106)}'`),'approved:dealer');
  ok(manager,'archive',{id:linked});assert.equal(sql(`SELECT status FROM public.cars WHERE id='${linked}'`),'delisted');
  // Check metadata aggregation beyond the default 1000-row API cap.
  sql("INSERT INTO public.cars(vehicle_title) SELECT 'Bulk synthetic listing' FROM generate_series(1,1100)");
  const dashboard=JSON.parse(sql(as(admin,"SELECT public.backend_staff_dashboard()")));
  assert(dashboard.stats.totalCars>1100);assert.equal(dashboard.chart.length,14);
  const approvedProfile=ok(manager,'dealer_approve',{id:dealer});assert.match(approvedProfile.code,/^\d{6}$/);
  assert.equal(sql(as(dealer,"SELECT public.verify_dealer_access_code(NULL)")),'f');
  assert.equal(sql(as(dealer,`SELECT public.verify_dealer_access_code('${approvedProfile.code}')`)),'t');
  const lease=id(200),otherLease=id(201);
  assert.equal(sql(as('',`SELECT public.backend_sheet_lease('${lease}')`,'service_role')),'t');
  assert.equal(sql(as('',`SELECT public.backend_sheet_lease('${otherLease}')`,'service_role')),'f');
  assert.equal(sql(as('',`SELECT public.backend_sheet_lease('${lease}',true)`,'service_role')),'t');
  assert.equal(sql(as('',`SELECT public.backend_sheet_lease('${otherLease}')`,'service_role')),'t');
  denied(buyer,`SELECT public.backend_sheet_lease('${lease}')`,/permission denied/);
  sql(`INSERT INTO public.brands(id,name) VALUES('${id(300)}','Fixture Brand'); CREATE POLICY fixture_brands_public_read ON public.brands FOR SELECT USING(true)`);
  ok(admin,'create',{fields:{vehicle_title:'Public fixture',brand_id:id(300),listing_type:'buy_now_only',buy_now_price:100000,status:'live',visibility:'visible',seller_phone:'private-phone'}});
  if (process.env.BACKEND_REST_TEST === '1') {
    const rest=container+'-rest',secret='synthetic-local-backend-test-secret-over-32-chars';
    try {
      docker(['run','-d','--name',rest,'--network',`container:${container}`,'-e',`PGRST_DB_URI=postgres://postgres:synthetic-local-test@127.0.0.1:5432/postgres`,'-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${secret}`,'postgrest/postgrest:v13.0.7']);
      const ip=docker(['inspect','-f','{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}',container]);
      const base=`http://${ip}:3000`;
      for(let n=0;n<60;n++){try{const r=await fetch(base,{signal:AbortSignal.timeout(1000)});if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
      const token=actor=>{
        const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
        const body=Buffer.from(JSON.stringify({role:'authenticated',sub:actor,exp:Math.floor(Date.now()/1000)+300})).toString('base64url');
        return header+'.'+body+'.'+createHmac('sha256',secret).update(header+'.'+body).digest('base64url');
      };
      async function api(path,actor,options={}){
        const response=await fetch(base+path,{...options,headers:{...(actor?{Authorization:'Bearer '+token(actor)}:{}),...options.headers}});
        const body=await response.json();assert(response.ok,JSON.stringify(body));return body;
      }
      // All joins used by listing/detail clients must resolve through the view.
      const listings=await api('/cars_catalog?select=*,brands(name),models(name),fuel_types(name),transmissions(name),body_types(name)&status=eq.live');
      assert(listings.length>0);assert(listings.every(c=>c.seller_phone==null));assert.equal(listings[0].brands.name,'Fixture Brand');
      const adminListings=await api('/cars_catalog?select=*,brands(name)&limit=2',admin);assert.equal(adminListings.length,2);
      const dealerListings=await api('/cars_catalog?select=id,base_price_dealer&limit=2',dealer);assert(Array.isArray(dealerListings));
      const requests=await api('/car_purchase_requests?select=*,cars(vehicle_title,thumbnail_url)',buyer);assert.equal(requests.length,1);
      await api('/c2c_deal_requests?select=*,cars(id,vehicle_title,thumbnail_url)',admin);
      const report=await api('/rpc/backend_staff_dashboard',admin,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert(report.stats.totalCars>1100);
      console.log('PASS: PostgREST catalog FK embeds, anonymous masking, owner request embeds, dealer reads and report RPC');
    } finally {docker(['rm','-f',rest]);}
  }
  console.log('PASS: read-only release states/drift, transactions, concurrency, role/RLS, receipts, privacy, private storage, public forms and provisioning');
} finally { docker(['rm','-f',container]); }
