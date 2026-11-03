import { ExternalLink, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useDeleteGym, useGyms, useMakeGymDefault, type Gym } from '../../api/gyms';
import { Button } from '../../components/Button';
import { googleMapsUrl } from '../../components/mapLinks';
import { useI18n } from '../../i18n/context';
import { GymPickerSheet } from '../gyms/GymPickerSheet';
import styles from './Me.module.css';

/** The gyms you train at. Your crew sees the one you're at; the default is picked for you. */
export function GymsSection() {
  const { t } = useI18n();
  const gyms = useGyms().data ?? [];
  const makeDefault = useMakeGymDefault();
  const remove = useDeleteGym();
  const [editing, setEditing] = useState<Gym | 'new' | null>(null);

  return (
    <div>
      <h3 className={styles.iconTitle}>
        <MapPin size={18} aria-hidden="true" />
        {t('gyms_title')}
      </h3>
      <p>{t('gyms_hint')}</p>
      {gyms.length > 0 && (
        <ul className={styles.gyms}>
          {gyms.map((gym) => (
            <li key={gym.id}>
              <label>
                <input
                  type="radio"
                  name="default-gym"
                  checked={gym.is_default}
                  aria-label={t('gym_default_of', { name: gym.name })}
                  onChange={() => makeDefault.mutate(gym.id)}
                />
                <span>
                  {gym.name}
                  {gym.is_default && <small> {t('gym_default')}</small>}
                  {gym.location?.address && (
                    <small className={styles.gymAddress}>{gym.location.address}</small>
                  )}
                </span>
              </label>
              {gym.location && (
                <a
                  className={styles.gymAction}
                  href={googleMapsUrl(gym.location.lat, gym.location.lon)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('gym_open_named', { name: gym.name })}
                >
                  <ExternalLink size={18} aria-hidden="true" />
                </a>
              )}
              <button
                type="button"
                className={styles.gymAction}
                aria-label={t('gym_edit', { name: gym.name })}
                onClick={() => setEditing(gym)}
              >
                <Pencil size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.gymAction}
                aria-label={t('gym_remove', { name: gym.name })}
                onClick={() => remove.mutate(gym.id)}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.gymAdd}>
        <Button variant="ghost" icon={Plus} onClick={() => setEditing('new')}>
          {t('gym_add')}
        </Button>
      </div>
      {editing && (
        <GymPickerSheet
          {...(editing === 'new' ? {} : { gym: editing })}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
