import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
export default function AdminDialog({title,children,onClose,wide=false,drawer=false,busy=false}){
 const ref=useRef(null),titleId=useId();
 useEffect(()=>{const node=ref.current;node.showModal();return()=>node.close();},[]);
 return <dialog ref={ref} className={`aw-dialog ${wide?'aw-dialog-wide':''} ${drawer?'aw-dialog-drawer':''}`} aria-labelledby={titleId} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><div className="aw-dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="aw-icon-button" disabled={busy} onClick={onClose} aria-label="Close dialog"><X size={19}/></button></div><div className="aw-dialog-body">{children}</div></dialog>;
}
