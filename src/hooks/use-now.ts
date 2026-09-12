import { useEffect, useState } from 'react';

/** fps 주기로 갱신되는 현재 시각 (애니메이션/진행률 표시용) */
export function useNow(fps = 10): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), Math.max(16, Math.round(1000 / fps)));
    return () => clearInterval(id);
  }, [fps]);
  return now;
}
