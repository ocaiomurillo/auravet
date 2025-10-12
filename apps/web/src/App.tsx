import { Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute';
import RequireModules from './components/RequireModules';
import MainLayout from './layouts/MainLayout';
import AnimalsPage from './pages/AnimalsPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import NewServicePage from './pages/NewServicePage';
import OwnersPage from './pages/OwnersPage';
import RolesPage from './pages/RolesPage';
import ServicesPage from './pages/ServicesPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import UsersPage from './pages/UsersPage';
import ProductsPage from './pages/ProductsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import CalendarPage from './pages/CalendarPage';

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route element={<RequireModules modules={['owners:read']} />}>
            <Route path="owners" element={<OwnersPage />} />
          </Route>
          <Route element={<RequireModules modules={['animals:read']} />}>
            <Route path="animals" element={<AnimalsPage />} />
          </Route>
          <Route element={<RequireModules modules={['services:read']} />}>
            <Route path="services" element={<ServicesPage />} />
          </Route>
          <Route element={<RequireModules modules={['services:read']} />}>
            <Route path="appointments" element={<AppointmentsPage />} />
          </Route>
          <Route element={<RequireModules modules={['services:read']} />}>
            <Route path="calendar" element={<CalendarPage />} />
          </Route>
          <Route element={<RequireModules modules={['products:read']} />}>
            <Route path="products" element={<ProductsPage />} />
          </Route>
          <Route element={<RequireModules modules={['services:write']} />}>
            <Route path="new-service" element={<NewServicePage />} />
          </Route>
          <Route element={<RequireModules modules={['users:manage']} />}>
            <Route path="users" element={<UsersPage />} />
          </Route>
          <Route element={<RequireModules modules={['users:manage']} />}>
            <Route path="roles" element={<RolesPage />} />
          </Route>
          <Route path="unauthorized" element={<UnauthorizedPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
