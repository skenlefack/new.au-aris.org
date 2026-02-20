import React from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react';

export type QualityGateResult = 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';

export interface QualityGateItem {
  gate: string;
  result: QualityGateResult;
  message?: string;
}

export interface QualityIndicatorProps {
  overallResult: QualityGateResult;
  gates?: QualityGateItem[];
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface ResultConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

function getResultConfig(result: QualityGateResult, iconCls: string): ResultConfig {
  const configs: Record<QualityGateResult, ResultConfig> = {
    PASS: {
      label: 'Pass',
      color: 'text-green-700',
      bgColor: 'bg-green-500',
      icon: <CheckCircle2 className={iconCls} />,
    },
    WARNING: {
      label: 'Warning',
      color: 'text-amber-700',
      bgColor: 'bg-amber-500',
      icon: <AlertTriangle className={iconCls} />,
    },
    FAIL: {
      label: 'Fail',
      color: 'text-red-700',
      bgColor: 'bg-red-500',
      icon: <XCircle className={iconCls} />,
    },
    SKIPPED: {
      label: 'Skipped',
      color: 'text-gray-500',
      bgColor: 'bg-gray-400',
      icon: <MinusCircle className={iconCls} />,
    },
  };
  return configs[result];
}

const SIZE_MAP = {
  sm: { light: 'h-3 w-3', icon: 'h-3 w-3', text: 'text-xs', dot: 'h-2 w-2' },
  md: { light: 'h-4 w-4', icon: 'h-4 w-4', text: 'text-sm', dot: 'h-2.5 w-2.5' },
  lg: { light: 'h-5 w-5', icon: 'h-5 w-5', text: 'text-base', dot: 'h-3 w-3' },
} as const;

const GATE_LABELS: Record<string, string> = {
  COMPLETENESS: 'Completeness',
  TEMPORAL_CONSISTENCY: 'Temporal Consistency',
  GEOGRAPHIC_CONSISTENCY: 'Geographic Consistency',
  CODES_VOCABULARIES: 'Codes & Vocabularies',
  UNITS: 'Units',
  DEDUPLICATION: 'Deduplication',
  AUDITABILITY: 'Auditability',
  CONFIDENCE_SCORE: 'Confidence Score',
};

export const QualityIndicator: React.FC<QualityIndicatorProps> = ({
  overallResult,
  gates = [],
  showDetails = false,
  size = 'md',
  className,
}) => {
  const sizeConfig = SIZE_MAP[size];
  const overallConfig = getResultConfig(overallResult, sizeConfig.icon);

  return (
    <div data-testid="quality-indicator" className={cn('inline-flex flex-col', className)}>
      <div className={cn('flex items-center gap-1.5', overallConfig.color)}>
        <span
          data-testid="quality-light"
          className={cn('rounded-full', overallConfig.bgColor, sizeConfig.light)}
          aria-label={`Quality: ${overallConfig.label}`}
        />
        <span aria-hidden="true">{overallConfig.icon}</span>
        <span className={cn('font-medium', sizeConfig.text)}>{overallConfig.label}</span>
      </div>

      {showDetails && gates.length > 0 && (
        <div data-testid="quality-details" className="mt-2 space-y-1 pl-1">
          {gates.map((gate) => {
            const gateConfig = getResultConfig(gate.result, 'h-3 w-3');
            return (
              <div
                key={gate.gate}
                data-testid={`quality-gate-${gate.gate}`}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className={cn('rounded-full', gateConfig.bgColor, sizeConfig.dot)}
                />
                <span className={cn('font-medium', gateConfig.color)}>
                  {GATE_LABELS[gate.gate] ?? gate.gate}
                </span>
                {gate.message && (
                  <span className="text-gray-400">— {gate.message}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
