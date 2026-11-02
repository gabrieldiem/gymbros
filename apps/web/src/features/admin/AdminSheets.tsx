import { Check, Coins, Copy, UserMinus } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import {
  useAdjustPoints,
  useCreateCrew,
  useDeleteAccount,
  useRemoveFromCrew,
  useRotateInviteCode,
  useSendInvite,
  useUpdateCrew,
  type AdminCrew,
  type AdminMember,
  type CrewChanges,
} from '../../api/admin';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/toast';
import { useI18n } from '../../i18n/context';
import { inviteUrl } from '../auth/pendingInvite';
import styles from './Admin.module.css';

const DEFAULT_TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** An ISO time as a datetime-local input wants it, in the browser's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** What the form changes. Unchanged fields stay out, so a past expiry doesn't block a rename. */
function crewChanges(crew: AdminCrew | null, fields: CrewFields): CrewChanges {
  const changes: CrewChanges = {};
  const name = fields.name.trim();
  const timeZone = fields.timeZone.trim();
  const code = fields.code.trim();
  const maxUses = fields.maxUses === '' ? null : Number(fields.maxUses);
  const expires = fields.expires === '' ? null : new Date(fields.expires).toISOString();
  if (name !== crew?.name) changes.name = name;
  if (timeZone !== crew?.time_zone) changes.time_zone = timeZone;
  if (code && code !== crew?.invite_code) changes.invite_code = code;
  if (maxUses !== (crew?.invite_max_uses ?? null)) changes.invite_max_uses = maxUses;
  if (fields.expires !== toLocalInput(crew?.invite_expires_at ?? null)) {
    changes.invite_expires_at = expires;
  }
  return changes;
}

type CrewFields = {
  name: string;
  timeZone: string;
  code: string;
  maxUses: string;
  expires: string;
};

function useCopyLink() {
  const { t } = useI18n();
  const showToast = useToast();
  return async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      showToast(t('invite_copied'));
    } catch {
      showToast(t('invite_copy_failed', { url: link }), { alert: true });
    }
  };
}

/** Email the crew's invite link. If the email can't go out, the link is there to share by hand. */
function SendInvite({ crew }: { crew: AdminCrew }) {
  const { t, lang } = useI18n();
  const showToast = useToast();
  const copyLink = useCopyLink();
  const send = useSendInvite();
  const [email, setEmail] = useState('');
  const [unsent, setUnsent] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setUnsent(null);
    send.mutate(
      { id: crew.id, email: email.trim(), language: lang },
      {
        onSuccess: (result) => {
          if (result.sent) {
            showToast(t('admin_invite_sent', { email: email.trim() }));
            setEmail('');
          } else {
            setUnsent(result.link);
          }
        },
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h3>{t('admin_send_invite')}</h3>
      <p className={styles.muted}>{t('admin_send_invite_hint')}</p>
      <TextField
        label={t('field_email')}
        type="email"
        autoComplete="off"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <FormError error={send.error} />
      {unsent && (
        <div className={styles.unsent} role="alert">
          <p>{t('admin_invite_unsent')}</p>
          <Button icon={Copy} variant="ghost" wide onClick={() => void copyLink(unsent)}>
            {t('admin_copy_link')}
          </Button>
        </div>
      )}
      <Button type="submit" wide disabled={send.isPending}>
        {send.isPending ? t('admin_sending') : t('admin_send')}
      </Button>
    </form>
  );
}

/** Create a crew, or edit one: its details, invite code and limits, and inviting people. */
export function CrewSheet({ crew, onClose }: { crew: AdminCrew | null; onClose: () => void }) {
  const { t, n } = useI18n();
  const showToast = useToast();
  const copyLink = useCopyLink();
  const create = useCreateCrew();
  const update = useUpdateCrew();
  const rotate = useRotateInviteCode();
  const [fields, setFields] = useState<CrewFields>({
    name: crew?.name ?? '',
    timeZone: crew?.time_zone ?? DEFAULT_TIME_ZONE,
    code: crew?.invite_code ?? '',
    maxUses: crew?.invite_max_uses?.toString() ?? '',
    expires: toLocalInput(crew?.invite_expires_at ?? null),
  });
  const [confirmRotate, setConfirmRotate] = useState(false);
  const save = crew ? update : create;
  const set = (key: keyof CrewFields) => (e: { target: { value: string } }) =>
    setFields((current) => ({ ...current, [key]: e.target.value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const changes = crewChanges(crew, fields);
    const done = {
      onSuccess: () => {
        showToast(t('saved'));
        onClose();
      },
    };
    if (crew) update.mutate({ id: crew.id, ...changes }, done);
    else create.mutate(changes, done);
  };

  return (
    <Sheet title={crew ? crew.name : t('admin_new_crew')} onClose={onClose}>
      {crew && crew.invite_status === 'active' && <SendInvite crew={crew} />}
      <form className={styles.form} onSubmit={handleSubmit}>
        {crew && <h3>{t('admin_crew_details')}</h3>}
        <TextField
          label={t('admin_crew_name')}
          required
          maxLength={40}
          value={fields.name}
          onChange={set('name')}
        />
        <TextField
          label={t('admin_time_zone')}
          hint={t('admin_time_zone_hint')}
          required
          maxLength={64}
          value={fields.timeZone}
          onChange={set('timeZone')}
        />
        <h3>{t('admin_invite_code')}</h3>
        {crew && (
          <p className={styles.muted}>
            {t(`admin_invite_status_${crew.invite_status}`)}.{' '}
            {crew.invite_max_uses === null
              ? crew.invite_uses === 1
                ? t('admin_uses_1')
                : t('admin_uses_n', { n: n(crew.invite_uses) })
              : t('admin_uses_of', { n: n(crew.invite_uses), max: n(crew.invite_max_uses) })}
          </p>
        )}
        <TextField
          label={t('admin_custom_code')}
          hint={t('admin_custom_code_hint')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          value={fields.code}
          onChange={set('code')}
        />
        <TextField
          label={t('admin_max_uses')}
          hint={t('admin_max_uses_hint')}
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          value={fields.maxUses}
          onChange={set('maxUses')}
        />
        <TextField
          label={t('admin_expires')}
          hint={t('admin_expires_hint')}
          type="datetime-local"
          value={fields.expires}
          onChange={set('expires')}
        />
        <FormError error={save.error} />
        <Button icon={Check} type="submit" wide disabled={save.isPending}>
          {t('save')}
        </Button>
      </form>
      {crew && (
        <div className={styles.danger}>
          <Button
            icon={Copy}
            variant="ghost"
            wide
            onClick={() => void copyLink(inviteUrl(crew.invite_code))}
          >
            {t('admin_copy_link')}
          </Button>
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
      <Button icon={Coins} type="submit" variant="ghost" wide disabled={!valid || adjust.isPending}>
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
            icon={UserMinus}
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
        {member.workouts === 1
          ? t('admin_workouts_1')
          : t('admin_workouts_n', { n: member.workouts })}
      </p>
      {member.crew_name && <AdjustPoints member={member} onDone={onClose} />}
      <DangerZone member={member} onDone={onClose} />
    </Sheet>
  );
}
