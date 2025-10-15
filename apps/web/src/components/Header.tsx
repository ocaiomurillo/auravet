import { NavLink } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

import Button from './Button';
import LogoAuravet from './LogoAuravet';

const navItems: Array<{ to: string; label: string; module?: string }> = [
  { to: '/', label: 'Início' },
  { to: '/owners', label: 'Tutores', module: 'owners:read' },
  { to: '/animals', label: 'Animais', module: 'animals:read' },
  { to: '/appointments', label: 'Agendamentos', module: 'services:read' },
  { to: '/calendar', label: 'Agenda', module: 'services:read' },
  { to: '/services', label: 'Serviços', module: 'services:read' },
  { to: '/products', label: 'Produtos', module: 'products:read' },
  { to: '/cashier', label: 'Caixa', module: 'cashier:access' },
  { to: '/new-service', label: 'Registrar atendimento', module: 'services:write' },
  { to: '/users', label: 'Usuários', module: 'users:manage' },
  { to: '/roles', label: 'Funções', module: 'users:manage' },
];

const Header = () => {
  const { user, logout, hasModule } = useAuth();

  const availableNavItems = navItems.filter((item) => !item.module || hasModule(item.module));

  return (
    <header className="bg-white/70 backdrop-blur border-b border-brand-azul/30">
      <div className="mx-auto grid max-w-6xl gap-4 px-6 py-5 md:grid-cols-[auto,1fr,auto] md:items-center">
        <div className="flex items-center gap-4">
          <LogoAuravet className="h-14 w-14" />
          <div>
            <p className="font-montserrat text-xl font-semibold text-brand-escuro">Auravet</p>
            <p className="text-sm text-brand-grafite/70">Cuidar é natural.</p>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold uppercase tracking-wide text-brand-escuro">
          {availableNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 transition hover:bg-brand-azul/30 ${
                  isActive ? 'bg-brand-savia/60 text-brand-grafite shadow-sm' : 'text-brand-grafite/80'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col items-start justify-center gap-2 text-sm text-brand-grafite/80 md:items-end">
          {user ? (
            <>
              <div className="text-right">
                <p className="font-semibold text-brand-escuro">{user.nome}</p>
                <p className="text-xs uppercase tracking-wide text-brand-grafite/70">
                  {user.role.name}
                </p>
              </div>
              <Button variant="ghost" className="px-3 py-1 text-xs" onClick={logout}>
                Sair
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default Header;
