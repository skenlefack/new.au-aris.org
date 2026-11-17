/**
 * Basemap tiles used by ARIS maps (CARTO), with the ARIS API key.
 * Use these helpers in new maps instead of writing the tile URL by hand.
 */
export const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY || 'cb1_2b9n_1_481d72d339003f7d23db5152';

export type CartoStyle = 'light_all' | 'dark_all' | 'light_nolabels' | 'dark_nolabels' | 'light_only_labels' | 'dark_only_labels';

export function cartoTileUrl(style: CartoStyle): string {
  return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;
}
