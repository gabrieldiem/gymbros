import { Navigate, Route, Routes } from 'react-router';

import { AppShell } from './components/AppShell';
import { AuthLayout } from './features/auth/AuthLayout';
import { Gate } from './features/auth/Gate';
import { HelloPage } from './features/auth/HelloPage';
import { InvitePage } from './features/auth/InvitePage';
import { JoinPage } from './features/auth/JoinPage';
import { LoginPage } from './features/auth/LoginPage';
import { ClimbPage } from './features/climb/ClimbPage';
import { CrewPage } from './features/crew/CrewPage';
import { MePage } from './features/me/MePage';
import { NotFoundPage } from './features/NotFoundPage';
import { AdminPage } from './features/admin/AdminPage';
import { LandingPage } from './features/landing/LandingPage';
import { PrivacyPage, TermsPage } from './features/legal/LegalPages';
import { QuestsPage } from './features/quests/QuestsPage';
import { TrainPage } from './features/train/TrainPage';
import { WhatsNewPage } from './features/whatsnew/WhatsNewPage';

export function App() {
  return (
    <Routes>
      <Route index element={<LandingPage />} />
      <Route path="welcome" element={<Navigate to="/" replace />} />
      <Route path="register" element={<Navigate to="/" replace />} />
      <Route element={<Gate allow="admin" />}>
        <Route path="admin" element={<AdminPage />} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="invite/:code" element={<InvitePage />} />
        <Route element={<Gate allow="guest" />}>
          <Route path="login" element={<LoginPage />} />
        </Route>
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route element={<Gate allow="join" />}>
          <Route path="join" element={<JoinPage />} />
        </Route>
        <Route element={<Gate allow="hello" />}>
          <Route path="hello" element={<HelloPage />} />
        </Route>
      </Route>
      <Route element={<Gate allow="member" />}>
        <Route element={<AppShell />}>
          <Route path="climb" element={<ClimbPage />} />
          <Route path="crew" element={<CrewPage />} />
          <Route path="train" element={<TrainPage />} />
          <Route path="quests" element={<QuestsPage />} />
          <Route path="quests/achievements" element={<QuestsPage />} />
          <Route path="quests/points" element={<QuestsPage />} />
          <Route path="me" element={<MePage />} />
          <Route path="whats-new" element={<WhatsNewPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
