import { Crosshair, ExternalLink, MapPin, Search, Trash2 } from 'lucide-react';
import { lazy, Suspense, useState, type FormEvent } from 'react';

import { useAddGym, useFindPlaces, useUpdateGym, type Gym, type Place } from '../../api/gyms';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { LoadingBlock } from '../../components/QueryState';
import { googleMapsUrl } from '../../components/mapLinks';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n/context';
import styles from './GymPicker.module.css';

// Leaflet is only for whoever is placing a gym, so nobody else downloads it.
const GymMap = lazy(() => import('./GymMap'));

type Spot = { lat: number; lon: number; address: string | null };

type Props = {
  /** The gym being changed. Without one, this adds a new gym. */
  gym?: Gym;
  onClose: () => void;
};

/** Find a gym by searching, pasting a maps link, using your location or tapping the map. */
export function GymPickerSheet({ gym, onClose }: Props) {
  const { t } = useI18n();
  const find = useFindPlaces();
  const add = useAddGym();
  const update = useUpdateGym();
  const [query, setQuery] = useState('');
  const [name, setName] = useState(gym?.name ?? '');
  const [spot, setSpot] = useState<Spot | null>(
    gym?.location
      ? { lat: gym.location.lat, lon: gym.location.lon, address: gym.location.address ?? null }
      : null,
  );
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [locateFailed, setLocateFailed] = useState(false);

  const choose = (place: Place) => {
    setSpot({ lat: place.lat, lon: place.lon, address: place.address });
    setName((current) => current || place.name);
    setPlaces(null);
    setQuery('');
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    find.mutate(query, {
      onSuccess: (found) => {
        // A pasted link is one exact place, so there's nothing to choose from.
        const first = found[0];
        if (found.length === 1 && first) choose(first);
        else setPlaces(found);
      },
    });
  };

  const handleLocate = () => {
    setLocateFailed(false);
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => setSpot({ lat: coords.latitude, lon: coords.longitude, address: null }),
      () => setLocateFailed(true),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const saving = add.isPending || update.isPending;
  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    const body = { name: name.trim(), location: spot };
    const done = { onSuccess: onClose };
    if (gym) update.mutate({ id: gym.id, ...body }, done);
    else add.mutate(body, done);
  };

  return (
    <Sheet title={t(gym ? 'gym_edit_title' : 'gym_add')} onClose={onClose}>
      <div className={styles.picker}>
        <form className={styles.search} onSubmit={handleSearch}>
          <TextField
            label={t('gym_search')}
            autoComplete="off"
            maxLength={2000}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button
            type="submit"
            variant="ghost"
            icon={Search}
            disabled={!query.trim() || find.isPending}
          >
            {t('gym_search_cta')}
          </Button>
        </form>
        <FormError error={find.error} />
        {places?.length === 0 && <p className={styles.note}>{t('gym_no_results')}</p>}
        {places && places.length > 0 && (
          <ul className={styles.results}>
            {places.map((place) => (
              <li key={`${place.lat},${place.lon}`}>
                <button type="button" onClick={() => choose(place)}>
                  <MapPin size={16} aria-hidden="true" />
                  <span>
                    <b>{place.name}</b>
                    {place.address && <small>{place.address}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Suspense fallback={<LoadingBlock rows={2} />}>
          <GymMap
            position={spot}
            onPick={({ lat, lon }) => setSpot({ lat, lon, address: null })}
            label={t('gym_map')}
          />
        </Suspense>
        <p className={styles.note}>{t('gym_map_hint')}</p>
        <div className={styles.mapActions}>
          <Button type="button" variant="quiet" icon={Crosshair} onClick={handleLocate}>
            {t('gym_locate')}
          </Button>
          {spot && (
            <>
              <a href={googleMapsUrl(spot.lat, spot.lon)} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} aria-hidden="true" />
                {t('gym_open_map')}
              </a>
              <Button type="button" variant="quiet" icon={Trash2} onClick={() => setSpot(null)}>
                {t('gym_remove_pin')}
              </Button>
            </>
          )}
        </div>
        {locateFailed && (
          <p className={styles.note} role="alert">
            {t('gym_locate_failed')}
          </p>
        )}
        {spot?.address && <p className={styles.note}>{spot.address}</p>}
        <form className={styles.save} onSubmit={handleSave}>
          <TextField
            label={t('gym_name')}
            maxLength={40}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <FormError error={add.error ?? update.error} />
          <Button type="submit" wide icon={MapPin} disabled={!name.trim() || saving}>
            {t('gym_save')}
          </Button>
        </form>
      </div>
    </Sheet>
  );
}
