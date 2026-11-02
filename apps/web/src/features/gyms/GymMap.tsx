import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef } from 'react';

import styles from './GymMap.module.css';

// OpenStreetMap's own tiles: free and keyless for an app this size, as long as they're credited.
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const WORLD: L.LatLngTuple = [15, -30];
const WORLD_ZOOM = 2;
const STREET_ZOOM = 16;
const TAP_ZOOM = 14;
const TAP_ZOOM_STEP = 4;

const PIN = L.divIcon({
  className: styles.pin,
  html: '<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" fill="#FFE600" stroke="#0D0D0D" stroke-width="1.5"/><circle cx="12" cy="9" r="2.5" fill="#0D0D0D"/></svg>',
  iconSize: [36, 36],
  iconAnchor: [18, 34],
});

export type MapPosition = { lat: number; lon: number };

type Props = {
  position: MapPosition | null;
  /** Lets a tap place the pin. Without it the map only shows. */
  onPick?: (position: MapPosition) => void;
  label: string;
};

/** A real, draggable map from OpenStreetMap, with the pin where the gym is. */
export default function GymMap({ position, onPick, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const pick = useRef(onPick);
  const tapped = useRef<MapPosition | null>(null);

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!box.current) return;
    const instance = L.map(box.current, { zoomControl: true }).setView(WORLD, WORLD_ZOOM);
    L.tileLayer(TILES, { maxZoom: 19, attribution: CREDIT }).addTo(instance);
    instance.attributionControl.setPrefix(false);
    instance.on('click', (event: L.LeafletMouseEvent) => {
      if (!pick.current) return;
      const picked = { lat: event.latlng.lat, lon: event.latlng.lng };
      tapped.current = picked;
      // From far out a tap can't be exact, so it closes in and the next tap can correct it.
      const zoom = instance.getZoom();
      instance.setView(event.latlng, zoom < TAP_ZOOM ? zoom + TAP_ZOOM_STEP : zoom);
      pick.current(picked);
    });
    // The sheet is still sliding in when the map first measures itself.
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(box.current);
    map.current = instance;
    return () => {
      resize.disconnect();
      instance.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (!position) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const spot: L.LatLngTuple = [position.lat, position.lon];
    if (marker.current) marker.current.setLatLng(spot);
    else marker.current = L.marker(spot, { icon: PIN, keyboard: false }).addTo(instance);
    // A tap has already moved the map. Anything else came from elsewhere, so go and show it.
    if (tapped.current?.lat !== position.lat || tapped.current.lon !== position.lon) {
      instance.setView(spot, Math.max(instance.getZoom(), STREET_ZOOM), { animate: false });
    }
  }, [position]);

  return <div ref={box} className={styles.map} role="group" aria-label={label} />;
}
