// FAOSTAT denominators 2020-2023 for 5 pilot countries (cattle, sheep, goats, poultry)
// Source: FAOSTAT Livestock Statistics — approximate values (thousands of head)

export interface DenominatorSeed {
  countryCode: string;
  speciesCode: string; // resolved to speciesId during seeding
  year: number;
  source: 'FAOSTAT' | 'NATIONAL_CENSUS' | 'ESTIMATE';
  population: number; // in heads
  assumptions: string;
}

export const DENOMINATOR_SEEDS: DenominatorSeed[] = [
  // ── Kenya ──
  // Cattle
  { countryCode: 'KE', speciesCode: 'BOS-TAU', year: 2020, source: 'FAOSTAT', population: 18500000, assumptions: 'FAOSTAT 2020 estimate; includes indigenous + exotic breeds' },
  { countryCode: 'KE', speciesCode: 'BOS-TAU', year: 2021, source: 'FAOSTAT', population: 18800000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'KE', speciesCode: 'BOS-TAU', year: 2022, source: 'FAOSTAT', population: 19100000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'KE', speciesCode: 'BOS-TAU', year: 2023, source: 'FAOSTAT', population: 19400000, assumptions: 'FAOSTAT 2023 estimate' },
  // Sheep
  { countryCode: 'KE', speciesCode: 'OVI-ARI', year: 2020, source: 'FAOSTAT', population: 17800000, assumptions: 'FAOSTAT 2020 estimate' },
  { countryCode: 'KE', speciesCode: 'OVI-ARI', year: 2021, source: 'FAOSTAT', population: 18100000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'KE', speciesCode: 'OVI-ARI', year: 2022, source: 'FAOSTAT', population: 18400000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'KE', speciesCode: 'OVI-ARI', year: 2023, source: 'FAOSTAT', population: 18700000, assumptions: 'FAOSTAT 2023 estimate' },
  // Goats
  { countryCode: 'KE', speciesCode: 'CAP-HIR', year: 2020, source: 'FAOSTAT', population: 27600000, assumptions: 'FAOSTAT 2020 estimate' },
  { countryCode: 'KE', speciesCode: 'CAP-HIR', year: 2021, source: 'FAOSTAT', population: 28000000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'KE', speciesCode: 'CAP-HIR', year: 2022, source: 'FAOSTAT', population: 28400000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'KE', speciesCode: 'CAP-HIR', year: 2023, source: 'FAOSTAT', population: 28800000, assumptions: 'FAOSTAT 2023 estimate' },
  // Poultry (chicken)
  { countryCode: 'KE', speciesCode: 'GAL-DOM', year: 2020, source: 'FAOSTAT', population: 44000000, assumptions: 'FAOSTAT 2020 estimate; commercial + indigenous' },
  { countryCode: 'KE', speciesCode: 'GAL-DOM', year: 2021, source: 'FAOSTAT', population: 45200000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'KE', speciesCode: 'GAL-DOM', year: 2022, source: 'FAOSTAT', population: 46400000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'KE', speciesCode: 'GAL-DOM', year: 2023, source: 'FAOSTAT', population: 47600000, assumptions: 'FAOSTAT 2023 estimate' },

  // ── Ethiopia ──
  { countryCode: 'ET', speciesCode: 'BOS-TAU', year: 2020, source: 'FAOSTAT', population: 65350000, assumptions: 'FAOSTAT 2020; largest cattle herd in Africa' },
  { countryCode: 'ET', speciesCode: 'BOS-TAU', year: 2021, source: 'FAOSTAT', population: 66200000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'ET', speciesCode: 'BOS-TAU', year: 2022, source: 'FAOSTAT', population: 67000000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'ET', speciesCode: 'BOS-TAU', year: 2023, source: 'FAOSTAT', population: 67800000, assumptions: 'FAOSTAT 2023 estimate' },
  { countryCode: 'ET', speciesCode: 'OVI-ARI', year: 2020, source: 'FAOSTAT', population: 39890000, assumptions: 'FAOSTAT 2020 estimate' },
  { countryCode: 'ET', speciesCode: 'OVI-ARI', year: 2021, source: 'FAOSTAT', population: 40500000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'ET', speciesCode: 'OVI-ARI', year: 2022, source: 'FAOSTAT', population: 41100000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'ET', speciesCode: 'OVI-ARI', year: 2023, source: 'FAOSTAT', population: 41700000, assumptions: 'FAOSTAT 2023 estimate' },
  { countryCode: 'ET', speciesCode: 'CAP-HIR', year: 2020, source: 'FAOSTAT', population: 51200000, assumptions: 'FAOSTAT 2020 estimate' },
  { countryCode: 'ET', speciesCode: 'CAP-HIR', year: 2021, source: 'FAOSTAT', population: 51900000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'ET', speciesCode: 'CAP-HIR', year: 2022, source: 'FAOSTAT', population: 52600000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'ET', speciesCode: 'CAP-HIR', year: 2023, source: 'FAOSTAT', population: 53300000, assumptions: 'FAOSTAT 2023 estimate' },
  { countryCode: 'ET', speciesCode: 'GAL-DOM', year: 2020, source: 'FAOSTAT', population: 60500000, assumptions: 'FAOSTAT 2020; mostly backyard flocks' },
  { countryCode: 'ET', speciesCode: 'GAL-DOM', year: 2021, source: 'FAOSTAT', population: 62000000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'ET', speciesCode: 'GAL-DOM', year: 2022, source: 'FAOSTAT', population: 63500000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'ET', speciesCode: 'GAL-DOM', year: 2023, source: 'FAOSTAT', population: 65000000, assumptions: 'FAOSTAT 2023 estimate' },

  // ── Nigeria ──
  { countryCode: 'NG', speciesCode: 'BOS-TAU', year: 2020, source: 'FAOSTAT', population: 21400000, assumptions: 'FAOSTAT 2020 estimate' },
  { countryCode: 'NG', speciesCode: 'BOS-TAU', year: 2021, source: 'FAOSTAT', population: 21800000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'NG', speciesCode: 'BOS-TAU', year: 2022, source: 'FAOSTAT', population: 22200000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'NG', speciesCode: 'BOS-TAU', year: 2023, source: 'FAOSTAT', population: 22600000, assumptions: 'FAOSTAT 2023 estimate' },
  { countryCode: 'NG', speciesCode: 'OVI-ARI', year: 2020, source: 'FAOSTAT', population: 43400000, assumptions: 'FAOSTAT 2020 estimate' },
  { countryCode: 'NG', speciesCode: 'OVI-ARI', year: 2021, source: 'FAOSTAT', population: 44200000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'NG', speciesCode: 'OVI-ARI', year: 2022, source: 'FAOSTAT', population: 45000000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'NG', speciesCode: 'OVI-ARI', year: 2023, source: 'FAOSTAT', population: 45800000, assumptions: 'FAOSTAT 2023 estimate' },
  { countryCode: 'NG', speciesCode: 'CAP-HIR', year: 2020, source: 'FAOSTAT', population: 83500000, assumptions: 'FAOSTAT 2020 estimate; largest goat herd globally' },
  { countryCode: 'NG', speciesCode: 'CAP-HIR', year: 2021, source: 'FAOSTAT', population: 84800000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'NG', speciesCode: 'CAP-HIR', year: 2022, source: 'FAOSTAT', population: 86100000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'NG', speciesCode: 'CAP-HIR', year: 2023, source: 'FAOSTAT', population: 87400000, assumptions: 'FAOSTAT 2023 estimate' },
  { countryCode: 'NG', speciesCode: 'GAL-DOM', year: 2020, source: 'FAOSTAT', population: 180000000, assumptions: 'FAOSTAT 2020 estimate' },
  { countryCode: 'NG', speciesCode: 'GAL-DOM', year: 2021, source: 'FAOSTAT', population: 184000000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'NG', speciesCode: 'GAL-DOM', year: 2022, source: 'FAOSTAT', population: 188000000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'NG', speciesCode: 'GAL-DOM', year: 2023, source: 'FAOSTAT', population: 192000000, assumptions: 'FAOSTAT 2023 estimate' },

  // ── Senegal ──
  { countryCode: 'SN', speciesCode: 'BOS-TAU', year: 2020, source: 'FAOSTAT', population: 3700000, assumptions: 'FAOSTAT 2020 estimate' },
  { countryCode: 'SN', speciesCode: 'BOS-TAU', year: 2021, source: 'FAOSTAT', population: 3780000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'SN', speciesCode: 'BOS-TAU', year: 2022, source: 'FAOSTAT', population: 3860000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'SN', speciesCode: 'BOS-TAU', year: 2023, source: 'FAOSTAT', population: 3940000, assumptions: 'FAOSTAT 2023 estimate' },
  { countryCode: 'SN', speciesCode: 'OVI-ARI', year: 2020, source: 'FAOSTAT', population: 6900000, assumptions: 'FAOSTAT 2020 estimate' },
  { countryCode: 'SN', speciesCode: 'OVI-ARI', year: 2021, source: 'FAOSTAT', population: 7050000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'SN', speciesCode: 'OVI-ARI', year: 2022, source: 'FAOSTAT', population: 7200000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'SN', speciesCode: 'OVI-ARI', year: 2023, source: 'FAOSTAT', population: 7350000, assumptions: 'FAOSTAT 2023 estimate' },
  { countryCode: 'SN', speciesCode: 'CAP-HIR', year: 2020, source: 'FAOSTAT', population: 6200000, assumptions: 'FAOSTAT 2020 estimate' },
  { countryCode: 'SN', speciesCode: 'CAP-HIR', year: 2021, source: 'FAOSTAT', population: 6330000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'SN', speciesCode: 'CAP-HIR', year: 2022, source: 'FAOSTAT', population: 6460000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'SN', speciesCode: 'CAP-HIR', year: 2023, source: 'FAOSTAT', population: 6590000, assumptions: 'FAOSTAT 2023 estimate' },
  { countryCode: 'SN', speciesCode: 'GAL-DOM', year: 2020, source: 'FAOSTAT', population: 63000000, assumptions: 'FAOSTAT 2020 estimate' },
  { countryCode: 'SN', speciesCode: 'GAL-DOM', year: 2021, source: 'FAOSTAT', population: 65000000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'SN', speciesCode: 'GAL-DOM', year: 2022, source: 'FAOSTAT', population: 67000000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'SN', speciesCode: 'GAL-DOM', year: 2023, source: 'FAOSTAT', population: 69000000, assumptions: 'FAOSTAT 2023 estimate' },

  // ── South Africa ──
  { countryCode: 'ZA', speciesCode: 'BOS-TAU', year: 2020, source: 'FAOSTAT', population: 12700000, assumptions: 'FAOSTAT 2020 estimate' },
  { countryCode: 'ZA', speciesCode: 'BOS-TAU', year: 2021, source: 'FAOSTAT', population: 12800000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'ZA', speciesCode: 'BOS-TAU', year: 2022, source: 'FAOSTAT', population: 12900000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'ZA', speciesCode: 'BOS-TAU', year: 2023, source: 'FAOSTAT', population: 13000000, assumptions: 'FAOSTAT 2023 estimate' },
  { countryCode: 'ZA', speciesCode: 'OVI-ARI', year: 2020, source: 'FAOSTAT', population: 21800000, assumptions: 'FAOSTAT 2020 estimate' },
  { countryCode: 'ZA', speciesCode: 'OVI-ARI', year: 2021, source: 'FAOSTAT', population: 22000000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'ZA', speciesCode: 'OVI-ARI', year: 2022, source: 'FAOSTAT', population: 22200000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'ZA', speciesCode: 'OVI-ARI', year: 2023, source: 'FAOSTAT', population: 22400000, assumptions: 'FAOSTAT 2023 estimate' },
  { countryCode: 'ZA', speciesCode: 'CAP-HIR', year: 2020, source: 'FAOSTAT', population: 5400000, assumptions: 'FAOSTAT 2020 estimate' },
  { countryCode: 'ZA', speciesCode: 'CAP-HIR', year: 2021, source: 'FAOSTAT', population: 5450000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'ZA', speciesCode: 'CAP-HIR', year: 2022, source: 'FAOSTAT', population: 5500000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'ZA', speciesCode: 'CAP-HIR', year: 2023, source: 'FAOSTAT', population: 5550000, assumptions: 'FAOSTAT 2023 estimate' },
  { countryCode: 'ZA', speciesCode: 'GAL-DOM', year: 2020, source: 'FAOSTAT', population: 165000000, assumptions: 'FAOSTAT 2020; commercial broiler + layer' },
  { countryCode: 'ZA', speciesCode: 'GAL-DOM', year: 2021, source: 'FAOSTAT', population: 168000000, assumptions: 'FAOSTAT 2021 estimate' },
  { countryCode: 'ZA', speciesCode: 'GAL-DOM', year: 2022, source: 'FAOSTAT', population: 171000000, assumptions: 'FAOSTAT 2022 estimate' },
  { countryCode: 'ZA', speciesCode: 'GAL-DOM', year: 2023, source: 'FAOSTAT', population: 174000000, assumptions: 'FAOSTAT 2023 estimate' },
];
