import { useEffect, useState } from "react";

/** 返回一个以 intervalMs 为周期更新的 now 时间戳，供 timeAgo 等用 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
