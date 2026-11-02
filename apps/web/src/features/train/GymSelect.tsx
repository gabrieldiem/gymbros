import { MapPin } from 'lucide-react';
import { useGyms } from '../../api/gyms';
import { useI18n } from '../../i18n/context';
import styles from './GymSelect.module.css';

const NONE = '';

type Props = {
  value: string | null;
  onChange: (gym: string | null) => void;
};

/** Where you're training, which your crew can see. */
export function GymSelect({ value, onChange }: Props) {
  const { t } = useI18n();
  const gyms = useGyms().data ?? [];
  // A gym you've since deleted is still where this workout is.
  const names = gyms.map((gym) => gym.name);
  const options = value && !names.includes(value) ? [value, ...names] : names;
  if (options.length === 0) return null;
  return (
    <label className={styles.gym}>
      <MapPin size={15} aria-hidden="true" />
      {t('gym_at')}
      <select value={value ?? NONE} onChange={(e) => onChange(e.target.value || null)}>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={NONE}>{t('gym_none')}</option>
      </select>
    </label>
  );
}
