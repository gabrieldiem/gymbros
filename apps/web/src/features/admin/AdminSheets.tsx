import { useState, type FormEvent } from 'react';

import {
  useAdjustPoints,
  useCreateCrew,
  useDeleteAccount,
  useRemoveFromCrew,
  useRotateInviteCode,
  useUpdateCrew,
  type AdminCrew,
  type AdminMember,
} from '../../api/admin';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/toast';
import { useI18n } from '../../i18n/context';
import styles from './Admin.module.css';

const DEFAULT_TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Create a crew, or edit one and rotate its invite code. */
export function CrewSheet({ crew, onClose }: { crew: AdminCrew | null; onClose: () => void }) {
  const { t } = useI18n();
  const showToast = useToast();
  const create = useCreateCrew();
  const update = useUpdateCrew();
  const rotate = useRotateInviteCode();
  const [name, setName] = useState(crew?.name ?? '');
  const [timeZone, setTimeZone] = useState(crew?.time_zone ?? DEFAULT_TIME_ZONE);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const save = crew ? update : create;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const body = { name: name.trim(), time_zone: timeZone.trim() };
    const done = {
      onSuccess: () => {
        showToast(t('saved'));
        onClose();
      },
    };
    if (crew) update.mutate({ id: crew.id, ...body }, done);
    else create.mutate(body, done);
  };

  return (
    <Sheet title={crew ? crew.name : t('admin_new_crew')} onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <TextField
          label={t('admin_crew_name')}
          required
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label={t('admin_time_zone')}
          hint={t('admin_time_zone_hint')}
          required
          maxLength={64}
          value={timeZone}
          onChange={(e) => setTimeZone(e.target.value)}
        />
        <FormError error={save.error} />
        <Button type="submit" wide disabled={save.isPending}>
          {t('save')}
        </Button>
      </form>
      {crew && (
        <div className={styles.danger}>
          <h3>{t('admin_invite_code')}</h3>
          <p>
            <code className={styles.code}>{crew.invite_code}</code>
          </p>
          <p className={styles.muted}>{t('admin_rotate_hint')}</p>
          <FormError error={rotate.error} />
          <Button
            variant="ghost"
            wide
            disabled={rotate.isPending}
            onClick={() =>
              confirmRotate
                ? rotate.mutate(crew.id, {
                    onSuccess: () => {
                      showToast(t('admin_rotated'));
                      onClose();
                    },
                  })
                : setConfirmRotate(true)
            }
          >
            {confirmRotate ? t('admin_rotate_confirm') : t('admin_rotate')}
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function AdjustPoints({ member, onDone }: { member: AdminMember; onDone: () => void }) {
  const { t } = useI18n();
  const showToast = useToast();
  const adjust = useAdjustPoints();
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const amount = Number(points);
  const valid = Number.isInteger(amount) && amount !== 0 && reason.trim().length >= 3;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    adjust.mutate(
      { id: member.id, points: amount, reason: reason.trim() },
      {
        onSuccess: () => {
          showToast(t('admin_adjusted'));
          onDone();
        },
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h3>{t('admin_adjust')}</h3>
      <TextField
        label={t('admin_adjust_points')}
        hint={t('admin_adjust_points_hint')}
        type="number"
        inputMode="numeric"
        min={-5000}
        max={5000}
        value={points}
        onChange={(e) => setPoints(e.target.value)}
      />
      <TextField
        label={t('admin_adjust_reason')}
        maxLength={140}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <FormError error={adjust.error} />
      <Button type="submit" variant="ghost" wide disabled={!valid || adjust.isPending}>
        {t('admin_adjust')}
      </Button>
    </form>
  );
}

function DangerZone({ member, onDone }: { member: AdminMember; onDone: () => void }) {
  const { t } = useI18n();
  const showToast = useToast();
  const remove = useRemoveFromCrew();
  const destroy = useDeleteAccount();
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLowerCase() === member.email.toLowerCase();
  const finish = (message: string) => ({
    onSuccess: () => {
      showToast(message);
      onDone();
    },
  });
  return (
    <div className={styles.danger}>
      {member.crew_name && (
        <>
          <h3>{t('admin_remove')}</h3>
          <p className={styles.muted}>{t('admin_remove_hint', { crew: member.crew_name })}</p>
          <FormError error={remove.error} />
          <Button
            variant="ghost"
            wide
            disabled={remove.isPending}
            onClick={() => remove.mutate(member.id, finish(t('admin_removed')))}
          >
            {t('admin_remove')}
          </Button>
        </>
      )}
      <h3>{t('delete_account')}</h3>
      <p className={styles.muted}>{t('admin_delete_hint')}</p>
      <TextField
        label={t('delete_type_email', { email: member.email })}
        autoComplete="off"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
      />
      <FormError error={destroy.error} />
      <button
        type="button"
        className={styles.destroy}
        disabled={!matches || destroy.isPending}
        onClick={() => destroy.mutate(member.id, finish(t('admin_deleted')))}
      >
        {t('delete_account')}
      </button>
    </div>
  );
}

/** One account: adjust points, remove from the crew, or delete. */
export function MemberSheet({ member, onClose }: { member: AdminMember; onClose: () => void }) {
  const { t, n } = useI18n();
  return (
    <Sheet title={member.display_name} onClose={onClose}>
      <p className={styles.muted}>
        {member.email}, {t('pts_n', { n: n(member.points) })},{' '}
        {t('admin_workouts_n', { n: member.workouts })}
      </p>
      {member.crew_name && <AdjustPoints member={member} onDone={onClose} />}
      <DangerZone member={member} onDone={onClose} />
    </Sheet>
  );
}
