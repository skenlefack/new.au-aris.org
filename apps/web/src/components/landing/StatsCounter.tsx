'use client';

import { useEffect, useRef, useState } from 'react';

interface StatsCounterProps {
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
}

export function StatsCounter({
  value,
  label,
  suffix = '',
  prefix = '',
  duration = 2000,
  className = '',
  valueClassName = '',
  labelClassName = '',
}: StatsCounterProps) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          animateCount();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function animateCount() {
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return n.toLocaleString();
    return String(n);
  }

  return (
    <div ref={ref} className={`text-center ${className}`}>
      <p className={`text-3xl font-bold tracking-tight ${valueClassName}`}>
        {prefix}{formatNumber(count)}{suffix}
      </p>
      <p className={`mt-1 text-sm ${labelClassName}`}>{label}</p>
    </div>
  );
}
