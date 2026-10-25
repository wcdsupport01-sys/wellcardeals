import { useEffect, useState } from "react";

// Monotonic elapsed time keeps a changed device clock from extending an auction.
export default function useAuctionClock() {
  const [instant, setInstant] = useState(() => ({
    mono: performance.now(),
    wall: Date.now(),
  }));
  useEffect(() => {
    const timer = setInterval(
      () => setInstant({ mono: performance.now(), wall: Date.now() }),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  return instant;
}
