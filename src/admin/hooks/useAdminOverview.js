import { useCallback,useEffect,useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
async function count(table,filter){let query=supabase.from(table).select('id',{count:'exact',head:true});for(const[k,v]of Object.entries(filter))query=query.eq(k,v);const {count,error}=await query;if(error)throw error;return count??0;}
export function useAdminOverview(role){
 const [snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true);
 const refresh=useCallback(()=>setRevision(n=>n+1),[]);
 useEffect(()=>{let active=true;(async()=>{setLoading(true);try{const manageable=['admin','manager'].includes(role);const [receipt,applications,agentSubmissions,pdi,recent]=await Promise.all([
 supabase.rpc('backend_staff_dashboard'),manageable?count('dealer_applications',{status:'pending'}):Promise.resolve(null),count('cars_catalog',{tl_review_status:'pending',status:'draft'}),count('pdi_requests',{status:'pending'}),supabase.from('cars_catalog').select('id,vehicle_title,year,thumbnail_url,listing_type,status,buy_now_price,base_price_dealer,starting_bid,created_at').order('created_at',{ascending:false}).limit(4)
 ]);if(receipt.error||!receipt.data)throw receipt.error||new Error('Dashboard data could not be verified.');if(recent.error)throw recent.error;if(!receipt.data.stats||!Array.isArray(receipt.data.chart)||!Array.isArray(receipt.data.pending_cars)||!['totalCars','liveAuctions','dealers','soldTotal','pendingBuyRequests','pendingAuctionRequests','negotiationQueue','needsFollowup'].every(key=>Number.isFinite(receipt.data.stats[key])&&receipt.data.stats[key]>=0))throw new Error('Workspace totals could not be verified.');if(active){setSnapshot({...receipt.data,pendingApplications:applications,pendingSubmissions:agentSubmissions,pendingPDI:pdi,recentCars:recent.data||[],loadedAt:new Date().toISOString()});setError('');}}catch(failure){if(active)setError(failure.message||'Workspace totals could not be loaded.');}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[role,revision]);
 useEffect(()=>{const focus=()=>{if(document.visibilityState==='visible')refresh();};window.addEventListener('wcd-admin-refresh',refresh);window.addEventListener('focus',focus);const interval=setInterval(focus,60000);return()=>{clearInterval(interval);window.removeEventListener('focus',focus);window.removeEventListener('wcd-admin-refresh',refresh);};},[refresh]);
 return {snapshot,error,loading,refresh};
}
export function attentionItems(snapshot,role){if(!snapshot?.stats)return [];const s=snapshot.stats;return [
 {title:'Dealer applications',description:'New businesses waiting for review',count:snapshot.pendingApplications,to:'/admin/dealer-applications',manage:true},
 {title:'Purchase requests',description:'Direct buyers waiting for contact',count:s.pendingBuyRequests,to:'/admin/buy-requests'},
 {title:'Agent submissions',description:'Vehicle details and inspection need review',count:snapshot.pendingSubmissions,to:'/admin/agent-submissions'},
 {title:'Sell requests',description:'Review listings and assign an agent',count:s.pendingAuctionRequests,to:'/admin/auction-requests'},
 {title:'Auction follow-up',description:'Ended auctions waiting for contact',count:s.needsFollowup,to:'/admin/bids'},
 {title:'Seller negotiations',description:'Vehicles waiting for a direct deal',count:s.negotiationQueue,to:'/admin/negotiate',manage:true},
 {title:'PDI requests',description:'Inspection bookings waiting for review',count:snapshot.pendingPDI,to:'/admin/pdi-requests'}
 ].filter(item=>(!item.manage||['admin','manager'].includes(role))&&item.count>0);}
