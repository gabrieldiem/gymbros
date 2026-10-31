import { errorCode } from '../../api/errors';
import { useNudge, type Actor } from '../../api/social';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useToast } from '../../components/toast';
import { useI18n } from '../../i18n/context';
import styles from './Feed.module.css';

/** "Matex hasn't logged a workout in 3 days." with a Nudge button. */
export function NudgePrompt({ member, days }: { member: Actor; days: number }) {
  const { t } = useI18n();
  const nudge = useNudge();
  const showToast = useToast();
  const name = member.display_name;

  const handleNudge = () =>
    nudge.mutate(member.user_id, {
      onSuccess: () => showToast(t('nudge_sent', { name })),
      onError: (error) =>
        showToast(
          errorCode(error) === 'already_nudged' ? t('nudge_already', { name }) : t('err_generic'),
          {
            alert: true,
          },
        ),
    });

  return (
    <li className={styles.event}>
      <Avatar initials={member.initials} color={member.color} size={38} />
      <p>
        <b>{name}</b> {t('ev_nudge', { d: days })}
      </p>
      <Button variant="ghost" onClick={handleNudge} disabled={nudge.isPending || nudge.isSuccess}>
        {t('nudge')}
      </Button>
    </li>
  );
}
