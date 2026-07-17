import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

const variantClasses: Record<string, string> = {
  default: 'bg-[#1F4E79] text-white',
  secondary: 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100',
  destructive: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  outline: 'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300',
};

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = 'Badge';

export { Badge };
