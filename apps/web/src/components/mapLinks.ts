/**
 * Google's documented link for opening a place. It's a plain link, not the paid Maps API: no key,
 * no charge, and on a phone it opens the Maps app.
 */
export function googleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}
