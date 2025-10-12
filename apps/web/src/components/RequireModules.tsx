import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

interface RequireModulesProps {
  modules: string[];
}

const RequireModules = ({ modules }: RequireModulesProps) => {
  const { hasModule } = useAuth();
  const location = useLocation();

  const allowed = modules.some((module) => hasModule(module));

  if (!allowed) {
    return <Navigate to="/unauthorized" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default RequireModules;
