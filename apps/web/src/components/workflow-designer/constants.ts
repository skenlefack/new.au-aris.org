import React from 'react';
import {
  Play,
  Square,
  CheckCircle2,
  Diamond,
  GitFork,
  Merge,
  Bell,
} from 'lucide-react';
import type { NodeKind, EdgeKind } from './types';

// ══════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════

export const ROLES = [
  'SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'REC_ADMIN', 'NATIONAL_ADMIN',
  'DATA_STEWARD', 'WAHIS_FOCAL_POINT', 'ANALYST', 'FIELD_AGENT',
  'KNOWLEDGE_MANAGER', 'NATIONAL_LABORATORY', 'REGIONAL_LABORATORY',
  'CONTINENTAL_LABORATORY', 'PAID_ADMIN',
];

export const ROLE_I18N_KEYS: Record<string, string> = {
  SUPER_ADMIN: 'superAdmin',
  CONTINENTAL_ADMIN: 'continentalAdmin',
  REC_ADMIN: 'recAdmin',
  NATIONAL_ADMIN: 'nationalAdmin',
  DATA_STEWARD: 'dataSteward',
  WAHIS_FOCAL_POINT: 'wahisFocalPoint',
  ANALYST: 'analyst',
  FIELD_AGENT: 'fieldAgent',
  KNOWLEDGE_MANAGER: 'knowledgeManager',
  NATIONAL_LABORATORY: 'nationalLab',
  REGIONAL_LABORATORY: 'regionalLab',
  CONTINENTAL_LABORATORY: 'continentalLab',
  PAID_ADMIN: 'paidAdmin',
};

export const LEVEL_CONFIG: Record<string, { i18nKey: string; color: string; bg: string; border: string; darkBg: string }> = {
  NATIONAL_TECHNICAL:      { i18nKey: 'nationalTechnical',      color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-400',   darkBg: 'dark:bg-blue-900/20' },
  NATIONAL_OFFICIAL:       { i18nKey: 'nationalOfficial',       color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-400',  darkBg: 'dark:bg-amber-900/20' },
  REC_HARMONIZATION:       { i18nKey: 'recHarmonization',       color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-400', darkBg: 'dark:bg-purple-900/20' },
  CONTINENTAL_PUBLICATION: { i18nKey: 'continentalPublication', color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-400',    darkBg: 'dark:bg-red-900/20' },
  national:                { i18nKey: 'national',                color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-400',   darkBg: 'dark:bg-blue-900/20' },
  regional:                { i18nKey: 'regional',                color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-400', darkBg: 'dark:bg-purple-900/20' },
  continental:             { i18nKey: 'continental',             color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-400',    darkBg: 'dark:bg-red-900/20' },
};

export const EDGE_STYLES: Record<EdgeKind, { color: string; dash: string; animated: boolean; i18nKey: string }> = {
  SEQUENTIAL:   { color: '#6b7280', dash: '0',   animated: false, i18nKey: 'sequential' },
  PARALLEL:     { color: '#8b5cf6', dash: '0',   animated: true,  i18nKey: 'parallelFanOut' },
  CHOICE_SINGLE:{ color: '#f59e0b', dash: '8 4', animated: false, i18nKey: 'choiceSingle' },
  CHOICE_MULTI: { color: '#10b981', dash: '8 4', animated: false, i18nKey: 'choiceMultiple' },
};

export const NODE_CATALOG: { type: NodeKind; i18nKey: string; descKey: string; icon: React.ReactNode; color: string }[] = [
  { type: 'start',        i18nKey: 'start',        descKey: 'startDesc',        icon: React.createElement(Play, { className: 'h-4 w-4' }),         color: 'text-green-600' },
  { type: 'step',         i18nKey: 'step',         descKey: 'stepDesc',         icon: React.createElement(CheckCircle2, { className: 'h-4 w-4' }), color: 'text-blue-600' },
  { type: 'decision',     i18nKey: 'decision',     descKey: 'decisionDesc',     icon: React.createElement(Diamond, { className: 'h-4 w-4' }),      color: 'text-amber-600' },
  { type: 'fork',         i18nKey: 'fork',         descKey: 'forkDesc',         icon: React.createElement(GitFork, { className: 'h-4 w-4' }),      color: 'text-purple-600' },
  { type: 'join',         i18nKey: 'join',         descKey: 'joinDesc',         icon: React.createElement(Merge, { className: 'h-4 w-4' }),        color: 'text-indigo-600' },
  { type: 'notification', i18nKey: 'notification', descKey: 'notificationDesc', icon: React.createElement(Bell, { className: 'h-4 w-4' }),  color: 'text-pink-600' },
  { type: 'end',          i18nKey: 'end',          descKey: 'endDesc',          icon: React.createElement(Square, { className: 'h-4 w-4' }), color: 'text-red-600' },
];
