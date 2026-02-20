export enum WorkflowLevel {
  /** Level 1: National Data Steward — Technical validation (quality gates) */
  NATIONAL_TECHNICAL = 'NATIONAL_TECHNICAL',
  /** Level 2: Data Owner / CVO — Official national approval (WAHIS-ready) */
  NATIONAL_OFFICIAL = 'NATIONAL_OFFICIAL',
  /** Level 3: REC Data Steward — Regional harmonization, cross-border consistency */
  REC_HARMONIZATION = 'REC_HARMONIZATION',
  /** Level 4: AU-IBAR — Continental analytics, publication (with disclaimers) */
  CONTINENTAL_PUBLICATION = 'CONTINENTAL_PUBLICATION',
}
