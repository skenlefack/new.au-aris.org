import type { DataClassification } from '@aris/shared-types';

export type EventType = 'SUSPECT' | 'CONFIRMED' | 'RESOLVED';
export type ConfidenceLevel = 'RUMOR' | 'VERIFIED' | 'CONFIRMED';
export type ControlMeasure = 'QUARANTINE' | 'MOVEMENT_CONTROL' | 'VACCINATION' | 'STAMPING_OUT';

export interface HealthEventEntity {
  id: string;
  tenantId: string;
  diseaseId: string;
  eventType: EventType;
  speciesIds: string[];
  dateOnset: Date | null;
  dateSuspicion: Date;
  dateConfirmation: Date | null;
  dateClosure: Date | null;
  geoEntityId: string;
  latitude: number | null;
  longitude: number | null;
  holdingsAffected: number;
  susceptible: number;
  cases: number;
  deaths: number;
  killed: number;
  slaughtered: number;
  controlMeasures: ControlMeasure[];
  confidenceLevel: ConfidenceLevel;
  dataClassification: DataClassification;
  workflowInstanceId: string | null;
  wahisReady: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
