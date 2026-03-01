import { BaseAdapter } from './base.adapter.js';
import { WahisAdapter } from './wahis.adapter.js';
import { Dhis2Adapter } from './dhis2.adapter.js';
import { FhirAdapter } from './fhir.adapter.js';
import { OmsAdapter } from './oms.adapter.js';
import { EmpresAdapter } from './empres.adapter.js';
import { FaostatAdapter } from './faostat.adapter.js';

const adapterRegistry = new Map<string, BaseAdapter>([
  ['WAHIS', new WahisAdapter()],
  ['DHIS2', new Dhis2Adapter()],
  ['FHIR', new FhirAdapter()],
  ['OMS', new OmsAdapter()],
  ['EMPRES', new EmpresAdapter()],
  ['FAOSTAT', new FaostatAdapter()],
]);

export function getAdapter(system: string): BaseAdapter | undefined {
  return adapterRegistry.get(system);
}

export function getAllAdapters(): Map<string, BaseAdapter> {
  return adapterRegistry;
}

export { BaseAdapter } from './base.adapter.js';
export { WahisAdapter } from './wahis.adapter.js';
export { Dhis2Adapter } from './dhis2.adapter.js';
export { FhirAdapter } from './fhir.adapter.js';
export { OmsAdapter } from './oms.adapter.js';
export { EmpresAdapter } from './empres.adapter.js';
export { FaostatAdapter } from './faostat.adapter.js';
