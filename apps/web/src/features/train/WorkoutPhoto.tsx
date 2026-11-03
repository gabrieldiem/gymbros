import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';

import { useWorkoutPhoto } from '../../api/train';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { resizeImage } from '../../components/resizeImage';
import { useI18n } from '../../i18n/context';
import styles from './WorkoutPhoto.module.css';

const LONGEST_SIDE = 1280;

type Props = { workoutId: string; url: string | null };

/** A photo of the whole workout, which your crew sees on your post. */
export function WorkoutPhoto({ workoutId, url }: Props) {
  const { t } = useI18n();
  const { upload, remove } = useWorkoutPhoto(workoutId);
  const input = useRef<HTMLInputElement>(null);
  const [unreadable, setUnreadable] = useState(false);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // So choosing the same file again still fires.
    if (!file) return;
    setUnreadable(false);
    try {
      upload.mutate(await resizeImage(file, { maxSide: LONGEST_SIDE }));
    } catch {
      setUnreadable(true);
    }
  };

  return (
    <div className={styles.photo}>
      {url && <img src={url} alt={t('photo_yours')} />}
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept="image/*"
        aria-label={t(url ? 'photo_change' : 'photo_add')}
        tabIndex={-1}
        onChange={(e) => void handleFile(e)}
      />
      <div className={styles.actions}>
        <Button
          type="button"
          variant="ghost"
          icon={Camera}
          disabled={upload.isPending}
          onClick={() => input.current?.click()}
        >
          {upload.isPending
            ? t('profile_picture_uploading')
            : t(url ? 'photo_change' : 'photo_add')}
        </Button>
        {url && (
          <Button
            icon={Trash2}
            type="button"
            variant="quiet"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {t('photo_remove')}
          </Button>
        )}
      </div>
      {unreadable && (
        <p className={styles.error} role="alert">
          {t('err_image_not_supported')}
        </p>
      )}
      <FormError error={upload.error ?? remove.error} />
    </div>
  );
}
