import { Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute';
import RequirePermissions from './components/RequirePermissions';
import MainLayout from './layouts/MainLayout';
import AnimalsPage from './pages/AnimalsPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import NewServicePage from './pages/NewServicePage';
import OwnersPage from './pages/OwnersPage';
import ServicesPage from './pages/ServicesPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import UsersPage from './pages/UsersPage';

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route element={<RequirePermissions permissions={['owners:read']} />}>
            <Route path="owners" element={<OwnersPage />} />
          </Route>
          <Route element={<RequirePermissions permissions={['animals:read']} />}>
            <Route path="animals" element={<AnimalsPage />} />
          </Route>
          <Route element={<RequirePermissions permissions={['services:read']} />}>
            <Route path="services" element={<ServicesPage />} />
          </Route>
          <Route element={<RequirePermissions permissions={['services:write']} />}>
            <Route path="new-service" element={<NewServicePage />} />
          </Route>
          <Route element={<RequirePermissions permissions={['users:manage']} />}>
            <Route path="users" element={<UsersPage />} />
          </Route>
          <Route path="unauthorized" element={<UnauthorizedPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
