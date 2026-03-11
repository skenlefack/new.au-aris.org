// ── 45 Infrastructure Types (15 categories × 3 sub-types) ─────────────────────
// Seeded as continental-scope ref-data so they're visible to all users.

export interface InfrastructureSeed {
  code: string;
  nameEn: string;
  nameFr: string;
  category: string;
  subType: string;
  sortOrder: number;
}

export const INFRASTRUCTURE_SEEDS: InfrastructureSeed[] = [
  // ── 1. Laboratory ──
  { code: 'INFRA-LAB-VET',       nameEn: 'Veterinary Laboratory',           nameFr: 'Laboratoire vétérinaire',              category: 'laboratory',         subType: 'veterinary',            sortOrder: 100 },
  { code: 'INFRA-LAB-RES',       nameEn: 'Research Laboratory',             nameFr: 'Laboratoire de recherche',             category: 'laboratory',         subType: 'research',              sortOrder: 101 },
  { code: 'INFRA-LAB-DIAG',      nameEn: 'Diagnostic Laboratory',           nameFr: 'Laboratoire de diagnostic',            category: 'laboratory',         subType: 'diagnostic',            sortOrder: 102 },

  // ── 2. Slaughterhouse ──
  { code: 'INFRA-ABAT-IND',      nameEn: 'Industrial Slaughterhouse',       nameFr: 'Abattoir industriel',                  category: 'slaughterhouse',     subType: 'industrial',            sortOrder: 200 },
  { code: 'INFRA-ABAT-MUN',      nameEn: 'Municipal Slaughterhouse',        nameFr: 'Abattoir municipal',                   category: 'slaughterhouse',     subType: 'municipal',             sortOrder: 201 },
  { code: 'INFRA-ABAT-AREA',     nameEn: 'Slaughter Area',                  nameFr: "Aire d'abattage",                      category: 'slaughterhouse',     subType: 'slaughter_area',        sortOrder: 202 },

  // ── 3. Market ──
  { code: 'INFRA-MKT-LIVE',      nameEn: 'Livestock Market',                nameFr: 'Marché à bétail',                     category: 'market',             subType: 'livestock',             sortOrder: 300 },
  { code: 'INFRA-MKT-FISH',      nameEn: 'Fish Market',                     nameFr: 'Marché de poisson',                    category: 'market',             subType: 'fish',                  sortOrder: 301 },
  { code: 'INFRA-MKT-TERM',      nameEn: 'Terminal Market',                 nameFr: 'Marché terminal',                      category: 'market',             subType: 'terminal',              sortOrder: 302 },

  // ── 4. Storage ──
  { code: 'INFRA-STOR-COLD',     nameEn: 'Cold Storage',                    nameFr: 'Entrepôt frigorifique',                category: 'storage',            subType: 'cold_storage',          sortOrder: 400 },
  { code: 'INFRA-STOR-WARE',     nameEn: 'Warehouse',                       nameFr: 'Entrepôt de stockage',                 category: 'storage',            subType: 'warehouse',             sortOrder: 401 },
  { code: 'INFRA-STOR-ROOM',     nameEn: 'Cold Room',                       nameFr: 'Chambre froide',                       category: 'storage',            subType: 'cold_room',             sortOrder: 402 },

  // ── 5. Checkpoint / Control Post ──
  { code: 'INFRA-CHK-BORDER',    nameEn: 'Border Inspection Post',          nameFr: "Poste d'inspection frontalier",        category: 'checkpoint',         subType: 'border_inspection',     sortOrder: 500 },
  { code: 'INFRA-CHK-QUAR',      nameEn: 'Quarantine Station',              nameFr: 'Poste de quarantaine',                 category: 'checkpoint',         subType: 'quarantine',            sortOrder: 501 },
  { code: 'INFRA-CHK-VET',       nameEn: 'Veterinary Control Post',         nameFr: 'Poste de contrôle vétérinaire',        category: 'checkpoint',         subType: 'veterinary_control',    sortOrder: 502 },

  // ── 6. Port / Airport ──
  { code: 'INFRA-PORT-SEA',      nameEn: 'Seaport',                         nameFr: 'Port maritime',                        category: 'port_airport',       subType: 'seaport',               sortOrder: 600 },
  { code: 'INFRA-PORT-FISH',     nameEn: 'Fishing Port',                    nameFr: 'Port de pêche',                        category: 'port_airport',       subType: 'fishing_port',          sortOrder: 601 },
  { code: 'INFRA-PORT-AIR',      nameEn: 'Airport',                         nameFr: 'Aéroport',                             category: 'port_airport',       subType: 'airport',               sortOrder: 602 },

  // ── 7. Training / Education Center ──
  { code: 'INFRA-TRAIN-AGR',     nameEn: 'Agricultural Training Center',    nameFr: 'Centre de formation agricole',         category: 'training_center',    subType: 'agricultural_training', sortOrder: 700 },
  { code: 'INFRA-TRAIN-VET',     nameEn: 'Veterinary School',               nameFr: 'École vétérinaire',                    category: 'training_center',    subType: 'veterinary_school',     sortOrder: 701 },
  { code: 'INFRA-TRAIN-RES',     nameEn: 'Research Center',                 nameFr: 'Centre de recherche',                  category: 'training_center',    subType: 'research_center',       sortOrder: 702 },

  // ── 8. Breeding / Livestock Station ──
  { code: 'INFRA-BREED-SEED',    nameEn: 'Seed Farm',                       nameFr: 'Ferme semencière',                     category: 'breeding_station',   subType: 'seed_farm',             sortOrder: 800 },
  { code: 'INFRA-BREED-STAT',    nameEn: 'Breeding Station',                nameFr: "Station d'élevage",                    category: 'breeding_station',   subType: 'breeding_station',      sortOrder: 801 },
  { code: 'INFRA-BREED-RANCH',   nameEn: 'Ranch',                           nameFr: 'Ranch',                                category: 'breeding_station',   subType: 'ranch',                 sortOrder: 802 },

  // ── 9. Collection / Packaging Center ──
  { code: 'INFRA-COLL-MILK',     nameEn: 'Milk Collection Center',          nameFr: 'Centre de collecte de lait',           category: 'collection_center',  subType: 'milk_collection',       sortOrder: 900 },
  { code: 'INFRA-COLL-HONEY',    nameEn: 'Honey Collection Center',         nameFr: 'Centre de collecte de miel',           category: 'collection_center',  subType: 'honey_collection',      sortOrder: 901 },
  { code: 'INFRA-COLL-PACK',     nameEn: 'Packaging Center',                nameFr: 'Centre de conditionnement',            category: 'collection_center',  subType: 'packaging',             sortOrder: 902 },

  // ── 10. Park / Reserve ──
  { code: 'INFRA-PARK-NAT',      nameEn: 'National Park',                   nameFr: 'Parc national',                        category: 'protected_area',     subType: 'national_park',         sortOrder: 1000 },
  { code: 'INFRA-PARK-RES',      nameEn: 'Nature Reserve',                  nameFr: 'Réserve naturelle',                    category: 'protected_area',     subType: 'nature_reserve',        sortOrder: 1001 },
  { code: 'INFRA-PARK-CONS',     nameEn: 'Conservation Area',               nameFr: 'Zone de conservation',                 category: 'protected_area',     subType: 'conservation_area',     sortOrder: 1002 },

  // ── 11. Processing Industry ──
  { code: 'INFRA-IND-TAN',       nameEn: 'Tannery',                         nameFr: 'Tannerie',                             category: 'industry',           subType: 'tannery',               sortOrder: 1100 },
  { code: 'INFRA-IND-DAIRY',     nameEn: 'Dairy',                           nameFr: 'Laiterie',                             category: 'industry',           subType: 'dairy',                 sortOrder: 1101 },
  { code: 'INFRA-IND-PROC',      nameEn: 'Processing Plant',                nameFr: 'Usine de transformation',              category: 'industry',           subType: 'processing_plant',      sortOrder: 1102 },

  // ── 12. Water Infrastructure ──
  { code: 'INFRA-WATER-POINT',   nameEn: 'Water Point',                     nameFr: "Point d'eau",                          category: 'water_infrastructure', subType: 'water_point',         sortOrder: 1200 },
  { code: 'INFRA-WATER-DAM',     nameEn: 'Pastoral Dam',                    nameFr: 'Barrage pastoral',                     category: 'water_infrastructure', subType: 'pastoral_dam',        sortOrder: 1201 },
  { code: 'INFRA-WATER-BORE',    nameEn: 'Borehole',                        nameFr: 'Forage',                               category: 'water_infrastructure', subType: 'borehole',            sortOrder: 1202 },

  // ── 13. Veterinary Center ──
  { code: 'INFRA-VETC-CLIN',     nameEn: 'Veterinary Clinic',               nameFr: 'Clinique vétérinaire',                 category: 'veterinary_center',  subType: 'veterinary_clinic',     sortOrder: 1300 },
  { code: 'INFRA-VETC-PHARM',    nameEn: 'Veterinary Pharmacy',             nameFr: 'Pharmacie vétérinaire',                category: 'veterinary_center',  subType: 'veterinary_pharmacy',   sortOrder: 1301 },
  { code: 'INFRA-VETC-POST',     nameEn: 'Veterinary Post',                 nameFr: 'Poste vétérinaire',                    category: 'veterinary_center',  subType: 'veterinary_post',       sortOrder: 1302 },

  // ── 14. Administrative Office ──
  { code: 'INFRA-ADM-DIR',       nameEn: 'Veterinary Directorate',          nameFr: 'Direction des services vétérinaires',   category: 'admin_office',       subType: 'veterinary_directorate', sortOrder: 1400 },
  { code: 'INFRA-ADM-REG',       nameEn: 'Regional Office',                 nameFr: 'Bureau régional',                      category: 'admin_office',       subType: 'regional_office',       sortOrder: 1401 },
  { code: 'INFRA-ADM-DIST',      nameEn: 'District Office',                 nameFr: 'Bureau de district',                   category: 'admin_office',       subType: 'district_office',       sortOrder: 1402 },

  // ── 15. Other ──
  { code: 'INFRA-OTH-HATCH',     nameEn: 'Hatchery',                        nameFr: 'Couvoir',                              category: 'other',              subType: 'hatchery',              sortOrder: 1500 },
  { code: 'INFRA-OTH-APIARY',    nameEn: 'Teaching Apiary',                 nameFr: 'Rucher école',                         category: 'other',              subType: 'teaching_apiary',       sortOrder: 1501 },
  { code: 'INFRA-OTH-FREEZONE',  nameEn: 'Free Zone',                       nameFr: 'Zone franche',                         category: 'other',              subType: 'free_zone',             sortOrder: 1502 },
];
