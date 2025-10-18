import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

interface RequireModulesProps {
  modules: string[];
}

export const hasAllRequiredModules = (
  modules: string[],
  hasModule: (module: string) => boolean,
) => modules.every((module) => hasModule(module));

const RequireModules = ({ modules }: RequireModulesProps) => {
  const { hasModule } = useAuth();
  const location = useLocation();

  const allowed = hasAllRequiredModules(modules, hasModule);

  if (!allowed) {
    return <Navigate to="/unauthorized" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default RequireModules;
