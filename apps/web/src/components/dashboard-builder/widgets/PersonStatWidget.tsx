'use client';

import { useAnimatedCounter } from './useAnimatedCounter';

interface PersonStatWidgetProps {
  data?: {
    male?: number;
    female?: number;
    total?: number;
  };
  config?: Record<string, unknown>;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function PersonIcon({ gender, color }: { gender: string; color: string }) {
  return (
    <svg width="36" height="48" viewBox="0 0 36 48" fill="none">
      <circle cx="18" cy="10" r="8" fill={color} />
      <path d="M4 46c0-7.7 6.3-14 14-14s14 6.3 14 14" stroke={color} strokeWidth="4" fill="none" />
    </svg>
  );
}

export function PersonStatWidget({ data, config }: PersonStatWidgetProps) {
  const male = data?.male ?? 0;
  const female = data?.female ?? 0;
  const total = data?.total ?? (male + female);
  const animatedMale = useAnimatedCounter(male);
  const animatedFemale = useAnimatedCounter(female);
  const malePct = total > 0 ? ((male / total) * 100).toFixed(1) : '0';
  const femalePct = total > 0 ? ((female / total) * 100).toFixed(1) : '0';

  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-gray-400">No data</p>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center gap-8 p-4">
      <div className="flex flex-col items-center gap-1">
        <PersonIcon gender="female" color="#ec4899" />
        <p className="text-[9px] font-semibold capitalize text-gray-500">Female</p>
        <p className="text-lg font-black" style={{ color: '#ec4899' }}>{fmt(animatedFemale)}</p>
        <p className="text-[9px] text-gray-400">({femalePct}%)</p>
      </div>
      <div className="flex flex-col items-center gap-1">
        <PersonIcon gender="male" color="#3b82f6" />
        <p className="text-[9px] font-semibold capitalize text-gray-500">Male</p>
        <p className="text-lg font-black" style={{ color: '#3b82f6' }}>{fmt(animatedMale)}</p>
        <p className="text-[9px] text-gray-400">({malePct}%)</p>
      </div>
    </div>
  );
}
