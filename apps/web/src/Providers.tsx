import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { ReactNode } from 'react';

import { persistOptions } from './api/persistence';
import { ToastProvider } from './components/ToastProvider';
import { I18nProvider } from './i18n/I18nProvider';

type Props = {
  client: QueryClient;
  children: ReactNode;
  /** Keep what's needed with no signal on this device. */
  persist?: boolean;
};

export function Providers({ client, children, persist = false }: Props) {
  const app = (
    <I18nProvider>
      <ToastProvider>{children}</ToastProvider>
    </I18nProvider>
  );
  return persist ? (
    // What's on the phone is only a head start: ask the server as soon as it's restored.
    <PersistQueryClientProvider
      client={client}
      persistOptions={persistOptions}
      onSuccess={() => {
        // Not returned: the provider would hold the whole app until these answered.
        void client.invalidateQueries();
      }}
    >
      {app}
    </PersistQueryClientProvider>
  ) : (
    <QueryClientProvider client={client}>{app}</QueryClientProvider>
  );
}
