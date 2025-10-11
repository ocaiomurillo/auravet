import { Navigate, Outlet, useLocation } from 'react-router-dom';

import type { Permission } from '../types/api';
import { useAuth } from '../contexts/AuthContext';

interface RequirePermissionsProps {
  permissions: Permission[];
}

const RequirePermissions = ({ permissions }: RequirePermissionsProps) => {
  const { hasPermission } = useAuth();
  const location = useLocation();

  const allowed = permissions.some((permission) => hasPermission(permission));

  if (!allowed) {
    return <Navigate to="/unauthorized" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default RequirePermissions;
