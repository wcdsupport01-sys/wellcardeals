import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Gavel, RefreshCw, ShieldCheck, WifiOff, X } from "lucide-react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import "./dealer-workspace.css";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import useAuctionClock from "./useAuctionClock";
import {
  auctionStatus,
  bidErrorMessage,
  definiteRejection,
  minimumBid,
  money,
  timeLeft,
} from "./auction";

export function BidStatus({ car, userId, myBid, now }) {
  const status = auctionStatus(car, userId, myBid, now);
  return (
    <span
      className="dealer-bid-status"
      data-tone={status.tone}
    >
      {status.label}
    </span>
  );
}

export default function DealerBidPanel({ car: initialCar, onCarChange }) {
  const { user } = useAuth();
  const storageKey = `dealer-pending-bid:${user.id}:${initialCar.id}`;
  const [car, setCar] = useState(initialCar);
  const [myBid, setMyBid] = useState(null);
  const [history, setHistory] = useState({ total: 0, recent: [] });
  const [custom, setCustom] = useState("");
  const [review, setReview] = useState(null);
  const [pending, setPending] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      return saved?.requestId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          saved.requestId,
        ) &&
        saved.carId === initialCar.id &&
        saved.userId === user.id &&
        Number.isSafeInteger(saved.amount)
        ? saved
        : null;
    } catch {
      return null;
    }
  });
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [lastSync, setLastSync] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const instant = useAuctionClock();
  const [realtime, setRealtime] = useState(false);
  const [clock, setClock] = useState(null);
  const dialogRef = useRef(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  const refreshing = useRef(null);
  const syncVersion = useRef(0);
  const currentCarId = useRef(initialCar.id);
  const callbacks = useRef({ onCarChange });
  useEffect(() => {
    callbacks.current = { onCarChange };
  }, [onCarChange]);

  const sync = useCallback(() => {
    if (refreshing.current) return refreshing.current;
    const version = syncVersion.current;
    const operation = (async () => {
      const carId = initialCar.id;
      const started = performance.now();
      try {
        const { data, error: failure } = await supabase
          .rpc("dealer_auction_snapshot", { p_car_id: carId })
          .abortSignal(AbortSignal.timeout(12000));
        if (failure) throw failure;
        if (!data?.car || !Number.isFinite(Date.parse(data.server_time)))
          throw new Error("Unable to verify auction status.");
        if (
          !mounted.current ||
          currentCarId.current !== carId ||
          version !== syncVersion.current
        )
          return;
        const received = performance.now();
        const delay = received - started;
        setClock({
          server: Date.parse(data.server_time) + delay / 2,
          received,
          delay,
        });
        setLastSync(received);
        setCar(data.car);
        setMyBid(data.my_bid);
        setHistory({
          total: data.my_bid_count ?? 0,
          recent: data.recent_bids ?? [],
        });
        setSyncError("");
        callbacks.current.onCarChange(data.car);
      } catch (failure) {
        if (
          mounted.current &&
          currentCarId.current === carId &&
          version === syncVersion.current
        )
          setSyncError(bidErrorMessage(failure));
      }
    })();
    refreshing.current = operation;
    operation.finally(() => {
      if (refreshing.current === operation) refreshing.current = null;
    });
    return operation;
  }, [initialCar.id]);

  useEffect(() => {
    mounted.current = true;
    currentCarId.current = initialCar.id;
    const initialSync = setTimeout(sync, 0);
    const polling = setInterval(sync, 10000);
    const connectivity = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) sync();
    };
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    const channel = supabase
      .channel(`dealer-bid-panel-${initialCar.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cars",
          filter: `id=eq.${initialCar.id}`,
        },
        sync,
      )
      .subscribe((status) => {
        if (mounted.current) {
          setRealtime(status === "SUBSCRIBED");
          if (status === "SUBSCRIBED") sync();
        }
      });
    return () => {
      mounted.current = false;
      clearTimeout(initialSync);
      clearInterval(polling);
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      supabase.removeChannel(channel);
    };
  }, [initialCar.id, sync]);

  useEffect(() => {
    if (review === null || !dialogRef.current) return;
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.focus();
    const keyboard = (event) => {
      if (event.key === "Escape" && !busy && !pending) setReview(null);
      if (event.key !== "Tab") return;
      const controls = [
        ...dialog.querySelectorAll(
          "button:not(:disabled), input:not(:disabled), a[href]",
        ),
      ];
      const first = controls[0],
        last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === dialog)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = originalOverflow;
      dialog.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, [review, busy, pending]);

  const serverNow = clock
    ? clock.server + Math.max(0, instant.mono - clock.received)
    : instant.wall;
  const age = lastSync
    ? Math.floor(Math.max(0, instant.mono - lastSync) / 1000)
    : Infinity;
  const fresh = online && !syncError && age < 15 && clock?.delay < 5000;
  const live =
    car.status === "live" && new Date(car.auction_end).getTime() > serverNow;
  const minimum = minimumBid(car);
  const storageRemove = () => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* safe to keep retry metadata */
    }
  };

  async function acceptReceipt(data) {
    if (!mounted.current) return;
    if (
      !data?.bid_id ||
      !data?.accepted_at ||
      !data?.car ||
      !Number.isFinite(Number(data.amount))
    )
      throw new Error("The server did not return a verified bid receipt.");
    syncVersion.current += 1;
    setReceipt(data);
    setPending(null);
    setReview(null);
    setCustom("");
    setError("");
    storageRemove();
    setCar(data.car);
    callbacks.current.onCarChange(data.car);
    if (refreshing.current) await refreshing.current;
    await sync();
  }

  async function sendBid(request) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      // Retry starts with receipt reconciliation, then reuses the SAME key. A null
      // receipt is not proof of failure: the first transaction may still be open.
      const prior = await supabase
        .rpc("dealer_bid_receipt", { p_request_id: request.requestId })
        .abortSignal(AbortSignal.timeout(12000));
      if (prior.error) throw prior.error;
      if (prior.data) {
        await acceptReceipt(prior.data);
        return;
      }
      const { data, error: failure } = await supabase
        .rpc("place_dealer_bid_v2", {
          p_car_id: request.carId,
          p_amount: request.amount,
          p_request_id: request.requestId,
        })
        .abortSignal(AbortSignal.timeout(15000));
      if (failure) throw failure;
      await acceptReceipt(data);
    } catch (failure) {
      if (!mounted.current) return;
      if (definiteRejection(failure)) {
        setPending(null);
        setReview(null);
        storageRemove();
        setError(bidErrorMessage(failure));
      } else {
        setError(
          "Bid confirmation is pending. Check / retry this same request before placing another bid.",
        );
      }
      await sync();
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function beginReview(amount) {
    setError("");
    if (!fresh || !live || pending || locked.current) return;
    if (!Number.isSafeInteger(amount) || amount < minimum) {
      setError(`Enter a whole-rupee amount of at least ${money(minimum)}.`);
      return;
    }
    setReview(amount);
  }

  function confirm() {
    if (!fresh || !live || review < minimum || locked.current) {
      setError("The auction changed. Refresh and review the latest minimum.");
      return;
    }
    const request = {
      requestId: crypto.randomUUID(),
      amount: review,
      carId: car.id,
      userId: user.id,
    };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(request));
    } catch {
      setError(
        "Browser storage is unavailable. Enable it before bidding so an interrupted bid can be recovered.",
      );
      return;
    }
    setReceipt(null);
    setPending(request);
    sendBid(request);
  }

  return (
    <section id="dealer-bidding" className="dealer-bid-panel">
      <div className="dealer-panel-heading">
        <div><p className="dealer-eyebrow">YOUR NEXT MOVE</p><h2><Gavel size={18} aria-hidden="true" />Dealer bidding</h2></div>
        <LinkBack />
      </div>
      <BidStatus car={car} userId={user.id} myBid={myBid} now={serverNow} />
      <div className="dealer-bid-metrics">
        <div className="dealer-current-bid"><p>Current highest bid</p><p>{money(car.current_bid_dealer)}</p></div>
        <div><p>Your last bid</p><p>{money(myBid?.amount)}</p></div>
        <div><p>Next minimum bid</p><p>{money(minimum)}</p></div>
        <div><p>Time remaining</p><p>{timeLeft(car.auction_end, serverNow)}</p></div>
      </div>
      <div className={`dealer-bid-sync${fresh ? "" : " is-stale"}`} aria-live="polite">
        {!online ? <span className="inline-flex items-center gap-2"><WifiOff size={14} />Offline. Bidding paused.</span> : (
          syncError || (fresh ? `${realtime ? "Live updates" : "Polling for updates"} · Verified ${age}s ago` : "Verifying the latest auction. Bidding is paused.")
        )}
        <button type="button" onClick={sync}><RefreshCw size={12} aria-hidden="true" />Refresh</button>
      </div>
      {receipt && (
        <div role="status" className="dealer-bid-receipt">
          <strong>Bid saved: {money(receipt.amount)}</strong>
          <p>Bid ID: {receipt.bid_id}</p>
          <p>Accepted: {new Date(receipt.accepted_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
        </div>
      )}
      {pending && (
        <div className="dealer-pending-bid">
          <p>Unconfirmed request: {money(pending.amount)}. Do not submit a different bid yet.</p>
          <button onClick={() => sendBid(pending)} disabled={busy || !online}>{busy ? "Checking bid…" : "Check / retry same bid"}</button>
        </div>
      )}
      {error && <p role="alert" className="dealer-bid-error">{error}</p>}
      {live ? (
        <>
          <p className="dealer-quick-bid-label">Choose a bid to review · minimum increment {money(car.minimum_increment || 5000)}</p>
          <div className="dealer-quick-bids">
            {[0, 1, 4].map((extra) => {
              const amount = minimum + extra * Number(car.minimum_increment || 5000);
              return <button key={extra} onClick={() => beginReview(amount)} disabled={!fresh || busy || Boolean(pending)}>{money(amount)}</button>;
            })}
          </div>
          <label className="dealer-bid-amount-label" htmlFor="dealer-bid-amount">Your bid amount (₹)</label>
          <input id="dealer-bid-amount" type="number" inputMode="numeric" min={minimum} step="1" value={custom} onChange={(e) => setCustom(e.target.value)} disabled={busy || Boolean(pending)} placeholder={String(minimum)} className="dealer-bid-amount-input" />
          <button onClick={() => beginReview(custom ? Number(custom) : minimum)} disabled={!fresh || busy || Boolean(pending)} className="dealer-primary-button">
            Review bid {money(custom ? Number(custom) : minimum)}<ArrowRight size={16} aria-hidden="true" />
          </button>
          <p className="dealer-bid-security-note"><ShieldCheck size={13} aria-hidden="true" />Your bid is only submitted after you review and confirm.</p>
          <div className="dealer-mobile-bid-bar" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            <div><span>Minimum bid</span><strong>{money(minimum)}</strong></div>
            <button onClick={() => beginReview(custom ? Number(custom) : minimum)} disabled={!fresh || busy || Boolean(pending)} className="dealer-primary-button">Review bid<ArrowRight size={14} aria-hidden="true" /></button>
          </div>
        </>
      ) : (
        <p className="text-sm leading-relaxed text-slate-600">Bidding is closed. Being the highest bidder does not confirm a sale; the team must approve the deal.</p>
      )}
      <div className="dealer-bid-history">
        <h3>Your bid history · {history.total} saved bids</h3>
        {history.recent.length > 0 ? (
          <ul>{history.recent.map((bid) => <li key={bid.id}><span>#{bid.id} · {new Date(bid.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</span><strong>{money(bid.amount)}</strong></li>)}</ul>
        ) : <p>No saved bid history loaded.</p>}
        {history.total > 5 && <p>Showing the latest 5 bids. Contact support for the complete record.</p>}
      </div>
      {review !== null && createPortal(
        <div className="dealer-review-overlay" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="bid-review-title">
          <div className="dealer-review-card">
            <p className="dealer-eyebrow">ONE LAST LOOK</p>
            <div className="dealer-review-heading">
              <h2 id="bid-review-title">Review your bid</h2>
              <button className="dealer-icon-button" aria-label="Close bid review" disabled={busy || Boolean(pending)} onClick={() => setReview(null)}><X size={18} /></button>
            </div>
            <p className="dealer-review-car">{car.vehicle_title}</p>
            <p className="dealer-review-amount">{money(review)}</p>
            <p className="dealer-review-terms">Minimum now: {money(minimum)}. Your bid is final once accepted. Auction result is subject to seller approval.</p>
            {(!fresh || review < minimum || !live) && <p role="alert" className="dealer-review-alert">Auction status changed. Close this review and check the latest price.</p>}
            {error && <p role="alert" className="dealer-review-alert">{error}</p>}
            <div className="dealer-review-actions">
              <button disabled={busy || Boolean(pending)} onClick={() => setReview(null)} className="dealer-secondary-button">Cancel</button>
              <button onClick={confirm} disabled={!fresh || !live || review < minimum || busy || Boolean(pending)} className="dealer-primary-button">{busy ? "Confirming…" : "Confirm bid"}</button>
            </div>
            {pending && !busy && <button disabled={!online} onClick={() => sendBid(pending)} className="dealer-retry-link">Check / retry same bid</button>}
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}

function LinkBack() {
  return <Link to="/dealer/dashboard" className="dealer-panel-back">My auctions</Link>;
}
