import { Navigate, Outlet } from 'react-router';

import { useMe } from '../../api/me';
import { LoadErrorScreen, LoadingScreen } from '../../components/StatusScreen';
import { isCrewWelcomePending } from './crewWelcome';
import { gateRedirect, type Allow } from './gate';
import { pendingInvite } from './pendingInvite';

/** Route guard: renders the child routes or redirects, once the session is known. */
export function Gate({ allow }: { allow: Allow }) {
  const me = useMe();
  if (me.isPending) return <LoadingScreen />;
  // What's on the phone can be out of date. Only the member screens go ahead with it, because
  // they're what has to work with no signal; a paused request here isn't fetching.
  if (allow !== 'member' && me.fetchStatus === 'fetching') return <LoadingScreen />;
  // With no signal, who you were last time is enough to keep going.
  if (me.isError && me.data === undefined) {
    return <LoadErrorScreen onRetry={() => void me.refetch()} />;
  }
  const redirect = gateRedirect(allow, me.data, isCrewWelcomePending(), Boolean(pendingInvite()));
  return redirect ? <Navigate to={redirect} replace /> : <Outlet />;
}
