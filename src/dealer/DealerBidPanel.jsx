import { useCallback, useEffect, useRef, useState } from "react";
import { Gavel, RefreshCw, WifiOff, X } from "lucide-react";
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

const tones = {
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-900",
  gray: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-800",
};
export function BidStatus({ car, userId, myBid, now }) {
  const status = auctionStatus(car, userId, myBid, now);
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${tones[status.tone]}`}
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
    <section
      id="dealer-bidding"
      className="rounded-2xl bg-white p-5 text-slate-900 shadow-sm scroll-mt-24"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="font-bold flex items-center gap-2">
          <Gavel size={18} /> Dealer bidding
        </h2>
        <LinkBack />
      </div>
      <BidStatus car={car} userId={user.id} myBid={myBid} now={serverNow} />
      <div className="grid grid-cols-2 gap-3 my-4">
        <div>
          <p className="text-xs text-slate-500">Current highest bid</p>
          <p className="text-2xl font-bold">{money(car.current_bid_dealer)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Your last bid</p>
          <p className="text-xl font-semibold">{money(myBid?.amount)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Next minimum bid</p>
          <p className="font-semibold">{money(minimum)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Time remaining</p>
          <p className="font-mono font-semibold">
            {timeLeft(car.auction_end, serverNow)}
          </p>
        </div>
      </div>
      <div
        className={`rounded-xl p-3 text-xs mb-4 ${fresh ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-900"}`}
        aria-live="polite"
      >
        {!online ? (
          <span className="flex gap-2">
            <WifiOff size={14} /> Offline. Bidding paused.
          </span>
        ) : (
          syncError ||
          (fresh
            ? `${realtime ? "Live updates" : "Polling for updates"} · Verified ${age}s ago`
            : "Verifying the latest auction. Bidding is paused.")
        )}
        <button
          type="button"
          onClick={sync}
          className="ml-2 underline inline-flex items-center gap-1"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      {receipt && (
        <div
          role="status"
          className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 mb-4 text-sm text-emerald-900"
        >
          <strong>Bid saved: {money(receipt.amount)}</strong>
          <p>Bid ID: {receipt.bid_id}</p>
          <p>
            Accepted:{" "}
            {new Date(receipt.accepted_at).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })}{" "}
            IST
          </p>
        </div>
      )}
      {pending && (
        <div className="rounded-xl bg-amber-50 p-3 mb-4 text-sm">
          <p>
            Unconfirmed request: {money(pending.amount)}. Do not submit a
            different bid yet.
          </p>
          <button
            onClick={() => sendBid(pending)}
            disabled={busy || !online}
            className="mt-2 font-semibold underline disabled:opacity-50"
          >
            {busy ? "Checking bid…" : "Check / retry same bid"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 mb-3">
          {error}
        </p>
      )}
      {live ? (
        <>
          <p className="text-xs text-slate-500 mb-2">
            Choose a bid to review · minimum increment{" "}
            {money(car.minimum_increment || 5000)}
          </p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[0, 1, 4].map((extra) => {
              const amount =
                minimum + extra * Number(car.minimum_increment || 5000);
              return (
                <button
                  key={extra}
                  onClick={() => beginReview(amount)}
                  disabled={!fresh || busy || Boolean(pending)}
                  className="border border-blue-200 bg-blue-50 text-blue-800 rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
                >
                  {money(amount)}
                </button>
              );
            })}
          </div>
          <label
            className="block text-xs font-medium mb-1"
            htmlFor="dealer-bid-amount"
          >
            Your bid amount (₹)
          </label>
          <input
            id="dealer-bid-amount"
            type="number"
            inputMode="numeric"
            min={minimum}
            step="1"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            disabled={busy || Boolean(pending)}
            placeholder={String(minimum)}
            className="w-full rounded-xl border border-slate-300 px-3 py-3 mb-3"
          />
          <button
            onClick={() => beginReview(custom ? Number(custom) : minimum)}
            disabled={!fresh || busy || Boolean(pending)}
            className="w-full rounded-xl bg-blue-700 text-white py-3 font-semibold disabled:opacity-40"
          >
            Review bid {money(custom ? Number(custom) : minimum)}
          </button>
          <div
            className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 p-3 flex items-center justify-between gap-3 md:hidden shadow-lg"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <div className="text-xs">
              <span className="text-slate-500">Minimum bid</span>
              <p className="font-bold text-sm">{money(minimum)}</p>
            </div>
            <button
              onClick={() => beginReview(custom ? Number(custom) : minimum)}
              disabled={!fresh || busy || Boolean(pending)}
              className="rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white text-sm disabled:opacity-40"
            >
              Review bid
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-600">
          Bidding is closed. Being the highest bidder does not confirm a sale;
          the team must approve the deal.
        </p>
      )}
      <div className="mt-5 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold">
          Your bid history · {history.total} saved bids
        </h3>
        {history.recent.length > 0 ? (
          <ul className="divide-y divide-slate-100 mt-2">
            {history.recent.map((bid) => (
              <li
                key={bid.id}
                className="flex flex-wrap justify-between gap-2 py-2 text-xs"
              >
                <span className="text-slate-500">
                  #{bid.id} ·{" "}
                  {new Date(bid.created_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  IST
                </span>
                <strong>{money(bid.amount)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 mt-2">
            No saved bid history loaded.
          </p>
        )}
        {history.total > 5 && (
          <p className="text-xs text-slate-500 mt-2">
            Showing the latest 5 bids. Contact support for the complete record.
          </p>
        )}
      </div>
      {review !== null && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/70 flex items-center justify-center p-4"
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bid-review-title"
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-md text-slate-900">
            <div className="flex justify-between gap-3">
              <h2 id="bid-review-title" className="text-lg font-bold">
                Review your bid
              </h2>
              <button
                aria-label="Close bid review"
                disabled={busy || Boolean(pending)}
                onClick={() => setReview(null)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-600 my-3">{car.vehicle_title}</p>
            <p className="text-3xl font-bold mb-4">{money(review)}</p>
            <p className="text-sm mb-4">
              Minimum now: {money(minimum)}. Your bid is final once accepted.
              Auction result is subject to seller approval.
            </p>
            {(!fresh || review < minimum || !live) && (
              <p role="alert" className="text-sm text-red-700 mb-3">
                Auction status changed. Close this review and check the latest
                price.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700 mb-3">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                disabled={busy || Boolean(pending)}
                onClick={() => setReview(null)}
                className="flex-1 rounded-xl border py-3 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={
                  !fresh ||
                  !live ||
                  review < minimum ||
                  busy ||
                  Boolean(pending)
                }
                className="flex-1 rounded-xl bg-blue-700 text-white py-3 font-semibold disabled:opacity-40"
              >
                {busy ? "Confirming…" : "Confirm bid"}
              </button>
            </div>
            {pending && !busy && (
              <button
                disabled={!online}
                onClick={() => sendBid(pending)}
                className="mt-4 text-blue-700 underline"
              >
                Check / retry same bid
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function LinkBack() {
  return (
    <a href="/dealer/dashboard" className="text-xs text-blue-700 underline">
      My auctions
    </a>
  );
}
