import { useEffect, useState, useRef } from 'react';

export function useAnimatedInteger(target, duration = 400) {
  const [value, setValue] = useState(target);
  const currentRef = useRef(target);
  currentRef.current = value;

  useEffect(() => {
    const start = currentRef.current;
    const diff = target - start;
    if (diff === 0) return;

    const t0 = performance.now();
    let raf;

    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - p) ** 3;
      const next = Math.round(start + diff * eased);
      currentRef.current = next;
      setValue(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
