import { useEffect, useState } from "react";
import { ArrowRight, Car } from "lucide-react";
import { money } from "./auction";

// Uses the panel's current amount and guarded review handler. It never submits.
export default function DealerBidDock({ car, amount, disabled, onReview }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const action = document.querySelector("#dealer-bidding [data-main-review]");
        setVisible(window.innerWidth >= 900 && Boolean(action && action.getBoundingClientRect().bottom < 110));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const panel = document.getElementById("dealer-bidding");
    const observer = new ResizeObserver(update);
    if (panel) observer.observe(panel);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);
  return <div className="dealer-desktop-bid-dock" hidden={!visible}>
    <div className="dealer-dock-car"><Car size={23} aria-hidden="true" /><span><strong>{car.vehicle_title}</strong><small>Current highest bid {money(car.current_bid_dealer)}</small></span></div>
    <div className="dealer-dock-amount"><small>Your amount</small><strong>{money(amount)}</strong></div>
    <button type="button" className="dealer-primary-button" disabled={disabled} onClick={onReview}>Review bid<ArrowRight size={15} aria-hidden="true" /></button>
  </div>;
}
