import React from 'react';
import { cn } from '../../lib/utils';
import {
  FileEdit,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  BarChart3,
  Globe,
} from 'lucide-react';

export type WorkflowStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ESCALATED'
  | 'WAHIS_READY'
  | 'ANALYTICS_READY'
  | 'PUBLISHED';

export interface WorkflowStatusBadgeProps {
  status: WorkflowStatus;
  level?: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

interface StatusConfig {
  label: string;
  bgColor: string;
  textColor: string;
  icon: React.ReactNode;
}

const ICON_SIZE = { sm: 'h-3 w-3', md: 'h-3.5 w-3.5', lg: 'h-4 w-4' } as const;

function getStatusConfig(status: WorkflowStatus, iconSize: string): StatusConfig {
  const configs: Record<WorkflowStatus, StatusConfig> = {
    DRAFT: {
      label: 'Draft',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
      icon: <FileEdit className={iconSize} />,
    },
    SUBMITTED: {
      label: 'Submitted',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      icon: <Send className={iconSize} />,
    },
    PENDING_REVIEW: {
      label: 'Pending Review',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-700',
      icon: <Clock className={iconSize} />,
    },
    APPROVED: {
      label: 'Approved',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      icon: <CheckCircle2 className={iconSize} />,
    },
    REJECTED: {
      label: 'Rejected',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      icon: <XCircle className={iconSize} />,
    },
    ESCALATED: {
      label: 'Escalated',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-700',
      icon: <AlertTriangle className={iconSize} />,
    },
    WAHIS_READY: {
      label: 'WAHIS Ready',
      bgColor: 'bg-teal-100',
      textColor: 'text-teal-700',
      icon: <Shield className={iconSize} />,
    },
    ANALYTICS_READY: {
      label: 'Analytics Ready',
      bgColor: 'bg-emerald-100',
      textColor: 'text-emerald-700',
      icon: <BarChart3 className={iconSize} />,
    },
    PUBLISHED: {
      label: 'Published',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      icon: <Globe className={iconSize} />,
    },
  };
  return configs[status];
}

const SIZE_STYLES = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
  lg: 'px-3 py-1.5 text-sm gap-2',
} as const;

export const WorkflowStatusBadge: React.FC<WorkflowStatusBadgeProps> = ({
  status,
  level,
  size = 'md',
  showIcon = true,
  className,
}) => {
  const config = getStatusConfig(status, ICON_SIZE[size]);

  return (
    <span
      data-testid="workflow-status-badge"
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        config.bgColor,
        config.textColor,
        SIZE_STYLES[size],
        className,
      )}
    >
      {showIcon && <span aria-hidden="true">{config.icon}</span>}
      <span>{config.label}</span>
      {level !== undefined && (
        <span
          data-testid="workflow-level"
          className={cn(
            'ml-0.5 rounded-full bg-white/50 px-1.5 text-[10px] font-semibold',
            config.textColor,
          )}
        >
          L{level}
        </span>
      )}
    </span>
  );
};
