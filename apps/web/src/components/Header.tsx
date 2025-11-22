import { useMemo } from 'react';

import { useAuth } from '../contexts/AuthContext';

import Button from './Button';
import LogoAuravet from './LogoAuravet';

export const SidebarBranding = () => (
  <div className="flex items-center gap-4 px-2">
    <LogoAuravet className="h-14 w-14" />
    <div>
      <p className="font-montserrat text-xl font-semibold text-brand-escuro">Auravet</p>
      <p className="text-sm text-brand-grafite/70">Cuidar é natural.</p>
    </div>
  </div>
);

export const SidebarUserInfo = () => {
  const { user } = useAuth();

  const initials = useMemo(() => {
    if (!user?.nome) return '';
    return user.nome
      .split(' ')
      .filter(Boolean)
      .map((piece) => piece[0]?.toUpperCase())
      .join('')
      .slice(0, 2);
  }, [user?.nome]);

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brand-azul/20 bg-white/70 px-4 py-3 text-sm text-brand-grafite/80 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-azul/20 font-semibold text-brand-azul">
        {initials}
      </div>
      <div>
        <p className="font-semibold text-brand-escuro">{user.nome}</p>
        <p className="text-xs uppercase tracking-wide text-brand-grafite/70">{user.role.name}</p>
      </div>
    </div>
  );
};

export const LogoutButton = () => {
  const { logout } = useAuth();

  return (
    <Button
      variant="ghost"
      className="w-fit rounded-full px-4 py-2 text-xs font-semibold"
      onClick={logout}
    >
      Sair
    </Button>
  );
};

const Header = () => (
  <div className="flex flex-col gap-5">
    <div className="flex items-center justify-start">
      <LogoutButton />
    </div>
    <SidebarBranding />
    <SidebarUserInfo />
  </div>
);

export default Header;
