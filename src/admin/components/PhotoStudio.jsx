import { useState } from "react";
import { ImagePlus, Sticker, Loader2 } from "lucide-react";
import { uploadCarFile } from "../lib/carsApi";
const WCD_LOGO_URL = "/wcd-plate-logo.png";

function loadCanvasImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Image load failed: ${url}`));

    image.src = url;
  });
}

async function createWCDStickerFile(
  imageUrl,
  position,
  stickerWidth
) {
  const [photo, logo] = await Promise.all([
    loadCanvasImage(imageUrl),
    loadCanvasImage(WCD_LOGO_URL)
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = photo.naturalWidth;
  canvas.height = photo.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");

  ctx.drawImage(photo, 0, 0);

  // White branded plate, ratio 2.5:1
  const width = canvas.width * stickerWidth;
  const height = width / 2.5;

  const centerX = position.x * canvas.width;
  const centerY = position.y * canvas.height;

  const x = Math.max(
    0,
    Math.min(canvas.width - width, centerX - width / 2)
  );

  const y = Math.max(
    0,
    Math.min(canvas.height - height, centerY - height / 2)
  );

  ctx.save();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, width, height);

  ctx.strokeStyle = "#16449a";
  ctx.lineWidth = Math.max(2, width * 0.012);
  ctx.strokeRect(x, y, width, height);

  // Original logo, without distortion
  const padding = width * 0.025;
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;

  const scale = Math.min(
    availableWidth / logo.naturalWidth,
    availableHeight / logo.naturalHeight
  );

  const logoWidth = logo.naturalWidth * scale;
  const logoHeight = logo.naturalHeight * scale;

  ctx.drawImage(
    logo,
    x + (width - logoWidth) / 2,
    y + (height - logoHeight) / 2,
    logoWidth,
    logoHeight
  );

  ctx.restore();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error("Sticker export failed.")),
      "image/jpeg",
      0.95
    );
  });

  return new File(
    [blob],
    `wcd-sticker-${Date.now()}.jpg`,
    { type: "image/jpeg" }
  );
}

// ============================================================
// ADVANCED EDIT CAR + WCD PHOTO STICKER
// ============================================================


export default function PhotoStudio({images,onChange,onBusyChange}) {
 const [index,setIndex]=useState(0),[position,setPosition]=useState({x:.5,y:.72}),[scale,setScale]=useState(.24),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const selected=images[index] || images[0];
 async function run(work){setBusy(true);onBusyChange?.(true);setError("");try{await work();}catch(failure){setError(failure.message||"Photo could not be saved.");}finally{setBusy(false);onBusyChange?.(false);}}
 return <section className="aw-photo-studio"><h4>WCD Photo Studio</h4><p>Choose a photo, position the plate branding and apply it. Save the vehicle to confirm your changes.</p><label className="aw-button"><ImagePlus size={15}/>Add photos to studio<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} className="sr-only" onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value="";run(async()=>{const urls=[];for(const file of files)urls.push(await uploadCarFile(file,"photos"));onChange([...images,...urls]);});}}/></label>
 {images.length>0&&<><select aria-label="Photo for WCD branding" value={index} disabled={busy} onChange={e=>setIndex(Number(e.target.value))}>{images.map((url,i)=><option key={url+i} value={i}>Photo {i+1}</option>)}</select><div className="aw-studio-image" role="button" tabIndex={0} aria-label="Position WCD branding on photo" onKeyDown={e=>{if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){e.preventDefault();setPosition(p=>({x:Math.max(.2,Math.min(.8,p.x+(e.key==="ArrowRight"?.02:e.key==="ArrowLeft"?-.02:0))),y:Math.max(.1,Math.min(.9,p.y+(e.key==="ArrowDown"?.02:e.key==="ArrowUp"?-.02:0)))}));}}} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setPosition({x:Math.max(scale/2,Math.min(1-scale/2,(e.clientX-r.left)/r.width)),y:Math.max(.06,Math.min(.94,(e.clientY-r.top)/r.height))});}}><img src={selected} alt="Selected vehicle photo"/><img className="aw-plate-overlay" src={WCD_LOGO_URL} alt="WCD plate position" style={{left:position.x*100+"%",top:position.y*100+"%",width:scale*100+"%"}}/></div><label>Sticker size: {Math.round(scale*100)}%<input type="range" min=".12" max=".5" step=".01" value={scale} disabled={busy} onChange={e=>setScale(Number(e.target.value))}/></label><button type="button" className="aw-button aw-primary" disabled={busy} onClick={()=>run(async()=>{const file=await createWCDStickerFile(selected,position,scale);const url=await uploadCarFile(file,"wcd-stickers");onChange(images.map((value,i)=>i===(images[index]?index:0)?url:value));})}>{busy?<Loader2 size={15} className="animate-spin"/>:<Sticker size={15}/>}Apply WCD sticker</button></>}
 {error&&<p role="alert" className="text-red-600">{error}</p>}</section>;
}
