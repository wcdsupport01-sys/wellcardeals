import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Car, Check,
  CheckCircle2, ChevronLeft, ChevronRight, Download, Expand,
  FileText, Fuel, Gauge, ImageIcon, MapPin, PlayCircle, RotateCw,
  Settings2, ShieldCheck, UserCheck, X,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { privateObjectPath } from "../lib/privateMedia";
import { INSPECTION_CATEGORIES } from "../admin/lib/lookups";
import CarCard from "../components/CarCard";
import DealerBidPanel from "./DealerBidPanel";
import { money } from "./auction";
import "./dealer-workspace.css";
import "./dealer-car-detail.css";

const TABS = [
  ["overview", "Overview"], ["inspection", "Inspection"],
  ["features", "Features"], ["documents", "Documents"], ["similar", "Similar cars"],
];
const FEATURE_GROUPS = [
  ["safety_features", "Safety"], ["comfort_features", "Comfort"],
  ["exterior_features", "Exterior"], ["interior_features", "Interior"],
  ["infotainment_features", "Infotainment"],
];
const CONDITION_LABELS = { good: "Good", fair: "Fair · review notes", poor: "Poor · review notes" };

function webUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, window.location.origin);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function useVehicleLabels(car) {
  const [labels, setLabels] = useState({});
  useEffect(() => {
    let active = true;
    const rows = [["fuel", "fuel_types", car.fuel_type_id], ["transmission", "transmissions", car.transmission_id]];
    Promise.all(rows.map(async ([key, table, id]) => {
      if (!id || !supabase) return [key, null];
      try {
        const { data, error } = await supabase.from(table).select("name").eq("id", id).maybeSingle().abortSignal(AbortSignal.timeout(10000));
        return [key, !error && typeof data?.name === "string" ? data.name : null];
      } catch { return [key, null]; }
    })).then((entries) => { if (active) setLabels({ fuelId: car.fuel_type_id, transmissionId: car.transmission_id, ...Object.fromEntries(entries) }); });
    return () => { active = false; };
  }, [car.fuel_type_id, car.transmission_id]);
  return {
    fuel: labels.fuelId === car.fuel_type_id ? labels.fuel : null,
    transmission: labels.transmissionId === car.transmission_id ? labels.transmission : null,
  };
}

function DealerDocument({ value, name }) {
  const reference = privateObjectPath(value, import.meta.env.VITE_SUPABASE_URL);
  const bucket = reference?.bucket, path = reference?.path;
  const [url, setUrl] = useState(() => reference ? null : webUrl(value));
  const [busy, setBusy] = useState(Boolean(reference));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!bucket || !path || !supabase) return;
    let active = true;
    async function resolve() {
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
        if (active) {
          const link = !error && webUrl(data?.signedUrl);
          setUrl(link || null); setFailed(!link); setBusy(false);
        }
      } catch {
        if (active) { setUrl(null); setFailed(true); setBusy(false); }
      }
    }
    resolve();
    const timer = setInterval(resolve, 540000);
    return () => { active = false; clearInterval(timer); };
  }, [bucket, path]);
  return (
    <div className="dealer-document-row">
      <span className="dealer-document-icon"><FileText size={20} aria-hidden="true" /></span>
      <div><strong>{name}</strong>{busy ? <p>Preparing document…</p> : failed ? <p role="alert">Unable to open this document. Please contact the team.</p> : !url ? <p>Document link unavailable.</p> : <p>Vehicle document</p>}</div>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${name}`}><Download size={16} aria-hidden="true" />Open</a>}
    </div>
  );
}

export default function DealerCarDetail({ car, user, onCarChange, actions, actionError, similarCars = [] }) {
  const [activeImage, setActiveImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [failedPhotos, setFailedPhotos] = useState({});
  const [tab, setTab] = useState("overview");
  const dialogRef = useRef(null);
  const detailsRef = useRef(null);
  const labels = useVehicleLabels(car);
  const images = [...new Set([car.thumbnail_url, ...(Array.isArray(car.images) ? car.images : [])].filter((value) => typeof value === "string" && value))];
  const index = images.length ? Math.min(activeImage, images.length - 1) : 0;
  const photo = images[index];
  const owner = car.ownership ? (/owner/i.test(car.ownership) ? car.ownership : `${car.ownership} owner`) : null;
  const checked = INSPECTION_CATEGORIES.map(({ key, label }) => {
    const entry = car.inspection?.[key];
    return { key, label, status: CONDITION_LABELS[entry?.status] ? entry.status : null, note: entry?.note };
  });
  const inspected = Boolean(car.inspected_at) && checked.some((entry) => entry.status);
  const checkedCount = checked.filter((entry) => entry.status).length;
  const features = FEATURE_GROUPS.map(([key, label]) => [label, Array.isArray(car[key]) ? car[key].filter(Boolean) : []]).filter(([, entries]) => entries.length);
  const documents = (Array.isArray(car.documents) ? car.documents : []).map((doc) => typeof doc === "string" ? { url: doc, name: "Vehicle document" } : doc).filter((doc) => doc && (doc.name || doc.url));
  const specs = [
    [CalendarDays, car.year, "Year"],
    [Gauge, car.mileage_km != null ? `${Number(car.mileage_km).toLocaleString("en-IN")} km` : null, "Driven"],
    [Fuel, labels.fuel, "Fuel"], [Settings2, labels.transmission, "Transmission"],
    [MapPin, car.registration_state || car.location, "Registration"], [UserCheck, owner, "Ownership"],
  ];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!lightbox) { dialog.close(); return; }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = overflow; };
  }, [lightbox]);

  function stepPhoto(step) {
    if (images.length) setActiveImage((current) => (Math.min(current, images.length - 1) + step + images.length) % images.length);
  }
  function showTab(next, scroll = false) {
    setTab(next);
    if (scroll) detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const overview = [
    ["Variant", car.variant], ["Manufacturing year", car.year], ["Registration year", car.registration_year],
    ["Kilometres driven", car.mileage_km != null ? `${Number(car.mileage_km).toLocaleString("en-IN")} km` : null],
    ["Fuel", labels.fuel], ["Transmission", labels.transmission], ["Ownership", owner],
    ["Registration", car.registration_state], ["Location", car.location], ["Insurance validity", car.insurance_validity],
    ["Starting price", money(car.base_price_dealer ?? car.starting_bid)], ["Minimum increment", money(car.minimum_increment || 5000)],
    ["Reserve floor", car.reserve_price != null ? money(car.reserve_price) : null],
    ["Auction closes", car.auction_end ? new Date(car.auction_end).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" : null],
    ["Engine capacity", car.engine_capacity], ["Power", car.horsepower ? `${car.horsepower} bhp` : null],
    ["Torque", car.torque], ["Seats", car.seating_capacity], ["Doors", car.doors],
    ["Service history", car.service_history], ["Accident history", car.accidental_history],
    ["RC status", car.rc_status], ["PUC status", car.puc_status], ["Keys available", car.number_of_keys],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
  const videos = (Array.isArray(car.videos) ? car.videos : []).map(webUrl).filter(Boolean);
  const views360 = (Array.isArray(car.images_360) ? car.images_360 : []).map(webUrl).filter(Boolean);

  return (
    <div className="dealer-detail-page">
      <nav className="dealer-detail-breadcrumb" aria-label="Breadcrumb"><Link to="/dealer/dashboard"><ArrowLeft size={12} aria-hidden="true" />Your auction desk</Link><ChevronRight size={11} aria-hidden="true" /><span>Vehicle details</span></nav>
      <div className="dealer-detail-heading">
        <div><p className="dealer-eyebrow">YOUR NEXT OPPORTUNITY</p><h1>{car.vehicle_title}</h1><p className="dealer-detail-subtitle">{car.variant && <span>{car.variant}</span>}{car.location && <span><MapPin size={13} aria-hidden="true" />{car.location}</span>}{owner && <span>{owner}</span>}</p></div>
        <div className="dealer-detail-actions">{actions}{actionError && <p role="alert">{actionError}</p>}</div>
      </div>
      <div className="dealer-detail-grid">
        <section className="dealer-detail-gallery" aria-label="Vehicle photo gallery">
          <div className="dealer-detail-photo-stage">
            {photo && !failedPhotos[photo] ? <button className="dealer-detail-image-button" onClick={() => setLightbox(true)} aria-label="View full-size vehicle photo"><img className="dealer-detail-main-photo" src={photo} alt={`${car.vehicle_title} — photo ${index + 1}`} onError={() => setFailedPhotos((current) => ({ ...current, [photo]: true }))} /><span className="dealer-detail-expand"><Expand size={14} aria-hidden="true" />Full screen</span></button> : <div className="dealer-detail-no-photo"><Car size={45} aria-hidden="true" /><span>{photo ? "This photo is unavailable" : "No vehicle photo available"}</span></div>}
            <div className="dealer-detail-photo-badges">{car.is_verified && <span><BadgeCheck size={12} aria-hidden="true" />Verified vehicle</span>}{inspected && <span><ShieldCheck size={12} aria-hidden="true" />Inspection available</span>}</div>
            {images.length > 1 && <><button className="dealer-detail-photo-prev" onClick={() => stepPhoto(-1)} aria-label="Previous vehicle photo"><ChevronLeft size={19} /></button><button className="dealer-detail-photo-next" onClick={() => stepPhoto(1)} aria-label="Next vehicle photo"><ChevronRight size={19} /></button></>}
          </div>
          <div className="dealer-detail-gallery-caption"><span><ImageIcon size={14} aria-hidden="true" />{images.length ? `Photo ${index + 1} of ${images.length}` : "Photos not added"}</span><button onClick={() => showTab("inspection", true)}>View inspection<ArrowRight size={13} aria-hidden="true" /></button></div>
          {images.length > 1 && <div className="dealer-detail-thumbnails" aria-label="Choose vehicle photo">{images.map((src, i) => <button key={`${src}-${i}`} aria-label={`Show photo ${i + 1} of ${images.length}`} aria-pressed={index === i} onClick={() => setActiveImage(i)}><img src={src} alt="" loading="lazy" /></button>)}</div>}
          {(videos.length > 0 || views360.length > 0) && <div className="dealer-detail-media-links">{views360.length > 0 && <a href={views360[0]} target="_blank" rel="noopener noreferrer"><RotateCw size={15} aria-hidden="true" />360° view</a>}{videos.length > 0 && <a href={videos[0]} target="_blank" rel="noopener noreferrer"><PlayCircle size={15} aria-hidden="true" />Watch video</a>}</div>}
        </section>
        <section className="dealer-detail-specs" aria-label="Vehicle highlights">{specs.map((item) => { const [Icon, value, label] = item; return <div className="dealer-detail-spec" key={label}><Icon size={16} aria-hidden="true" /><strong>{value ?? "Not specified"}</strong><small>{label}</small></div>; })}</section>
        <aside className="dealer-detail-bid-column" aria-label="Dealer bid controls"><DealerBidPanel key={`${car.id}:${user.id}`} car={car} onCarChange={onCarChange} /></aside>
        <section className="dealer-detail-information" ref={detailsRef} aria-label="Vehicle information">
          <div className="dealer-detail-tabs" role="tablist" aria-label="Vehicle information views">{TABS.map(([key, label]) => <button role="tab" id={`dealer-detail-tab-${key}`} key={key} tabIndex={tab === key ? 0 : -1} aria-selected={tab === key} aria-controls="dealer-detail-tabpanel" onClick={() => showTab(key)} onKeyDown={(event) => {
            const next = event.key === "ArrowRight" ? (TABS.findIndex(([value]) => value === key) + 1) % TABS.length : event.key === "ArrowLeft" ? (TABS.findIndex(([value]) => value === key) - 1 + TABS.length) % TABS.length : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : null;
            if (next !== null) { event.preventDefault(); showTab(TABS[next][0]); document.getElementById(`dealer-detail-tab-${TABS[next][0]}`)?.focus(); }
          }}>{label}{key === "inspection" && inspected && <span>{checkedCount} checks</span>}</button>)}</div>
          <div id="dealer-detail-tabpanel" role="tabpanel" aria-labelledby={`dealer-detail-tab-${tab}`}>
            {tab === "overview" && <div className="dealer-detail-info-card"><div className="dealer-detail-section-heading"><h2>Know the car before you bid.</h2><button onClick={() => showTab("inspection")}>View inspection<ArrowRight size={13} aria-hidden="true" /></button></div>{car.description && <p className="dealer-detail-description">{car.description}</p>}<dl className="dealer-detail-facts">{overview.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{Object.entries(car.specifications || {}).length > 0 && <><h3 className="dealer-detail-subheading">Additional specifications</h3><dl className="dealer-detail-facts">{Object.entries(car.specifications || {}).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl></>}</div>}
            {tab === "inspection" && <div className="dealer-detail-info-card"><div className="dealer-detail-section-heading"><h2>Inspection at a glance</h2>{inspected && <span className="dealer-detail-condition" data-condition="good"><CheckCircle2 size={12} aria-hidden="true" />Report available</span>}</div>{inspected ? <><p className="dealer-detail-note">{checkedCount} of {checked.length} categories checked · {new Date(car.inspected_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>{checked.map((entry) => <div className="dealer-detail-inspection-row" key={entry.key}><div><strong>{entry.label}</strong>{entry.note && <p>{entry.note}</p>}</div><span className="dealer-detail-condition" data-condition={entry.status || "unknown"}>{entry.status === "good" && <Check size={12} aria-hidden="true" />}{CONDITION_LABELS[entry.status] || "Not checked"}</span></div>)}{car.inspection_notes && <p className="dealer-detail-inspection-note">{car.inspection_notes}</p>}</> : <p className="dealer-detail-empty">Inspection report not available for this listing yet.</p>}</div>}
            {tab === "features" && <div className="dealer-detail-info-card"><div className="dealer-detail-section-heading"><h2>Vehicle features</h2></div>{features.length ? <div className="dealer-detail-feature-groups">{features.map(([label, entries]) => <div key={label}><h3>{label}</h3><ul>{entries.map((feature, i) => <li key={`${feature}-${i}`}><CheckCircle2 size={13} aria-hidden="true" />{feature}</li>)}</ul></div>)}</div> : <p className="dealer-detail-empty">No feature list added for this listing yet.</p>}</div>}
            {tab === "documents" && <div className="dealer-detail-info-card"><div className="dealer-detail-section-heading"><h2>Vehicle documents</h2></div>{documents.length ? <div className="dealer-detail-document-list">{documents.map((doc, i) => <DealerDocument key={`${doc.url || "missing"}-${i}`} value={doc.url} name={doc.name || `Vehicle document ${i + 1}`} />)}</div> : <div className="dealer-detail-empty-documents"><FileText size={30} aria-hidden="true" /><strong>No documents added.</strong><p>Registration, insurance and vehicle documents can be reviewed here when available.</p></div>}</div>}
            {tab === "similar" && <div className="dealer-detail-info-card"><div className="dealer-detail-section-heading"><h2>Similar cars</h2><Link to="/dealer/dashboard">All auctions<ArrowRight size={13} aria-hidden="true" /></Link></div>{similarCars.length ? <div className="dealer-detail-similar-grid">{similarCars.map((vehicle) => <CarCard key={vehicle.id} car={vehicle} isApprovedDealer />)}</div> : <p className="dealer-detail-empty">No similar listings available right now.</p>}</div>}
          </div>
        </section>
      </div>
      <div className="dealer-detail-page-footer"><span><ShieldCheck size={13} aria-hidden="true" />Review the vehicle and condition before confirming a bid.</span><Link to="/dealer/dashboard?tab=bids">View my auctions<ArrowRight size={13} aria-hidden="true" /></Link></div>
      <dialog ref={dialogRef} className="dealer-vehicle-lightbox" aria-label="Full-size vehicle photo" onCancel={() => setLightbox(false)} onClick={(event) => { if (event.target === event.currentTarget) setLightbox(false); }} onKeyDown={(event) => {
        if (event.key === "ArrowLeft") { event.preventDefault(); stepPhoto(-1); }
        if (event.key === "ArrowRight") { event.preventDefault(); stepPhoto(1); }
      }}><div className="dealer-vehicle-lightbox-content"><button className="dealer-vehicle-lightbox-close" onClick={() => setLightbox(false)} aria-label="Close full-size photo"><X size={21} /></button>{photo && <img src={photo} alt={`${car.vehicle_title} — full-size photo ${index + 1}`} />}{images.length > 1 && <div className="dealer-vehicle-lightbox-controls"><button onClick={() => stepPhoto(-1)} aria-label="Previous full-size photo"><ChevronLeft size={20} /></button><span>{index + 1} / {images.length}</span><button onClick={() => stepPhoto(1)} aria-label="Next full-size photo"><ChevronRight size={20} /></button></div>}</div></dialog>
    </div>
  );
}
