import { Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute';
import RequireModules from './components/RequireModules';
import MainLayout from './layouts/MainLayout';
import AnimalsPage from './pages/AnimalsPage';
import AttendancesPage from './pages/AttendancesPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import NewServicePage from './pages/NewServicePage';
import OwnersPage from './pages/OwnersPage';
import RolesPage from './pages/RolesPage';
import ServicesPage from './pages/ServicesPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import UsersPage from './pages/UsersPage';
import PaymentConditionsPage from './pages/PaymentConditionsPage';
import ProductsPage from './pages/ProductsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import CalendarPage from './pages/CalendarPage';
import CashierPage from './pages/CashierPage';
import AccountingPage from './pages/AccountingPage';
import AnimalAttendancesPage from './pages/AnimalAttendancesPage';

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
          <Route element={<RequireModules modules={['animals:read', 'owners:read']} />}>
            <Route path="animals" element={<AnimalsPage />} />
            <Route path="animals/:id/attendances" element={<AnimalAttendancesPage />} />
          </Route>
          <Route element={<RequireModules modules={['services:read']} />}>
            <Route path="services" element={<ServicesPage />} />
          </Route>
          <Route element={<RequireModules modules={['services:read', 'animals:read', 'owners:read']} />}>
            <Route path="attendances" element={<AttendancesPage />} />
          </Route>
          <Route element={<RequireModules modules={['services:read', 'owners:read', 'animals:read']} />}>
            <Route path="appointments" element={<AppointmentsPage />} />
          </Route>
          <Route element={<RequireModules modules={['services:read']} />}>
            <Route path="calendar" element={<CalendarPage />} />
          </Route>
          <Route element={<RequireModules modules={['products:read']} />}>
            <Route path="products" element={<ProductsPage />} />
          </Route>
          <Route element={<RequireModules modules={['cashier:access']} />}>
            <Route path="accounting" element={<AccountingPage />} />
          </Route>
          <Route element={<RequireModules modules={['cashier:access']} />}>
            <Route path="payment-conditions" element={<PaymentConditionsPage />} />
          </Route>
          <Route element={<RequireModules modules={['cashier:access']} />}>
            <Route path="cashier" element={<CashierPage />} />
          </Route>
          <Route
            element={<RequireModules modules={['services:write', 'animals:read', 'products:read']} />}
          >
            <Route path="new-service" element={<NewServicePage />} />
            <Route path="services/:id/edit" element={<NewServicePage />} />
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
