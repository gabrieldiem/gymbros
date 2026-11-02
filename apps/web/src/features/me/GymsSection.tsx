import { MapPin, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { useAddGym, useDeleteGym, useGyms, useMakeGymDefault } from '../../api/gyms';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n/context';
import styles from './Me.module.css';

/** The gyms you train at. Your crew sees the one you're at; the default is picked for you. */
export function GymsSection() {
  const { t } = useI18n();
  const gyms = useGyms().data ?? [];
  const add = useAddGym();
  const makeDefault = useMakeGymDefault();
  const remove = useDeleteGym();
  const [name, setName] = useState('');

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    add.mutate(name.trim(), { onSuccess: () => setName('') });
  };

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
                <span>{gym.name}</span>
                {gym.is_default && <small>{t('gym_default')}</small>}
              </label>
              <button
                type="button"
                aria-label={t('gym_remove', { name: gym.name })}
                onClick={() => remove.mutate(gym.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className={styles.nameForm} onSubmit={handleAdd}>
        <TextField
          label={t('gym_name')}
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button icon={Plus} variant="ghost" type="submit" disabled={add.isPending || !name.trim()}>
          {t('gym_add')}
        </Button>
      </form>
      <FormError error={add.error} />
    </div>
  );
}
