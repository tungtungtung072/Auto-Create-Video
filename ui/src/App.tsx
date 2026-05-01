import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/Layout';
import { OnboardingPage } from './routes/onboarding';
import { CreatePage } from './routes/create';
import { LibraryPage } from './routes/library';
import { LibraryDetailPage } from './routes/library-detail';
import { SettingsPage } from './routes/settings';
import { HealthPage } from './routes/health';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/create" replace />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/:id" element={<LibraryDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/health" element={<HealthPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
