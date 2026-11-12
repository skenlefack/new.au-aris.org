/**
 * Approximate bounding boxes of the 55 AU Member States, as
 * [minLat, maxLat, minLng, maxLng] in WGS84.
 *
 * Used only to flag GPS points that are clearly outside the country, so a
 * margin is added when checking (see COUNTRY_BOUNDS_MARGIN). Islands far from
 * the mainland (e.g. Prince Edward Islands) are left out on purpose.
 */
export const COUNTRY_BOUNDS: Record<string, [number, number, number, number]> = {
  DZ: [18.96, 37.1, -8.7, 12.0],
  AO: [-18.05, -4.37, 11.64, 24.09],
  BJ: [6.14, 12.42, 0.77, 3.85],
  BW: [-26.91, -17.78, 19.99, 29.38],
  BF: [9.39, 15.08, -5.52, 2.41],
  BI: [-4.47, -2.31, 29.0, 30.85],
  CV: [14.8, 17.21, -25.36, -22.66],
  CM: [1.65, 13.08, 8.49, 16.19],
  CF: [2.22, 11.0, 14.42, 27.46],
  TD: [7.44, 23.45, 13.47, 24.0],
  KM: [-12.42, -11.36, 43.22, 44.54],
  CG: [-5.03, 3.7, 11.09, 18.65],
  CD: [-13.46, 5.39, 12.2, 31.31],
  CI: [4.36, 10.74, -8.6, -2.49],
  DJ: [10.93, 12.71, 41.77, 43.42],
  EG: [21.99, 31.67, 24.7, 36.9],
  GQ: [-1.47, 3.79, 5.6, 11.34],
  ER: [12.36, 18.0, 36.43, 43.14],
  SZ: [-27.32, -25.72, 30.79, 32.14],
  ET: [3.4, 14.89, 32.99, 47.99],
  GA: [-3.98, 2.32, 8.7, 14.5],
  GM: [13.06, 13.83, -16.83, -13.79],
  GH: [4.74, 11.17, -3.26, 1.2],
  GN: [7.19, 12.68, -15.08, -7.64],
  GW: [10.92, 12.69, -16.72, -13.64],
  KE: [-4.72, 5.03, 33.91, 41.91],
  LS: [-30.68, -28.57, 27.01, 29.46],
  LR: [4.35, 8.55, -11.49, -7.37],
  LY: [19.5, 33.17, 9.39, 25.15],
  MG: [-25.61, -11.95, 43.22, 50.48],
  MW: [-17.13, -9.37, 32.67, 35.92],
  ML: [10.16, 25.0, -12.24, 4.27],
  MR: [14.72, 27.3, -17.07, -4.83],
  MU: [-20.53, -10.3, 56.5, 63.5],
  MA: [21.0, 35.92, -17.1, -1.0],
  MZ: [-26.87, -10.47, 30.22, 40.84],
  NA: [-28.97, -16.96, 11.73, 25.26],
  NE: [11.7, 23.53, 0.17, 16.0],
  NG: [4.27, 13.89, 2.67, 14.68],
  RW: [-2.84, -1.05, 28.86, 30.9],
  EH: [20.77, 27.67, -17.1, -8.67],
  ST: [-0.01, 1.7, 6.47, 7.47],
  SN: [12.31, 16.69, -17.54, -11.36],
  SC: [-10.3, -3.7, 46.2, 56.3],
  SL: [6.93, 10.0, -13.3, -10.27],
  SO: [-1.68, 11.99, 40.99, 51.41],
  ZA: [-34.84, -22.13, 16.45, 32.89],
  SS: [3.49, 12.24, 23.44, 35.95],
  SD: [8.69, 22.23, 21.81, 38.6],
  TZ: [-11.75, -0.98, 29.33, 40.44],
  TG: [6.1, 11.14, -0.15, 1.81],
  TN: [30.23, 37.54, 7.52, 11.6],
  UG: [-1.48, 4.23, 29.57, 35.04],
  ZM: [-18.08, -8.22, 21.99, 33.71],
  ZW: [-22.42, -15.61, 25.24, 33.06],
};

/** Degrees added on each side before calling a point "outside" (about 30 km). */
export const COUNTRY_BOUNDS_MARGIN = 0.3;

export function isInsideCountry(countryCode: string, lat: number, lng: number): boolean | null {
  const b = COUNTRY_BOUNDS[countryCode.toUpperCase()];
  if (!b) return null;
  const m = COUNTRY_BOUNDS_MARGIN;
  return lat >= b[0] - m && lat <= b[1] + m && lng >= b[2] - m && lng <= b[3] + m;
}
