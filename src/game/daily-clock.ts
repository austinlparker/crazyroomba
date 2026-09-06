import { utcDay } from "./simulation";

/** Catch midnight and suspended tabs without changing an in-progress run's date. */
export function watchUtcDay(
  changed: (day: string) => void,
  day = utcDay(),
): () => void {
  const check = () => {
    if (document.hidden) return;
    const next = utcDay();
    if (next === day) return;
    day = next;
    changed(next);
  };
  const timer = window.setInterval(check, 1000);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("focus", check);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("focus", check);
  };
}
