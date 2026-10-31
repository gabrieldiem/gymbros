import { Navigate, Route, Routes } from 'react-router';

import { AppShell } from './components/AppShell';
import { ClimbPage } from './features/climb/ClimbPage';
import { CrewPage } from './features/crew/CrewPage';
import { MePage } from './features/me/MePage';
import { NotFoundPage } from './features/NotFoundPage';
import { QuestsPage } from './features/quests/QuestsPage';
import { TrainPage } from './features/train/TrainPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/climb" replace />} />
        <Route path="climb" element={<ClimbPage />} />
        <Route path="crew" element={<CrewPage />} />
        <Route path="train" element={<TrainPage />} />
        <Route path="quests" element={<QuestsPage />} />
        <Route path="me" element={<MePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
