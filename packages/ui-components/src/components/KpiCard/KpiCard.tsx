import React from 'react';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: {
    direction: TrendDirection;
    value: string;
    label?: string;
  };
  icon?: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'accent';
  className?: string;
}

const VARIANT_STYLES = {
  default: 'border-gray-200 bg-white',
  primary: 'border-aris-primary-200 bg-aris-primary-50',
  secondary: 'border-aris-secondary-200 bg-aris-secondary-50',
  accent: 'border-aris-accent-200 bg-aris-accent-50',
} as const;

const TREND_STYLES = {
  up: 'text-green-700',
  down: 'text-red-700',
  neutral: 'text-gray-500',
} as const;

const TrendIcon: React.FC<{ direction: TrendDirection }> = ({ direction }) => {
  const iconProps = { className: 'h-4 w-4', 'aria-hidden': true as const };
  switch (direction) {
    case 'up':
      return <TrendingUp {...iconProps} />;
    case 'down':
      return <TrendingDown {...iconProps} />;
    case 'neutral':
      return <Minus {...iconProps} />;
  }
};

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  unit,
  trend,
  icon,
  variant = 'default',
  className,
}) => {
  return (
    <div
      data-testid="kpi-card"
      className={cn(
        'rounded-card border p-card shadow-sm transition-shadow hover:shadow-md',
        VARIANT_STYLES[variant],
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-kpi-label uppercase tracking-wider text-gray-500">
          {label}
        </span>
        {icon && (
          <span className="text-gray-400" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-kpi text-gray-900">{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>

      {trend && (
        <div className={cn('mt-3 flex items-center gap-1 text-sm', TREND_STYLES[trend.direction])}>
          <TrendIcon direction={trend.direction} />
          <span className="font-medium">{trend.value}</span>
          {trend.label && <span className="text-gray-500">{trend.label}</span>}
        </div>
      )}
    </div>
  );
};
