import { useState } from 'react';
import { Eye,EyeOff,Copy,Check } from 'lucide-react';
export default function CredentialField({label='New password',value,secret=false}){
 const [visible,setVisible]=useState(!secret),[copied,setCopied]=useState(false),[error,setError]=useState('');
 return <div className="aw-credential-field"><label>{label}</label><div><input readOnly aria-label={label} type={visible?'text':'password'} value={value||''} autoComplete="off" spellCheck={false}/></div><div className="aw-row-actions">{secret&&<button type="button" className="aw-button" onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={14}/>:<Eye size={14}/>}{visible?'Hide password':'Show password'}</button>}<button type="button" className="aw-button" disabled={!value} onClick={async()=>{try{await navigator.clipboard.writeText(value);setCopied(true);setError('');}catch{setVisible(true);setError('Select the value and copy it manually.');}}}>{copied?<Check size={14}/>:<Copy size={14}/>}{copied?'Copied':'Copy'}</button></div>{error&&<p role="status" className="aw-muted">{error}</p>}</div>;
}
