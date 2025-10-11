import { NavLink } from 'react-router-dom';

import LogoAuravet from './LogoAuravet';

const navItems = [
  { to: '/', label: 'Início' },
  { to: '/owners', label: 'Tutores' },
  { to: '/animals', label: 'Animais' },
  { to: '/services', label: 'Serviços' },
  { to: '/new-service', label: 'Registrar serviço' },
];

const Header = () => {
  return (
    <header className="bg-white/70 backdrop-blur border-b border-brand-azul/30">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-4">
          <LogoAuravet className="h-14 w-14" />
          <div>
            <p className="font-montserrat text-xl font-semibold text-brand-escuro">Auravet</p>
            <p className="text-sm text-brand-grafite/70">Cuidar é natural.</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-3 text-sm font-semibold uppercase tracking-wide text-brand-escuro">
          {navItems.map((item) => (
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
      </div>
    </header>
  );
};

export default Header;
