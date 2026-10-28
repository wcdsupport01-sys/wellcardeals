import { useEffect, useRef } from "react";
import { ArrowRight, ShieldCheck, X } from "lucide-react";

export default function DealerGuideDialog({ open, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open) {
      dialog.close();
      return;
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="dealer-help-dialog"
      aria-labelledby="dealer-guide-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dealer-help-content">
        <button className="dealer-icon-button dealer-dialog-close" onClick={onClose} aria-label="Close bidding guide">
          <X size={18} />
        </button>
        <p className="dealer-eyebrow">BID WITH CLARITY</p>
        <h2 id="dealer-guide-title">A clearer way to your next deal.</h2>
        <p className="dealer-help-intro">Take a closer look before you make your move.</p>
        <ol className="dealer-help-steps">
          <li><span>1</span><div><h3>Get to know the car.</h3><p>Open an auction and review the photos, vehicle condition, inspection report and documents.</p></div></li>
          <li><span>2</span><div><h3>Choose your bid.</h3><p>Check the highest bid, next minimum and time remaining. Choose a quick amount or enter your own.</p></div></li>
          <li><span>3</span><div><h3>Review, then confirm.</h3><p>Check the vehicle and amount before submitting. An accepted bid has a saved receipt; an interrupted request can be checked before you bid again.</p></div></li>
        </ol>
        <p className="dealer-help-note"><ShieldCheck size={16} /> A highest bid is subject to seller approval.</p>
        <button className="dealer-primary-button" onClick={onClose}>Back to your auction desk <ArrowRight size={16} /></button>
      </div>
    </dialog>
  );
}
