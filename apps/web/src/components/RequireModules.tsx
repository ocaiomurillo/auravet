import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

interface RequireModulesProps {
  modules: string[];
  mode?: 'all' | 'any';
}

export const hasAllRequiredModules = (
  modules: string[],
  hasModule: (module: string) => boolean,
) => modules.every((module) => hasModule(module));

const RequireModules = ({ modules, mode = 'all' }: RequireModulesProps) => {
  const { hasModule } = useAuth();
  const location = useLocation();

  const allowed =
    mode === 'any'
      ? modules.some((module) => hasModule(module))
      : hasAllRequiredModules(modules, hasModule);

  if (!allowed) {
    return <Navigate to="/unauthorized" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default RequireModules;
