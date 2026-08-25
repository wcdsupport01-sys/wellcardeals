import { useEffect, useState } from "react";

const getTimeLeft = (endTime) => {
  const diff = endTime - Date.now();
  if (diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, total: 0, isEnded: true };
  }
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { hours, minutes, seconds, total: diff, isEnded: false };
};

const useCountdown = (endTime) => {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(endTime));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(endTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  return timeLeft;
};

export default useCountdown;
