// ═══════════════════════════════════════════════════════════════════
//  ARIS Interoperability Hub v3 — Adapter Registry
//  Central registry of all external system adapters.
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './base.adapter';
import { WahisAdapter } from './wahis.adapter';
import { EmpresAdapter } from './empres.adapter';
import { FaostatAdapter } from './faostat.adapter';
import { FishstatjAdapter } from './fishstatj.adapter';
import { CitesAdapter } from './cites.adapter';
import { Dhis2Adapter } from './dhis2.adapter';
import { FhirAdapter } from './fhir.adapter';
import { GenericRestAdapter } from './generic-rest.adapter';

// Re-export types and base class
export { BaseAdapter } from './base.adapter';
export type {
  AdapterConfig,
  FormatBuildResult,
  DeliveryResult,
  PullResult,
  HealthCheckResult,
} from './base.adapter';

// Re-export adapters
export { WahisAdapter } from './wahis.adapter';
export { EmpresAdapter } from './empres.adapter';
export { FaostatAdapter } from './faostat.adapter';
export { FishstatjAdapter } from './fishstatj.adapter';
export { CitesAdapter } from './cites.adapter';
export { Dhis2Adapter } from './dhis2.adapter';
export { FhirAdapter } from './fhir.adapter';
export { GenericRestAdapter } from './generic-rest.adapter';

// ─── Adapter Registry ──────────────────────────────────────────────

export class AdapterRegistry {
  private adapters: Map<string, BaseAdapter> = new Map();

  /** Register an adapter instance. Keyed by systemType (uppercased). */
  register(adapter: BaseAdapter): void {
    this.adapters.set(adapter.systemType.toUpperCase(), adapter);
  }

  /** Get an adapter by system type. Case-insensitive. */
  get(systemType: string): BaseAdapter | undefined {
    return this.adapters.get(systemType.toUpperCase());
  }

  /** Get all registered adapters. */
  getAll(): BaseAdapter[] {
    return Array.from(this.adapters.values());
  }

  /** Check if an adapter is registered for the given system type. */
  has(systemType: string): boolean {
    return this.adapters.has(systemType.toUpperCase());
  }

  /** List all registered system types. */
  listTypes(): string[] {
    return Array.from(this.adapters.keys());
  }
}

// ─── Singleton with all adapters registered ─────────────────────────

export const adapterRegistry = new AdapterRegistry();

adapterRegistry.register(new WahisAdapter());
adapterRegistry.register(new EmpresAdapter());
adapterRegistry.register(new FaostatAdapter());
adapterRegistry.register(new FishstatjAdapter());
adapterRegistry.register(new CitesAdapter());
adapterRegistry.register(new Dhis2Adapter());
adapterRegistry.register(new FhirAdapter());
adapterRegistry.register(new GenericRestAdapter());
