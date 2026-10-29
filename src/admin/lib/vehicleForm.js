import { EMPTY_INSPECTION } from './lookups';
export const VEHICLE_SECTIONS = ['Vehicle Identity','Technical Specifications','Location & Compliance','Description & Notes','Inspection Report','Features','Specifications','Pricing & Auction','Visibility & Channel','Media'];
export const EMPTY_VEHICLE = {
 vehicle_title:'',brand_id:null,model_id:null,variant:'',year:'',registration_year:'',mileage_km:'',fuel_type_id:null,transmission_id:null,body_type_id:null,color_id:null,category_id:null,ownership:'1st',vin_number:'',engine_number:'',engine_capacity:'',horsepower:'',torque:'',drive_type:'FWD',seating_capacity:'',doors:'',location:'',registration_state:'',insurance_validity:'',rc_status:'Clear',puc_status:'',service_history:'',accidental_history:'',number_of_keys:'',finance_status:'No Loan',description:'',seller_notes:'',safety_features:[],comfort_features:[],exterior_features:[],interior_features:[],infotainment_features:[],reserve_price:'',starting_bid:'',base_price_buyer:'',base_price_dealer:'',buy_now_price:'',minimum_increment:5000,auction_start:'',auction_end:'',status:'draft',visibility:'hidden',channel:'buyer',listing_type:'buy_now_only',access_type:'all',c2c_enabled:false,is_featured:false,is_verified:false,inspection:EMPTY_INSPECTION,inspection_notes:''
};
export const AUCTION_TERMS = ['base_price_buyer','base_price_dealer','starting_bid','reserve_price','minimum_increment','auction_start','auction_end','listing_type','channel','access_type'];
const NUMBERS=['year','registration_year','mileage_km','horsepower','seating_capacity','doors','number_of_keys','reserve_price','starting_bid','base_price_buyer','base_price_dealer','buy_now_price','minimum_increment'];
function localTime(value){if(!value)return '';const d=new Date(value);return Number.isNaN(d.getTime())?'':new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export function initialVehicle(car){
 const v={...EMPTY_VEHICLE};
 if(car)for(const key of Object.keys(v))if(car[key]!=null)v[key]=car[key];
 if(car){v.auction_start=localTime(car.auction_start);v.auction_end=localTime(car.auction_end);}
 v.inspection={...EMPTY_INSPECTION,...(car?.inspection||{})};
 for(const key of ['safety_features','comfort_features','exterior_features','interior_features','infotainment_features'])v[key]=Array.isArray(v[key])?[...v[key]]:[];
 return v;
}
export function validateVehicle(v,{car,bidCount=0,specRows=[]}={}){
 const fail=(message,section=0)=>({message,section});
 if(car?.status==='sold')return fail('Sold vehicles retain their confirmed sale record. Use Inventory to manage visibility.');
 if(!v.vehicle_title?.trim())return fail('Vehicle title is required.');
 if(!v.brand_id)return fail('Pick a brand.');
 for(const key of NUMBERS){if(v[key]===''||v[key]==null)continue;const n=Number(v[key]);if(!Number.isFinite(n)||n<0||n>Number.MAX_SAFE_INTEGER)return fail('Enter a valid value for '+key.replaceAll('_',' ')+'.',key.includes('price')||['starting_bid','minimum_increment'].includes(key)?7:0);}
 for(const key of ['year','registration_year','mileage_km','seating_capacity','doors','number_of_keys'])if(v[key]!==''&&v[key]!=null&&!Number.isInteger(Number(v[key])))return fail(key.replaceAll('_',' ')+' must be a whole number.');
 if(v.year&&(Number(v.year)<1900||Number(v.year)>new Date().getFullYear()+1))return fail('Enter a valid manufacturing year.');
 if(v.year&&v.registration_year&&Number(v.registration_year)<Number(v.year))return fail('Registration year cannot be before manufacturing year.');
 if(v.listing_type==='buy_now_only'&&!(Number(v.buy_now_price)>0))return fail('Enter a Buy Now price greater than zero.',7);
 if(v.listing_type==='auction'&&!(Number(v.base_price_dealer)>0||Number(v.starting_bid)>0))return fail('Enter a dealer base price or starting bid greater than zero.',7);
 if(!(Number(v.minimum_increment)>0)||!Number.isInteger(Number(v.minimum_increment)))return fail('Minimum increment must be a positive whole number.',7);
 if(v.auction_start&&v.auction_end&&v.auction_start>=v.auction_end)return fail('Auction end must be after auction start.',7);
 if(v.status==='sold')return fail('Use the purchase or auction sale confirmation action to mark a vehicle sold.',8);
 const initial=initialVehicle(car);
 if(car&&bidCount>0&&AUCTION_TERMS.some(k=>String(v[k]??'')!==String(initial[k]??'')))return fail('Auction terms cannot change after bids exist. Vehicle details and media can still be edited.',7);
 const specs=specRows.map(r=>r.key.trim()).filter(Boolean);if(new Set(specs).size!==specs.length)return fail('Use a unique name for every specification.',6);
 return null;
}
function comparable(value){return JSON.stringify(value??null);}
export function vehiclePayload(form,{car,specRows,media}){
 const initial=initialVehicle(car);const payload={};
 for(const key of Object.keys(EMPTY_VEHICLE)){
  if(car&&comparable(form[key])===comparable(initial[key]))continue;
  let value=form[key];
  if(NUMBERS.includes(key))value=value===''||value==null?null:Number(value);
  else if(['auction_start','auction_end'].includes(key))value=value?new Date(value).toISOString():null;
  else if(key==='insurance_validity')value=value||null;
  payload[key]=value;
 }
 // Preserve all existing values not edited; never send catalog joins or winner-tracking columns.
 if(!car){payload.access_type=form.listing_type==='auction'?'dealer_only':'all';payload.channel=form.listing_type==='auction'?'dealer':'buyer';if(form.listing_type==='buy_now_only'){payload.auction_start=null;payload.auction_end=null;payload.reserve_price=null;payload.starting_bid=null;payload.base_price_dealer=null;payload.base_price_buyer=Number(form.base_price_buyer||form.buy_now_price);}else payload.base_price_dealer=Number(form.base_price_dealer||form.starting_bid);}
 const specs=Object.fromEntries(specRows.filter(r=>r.key.trim()).map(r=>[r.key.trim(),r.value]));
 if(!car||comparable(specs)!==comparable(car.specifications||{}))payload.specifications=specs;
 for(const [key,value] of Object.entries(media))if(!car||comparable(value)!==comparable(car[key]??(key==='thumbnail_url'?null:[])))payload[key]=value;
 return payload;
}
