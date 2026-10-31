import { Navigate, Outlet } from 'react-router';

import { useMe } from '../../api/me';
import { LoadErrorScreen, LoadingScreen } from '../../components/StatusScreen';
import { isCrewWelcomePending } from './crewWelcome';
import { gateRedirect, type Allow } from './gate';

/** Route guard: renders the child routes or redirects, once the session is known. */
export function Gate({ allow }: { allow: Allow }) {
  const me = useMe();
  if (me.isPending) return <LoadingScreen />;
  if (me.isError) return <LoadErrorScreen onRetry={() => void me.refetch()} />;
  const redirect = gateRedirect(allow, me.data, isCrewWelcomePending());
  return redirect ? <Navigate to={redirect} replace /> : <Outlet />;
}
