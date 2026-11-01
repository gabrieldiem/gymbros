import { Navigate, Route, Routes } from 'react-router';

import { AppShell } from './components/AppShell';
import { AuthLayout } from './features/auth/AuthLayout';
import { Gate } from './features/auth/Gate';
import { HelloPage } from './features/auth/HelloPage';
import { JoinPage } from './features/auth/JoinPage';
import { LoginPage } from './features/auth/LoginPage';
import { WelcomePage } from './features/auth/WelcomePage';
import { ClimbPage } from './features/climb/ClimbPage';
import { CrewPage } from './features/crew/CrewPage';
import { MePage } from './features/me/MePage';
import { NotFoundPage } from './features/NotFoundPage';
import { PrivacyPage, TermsPage } from './features/legal/LegalPages';
import { QuestsPage } from './features/quests/QuestsPage';
import { TrainPage } from './features/train/TrainPage';

export function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route element={<Gate allow="guest" />}>
          <Route path="welcome" element={<WelcomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<Navigate to="/welcome" replace />} />
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
          <Route index element={<Navigate to="/climb" replace />} />
          <Route path="climb" element={<ClimbPage />} />
          <Route path="crew" element={<CrewPage />} />
          <Route path="train" element={<TrainPage />} />
          <Route path="quests" element={<QuestsPage />} />
          <Route path="me" element={<MePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
