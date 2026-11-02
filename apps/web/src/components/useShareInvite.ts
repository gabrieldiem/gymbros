import { useMe } from '../api/me';
import { inviteUrl } from '../features/auth/pendingInvite';
import { useI18n } from '../i18n/context';
import { useToast } from './toast';

/** Share the crew's invite link: the phone's share sheet, or the clipboard on desktop. */
export function useShareInvite(): (() => Promise<void>) | null {
  const { t } = useI18n();
  const crew = useMe().data?.crew;
  const showToast = useToast();
  if (!crew) return null;

  return async () => {
    const url = inviteUrl(crew.invite_code);
    const text = t('invite_share_text', { crew: crew.name });
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'GYMBROS', text, url });
        return;
      } catch (error) {
        // Closing the share sheet isn't a failure; anything else falls through to the clipboard.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('invite_copied'));
    } catch {
      showToast(t('invite_copy_failed', { url }), { alert: true });
    }
  };
}
