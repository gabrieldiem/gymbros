import { Camera, Check, ImageIcon, Palette, Pipette, Trash2 } from 'lucide-react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { useMe, useRemoveAvatar, useUpdateMe, useUploadAvatar } from '../../api/me';
import type { CrewColor } from '../../api/types';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { inkOn, memberColorHex } from '../../components/memberColor';
import { resizeImage } from '../../components/resizeImage';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/toast';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import styles from './Me.module.css';
import { firstCharacters } from './profileText';

const PICTURE_SIDE = 256;

const COLORS: { value: CrewColor; label: MessageKey }[] = [
  { value: 'volt', label: 'color_volt' },
  { value: 'red', label: 'color_red' },
  { value: 'cyan', label: 'color_cyan' },
  { value: 'pink', label: 'color_pink' },
  { value: 'violet', label: 'color_violet' },
  { value: '#ff8a1f', label: 'color_orange' },
  { value: '#a6f000', label: 'color_lime' },
  { value: '#2ed573', label: 'color_green' },
  { value: '#3d8bff', label: 'color_blue' },
  { value: '#ff7a9a', label: 'color_rose' },
  { value: '#f2f2ee', label: 'color_white' },
];

function NameAndCharacters() {
  const { t } = useI18n();
  const me = useMe().data;
  const updateMe = useUpdateMe();
  const showToast = useToast();
  const [name, setName] = useState(me?.display_name ?? '');
  const [characters, setCharacters] = useState(me?.initials ?? '');
  const newName = name.trim() !== me?.display_name;
  const newCharacters = characters.trim() !== me?.initials;
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    updateMe.mutate(
      {
        ...(newName ? { display_name: name.trim() } : {}),
        ...(newCharacters ? { initials: characters.trim() } : {}),
      },
      { onSuccess: () => showToast(t('saved')) },
    );
  };
  return (
    <form className={styles.profileForm} onSubmit={handleSubmit}>
      <TextField
        label={t('settings_name')}
        hint={t('settings_name_hint')}
        autoComplete="nickname"
        required
        maxLength={24}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextField
        label={t('profile_characters')}
        hint={t('profile_characters_hint')}
        autoComplete="off"
        required
        value={characters}
        onChange={(e) => setCharacters(firstCharacters(e.target.value))}
      />
      <FormError error={updateMe.error} />
      <Button
        icon={Check}
        type="submit"
        variant="ghost"
        disabled={
          !name.trim() || !characters.trim() || (!newName && !newCharacters) || updateMe.isPending
        }
      >
        {t('save')}
      </Button>
    </form>
  );
}

function Picture() {
  const { t } = useI18n();
  const me = useMe().data;
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const input = useRef<HTMLInputElement>(null);
  const [unreadable, setUnreadable] = useState(false);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // So choosing the same file again still fires.
    if (!file) return;
    setUnreadable(false);
    try {
      upload.mutate(await resizeImage(file, { maxSide: PICTURE_SIDE, square: true }));
    } catch {
      setUnreadable(true);
    }
  };

  return (
    <div>
      <h3 className={styles.iconTitle}>
        <ImageIcon size={18} aria-hidden="true" />
        {t('profile_picture')}
      </h3>
      <p>{t('profile_picture_hint')}</p>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept="image/*"
        aria-label={t('profile_picture_choose')}
        tabIndex={-1}
        onChange={(e) => void handleFile(e)}
      />
      <div className={styles.pictureActions}>
        <Button
          type="button"
          variant="ghost"
          icon={Camera}
          disabled={upload.isPending}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? t('profile_picture_uploading') : t('profile_picture_choose')}
        </Button>
        {me?.avatar_url && (
          <Button
            icon={Trash2}
            type="button"
            variant="quiet"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {t('profile_picture_remove')}
          </Button>
        )}
      </div>
      {unreadable && (
        <p className={styles.error} role="alert">
          {t('err_image_not_supported')}
        </p>
      )}
      <FormError error={upload.error} />
    </div>
  );
}

function ColorPicker() {
  const { t } = useI18n();
  const me = useMe().data;
  const updateMe = useUpdateMe();
  const isPreset = COLORS.some(({ value }) => value === me?.color);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState('#3d8bff');
  return (
    <div>
      <h3 className={styles.iconTitle}>
        <Palette size={18} aria-hidden="true" />
        {t('settings_color')}
      </h3>
      <div className={styles.colors} role="group" aria-label={t('settings_color')}>
        {COLORS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={styles.color}
            style={{ background: memberColorHex(value) }}
            aria-pressed={me?.color === value}
            aria-label={t(label)}
            onClick={() => updateMe.mutate({ color: value })}
          />
        ))}
        <button
          type="button"
          className={styles.customColor}
          style={me && !isPreset ? { background: me.color } : undefined}
          aria-pressed={Boolean(me) && !isPreset}
          aria-expanded={picking}
          aria-label={t('color_custom')}
          title={t('color_custom')}
          onClick={() => {
            setDraft(me ? memberColorHex(me.color) : '#3d8bff');
            setPicking((open) => !open);
          }}
        >
          <Pipette
            size={18}
            aria-hidden="true"
            color={me && !isPreset ? inkOn(me.color) : '#0D0D0D'}
          />
        </button>
      </div>
      {me && !isPreset && !picking && (
        <p className={styles.customNote}>{t('color_custom_is', { hex: me.color })}</p>
      )}
      {picking && (
        <div className={styles.picker}>
          <HexColorPicker color={draft} onChange={setDraft} />
          <div className={styles.pickerRow}>
            <span className={styles.pickerSwatch} style={{ background: draft }} />
            <label className={styles.pickerHex}>
              <span className="sr-only">{t('color_hex')}</span>
              <HexColorInput
                color={draft}
                onChange={setDraft}
                prefixed
                aria-label={t('color_hex')}
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              icon={Check}
              disabled={updateMe.isPending || !/^#[0-9a-f]{6}$/i.test(draft)}
              onClick={() =>
                updateMe.mutate(
                  { color: draft.toLowerCase() as CrewColor },
                  { onSuccess: () => setPicking(false) },
                )
              }
            >
              {t('color_use')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Your name, your picture or characters, and your color, with how you'll look as you change it. */
export function ProfileSection() {
  const me = useMe().data;
  return (
    <>
      {me && (
        <div className={styles.profilePreview}>
          <Avatar initials={me.initials} color={me.color} image={me.avatar_url} size={88} />
        </div>
      )}
      <NameAndCharacters />
      <Picture />
      <ColorPicker />
    </>
  );
}
