'use client';

import { useMemo } from 'react';
import { usePublicDomains } from '@/lib/api/settings-hooks';

export interface DomainSectionConfig {
  kpis: boolean;
  chart: boolean;
  quickLinks: boolean;
  campaigns: boolean;
  alertForm: boolean;
  table: boolean;
}

export interface DomainSubPage {
  key: string;
  label: { en: string; fr: string };
  enabled: boolean;
  icon?: string;
}

export interface DomainModuleConfig {
  sections: DomainSectionConfig;
  subPages: DomainSubPage[];
}

const DEFAULT_SECTIONS: DomainSectionConfig = {
  kpis: true,
  chart: true,
  quickLinks: true,
  campaigns: true,
  alertForm: true,
  table: true,
};

const DEFAULT_CONFIG: DomainModuleConfig = {
  sections: DEFAULT_SECTIONS,
  subPages: [],
};

/**
 * Returns the module configuration for a given domain code.
 * Reads from domain.metadata.modules (set via Settings > Domains).
 * Defaults to all sections enabled if no config exists.
 */
export function useDomainConfig(code: string): DomainModuleConfig & { isLoading: boolean } {
  const { data, isLoading } = usePublicDomains();

  const config = useMemo(() => {
    if (!data?.data) return DEFAULT_CONFIG;

    const domain = (data.data as any[]).find(
      (d: any) => d.code === code || d.code === code.replace('-', '_'),
    );

    if (!domain?.metadata?.modules) return DEFAULT_CONFIG;

    const modules = domain.metadata.modules as Partial<DomainModuleConfig>;

    return {
      sections: { ...DEFAULT_SECTIONS, ...modules.sections },
      subPages: modules.subPages ?? [],
    };
  }, [data, code]);

  return { ...config, isLoading };
}
