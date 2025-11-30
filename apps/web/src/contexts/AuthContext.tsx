import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '../lib/apiClient';
import { UNAUTHORIZED_EVENT, authStorage } from '../lib/authStorage';
import type { AuthLoginResponse, User } from '../types/api';

interface RegisterUserPayload {
  nome: string;
  email: string;
  password: string;
  roleId: string;
  especialidade: string | null;
  crmv: string | null;
  turnos: string[];
  bio: string | null;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  registerUser: (payload: RegisterUserPayload) => Promise<User>;
  hasModule: (module: string) => boolean;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const currentUserQueryKey = ['auth', 'me'];

const MODULE_ALIASES: Record<string, string[]> = {
  'cashier:manage': ['cashier:access'],
  'cashier:access': ['cashier:manage'],
};

const buildLegacyAliases = (module: string) => {
  if (module.endsWith(':write')) {
    return [module.replace(':write', ':manage')];
  }

  if (module.endsWith(':manage')) {
    return [module.replace(':manage', ':write')];
  }

  return [];
};

const fetchCurrentUser = async (): Promise<User> => {
  const response = await apiClient.get<{ user: User }>('/auth/me');
  return response.user;
};

export const AuthProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [token, setToken] = useState<string | null>(() => authStorage.getToken());
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user, isLoading, refetch } = useQuery<User, Error>({
    queryKey: currentUserQueryKey,
    queryFn: fetchCurrentUser,
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (!token) {
      queryClient.removeQueries({ queryKey: currentUserQueryKey });
    }
  }, [queryClient, token]);

  useEffect(() => {
    const handleUnauthorized = () => {
      authStorage.clearToken();
      setToken(null);
      queryClient.removeQueries({ queryKey: currentUserQueryKey });
      navigate('/login');
    };

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [navigate, queryClient]);

  const login = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const result = await apiClient.post<AuthLoginResponse>('/auth/login', {
        email,
        password,
      });

      authStorage.setToken(result.token);
      setToken(result.token);
      queryClient.setQueryData(currentUserQueryKey, result.user);
      void queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      navigate('/');
    },
    [navigate, queryClient],
  );

  const logout = useCallback(() => {
    authStorage.clearToken();
    setToken(null);
    queryClient.removeQueries({ queryKey: currentUserQueryKey });
    navigate('/login');
  }, [navigate, queryClient]);

  const registerUser = useCallback(
    async (payload: RegisterUserPayload) => {
      const response = await apiClient.post<{ user: User }>('/auth/register', payload);
      return response.user;
    },
    [],
  );

  const userModules = useMemo(() => new Set(user?.modules ?? []), [user]);

  const hasModule = useCallback(
    (module: string) => {
      if (userModules.has(module)) {
        return true;
      }

      const aliases = [...(MODULE_ALIASES[module] ?? []), ...buildLegacyAliases(module)];
      if (!aliases.length) {
        return false;
      }

      return aliases.some((alias) => userModules.has(alias));
    },
    [userModules],
  );

  const refreshUser = useCallback(async () => {
    const result = await refetch();
    return result.data ?? null;
  }, [refetch]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      token,
      isLoading: Boolean(token) && isLoading,
      login,
      logout,
      registerUser,
      hasModule,
      refreshUser,
    }),
    [hasModule, isLoading, login, logout, registerUser, refreshUser, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};
