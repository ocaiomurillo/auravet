import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

import { useAuth } from '../contexts/AuthContext';

import { SidebarBranding, SidebarUserInfo } from './Header';
import { navItems } from './navItems';

const Sidebar = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const { hasModule } = useAuth();

  const availableNavItems = useMemo(
    () => navItems.filter((item) => !item.module || hasModule(item.module)),
    [hasModule]
  );

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className={clsx(
          'fixed left-4 top-4 z-30 flex items-center gap-2 rounded-full border border-brand-azul/40 bg-white/80 px-4 py-2 text-sm font-semibold text-brand-escuro shadow-md shadow-brand-azul/10 backdrop-blur transition hover:bg-brand-azul/20 focus:outline-none focus:ring-2 focus:ring-brand-azul/50 md:hidden',
          isMobileOpen && 'hidden'
        )}
        aria-label="Abrir menu"
      >
        <Bars3Icon className="h-5 w-5" />
        Menu
      </button>

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-72 transform border-r border-brand-azul/20 bg-white/85 backdrop-blur-lg transition-transform duration-300 ease-in-out md:static md:flex md:w-72 md:flex-shrink-0 md:translate-x-0 md:border-r md:bg-white/70 md:shadow-none',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        aria-label="Barra lateral de navegação"
      >
        <div className="flex h-full flex-col gap-6 px-5 py-6">
          <div className="flex items-start justify-between gap-4">
            <SidebarBranding />
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="rounded-full p-2 text-brand-grafite/60 transition hover:bg-brand-azul/15 hover:text-brand-escuro focus:outline-none focus:ring-2 focus:ring-brand-azul/40 md:hidden"
              aria-label="Fechar menu"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto">
            <ul className="space-y-1">
              {availableNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-brand-grafite/80 transition hover:bg-brand-azul/20 hover:text-brand-escuro focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-azul/50',
                          isActive && 'bg-brand-savia/70 text-brand-escuro shadow-inner shadow-brand-savia/40'
                        )
                      }
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>

          <SidebarUserInfo />
        </div>
      </aside>

      {isMobileOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-30 bg-brand-grafite/30 backdrop-blur-sm md:hidden"
        />
      ) : null}
    </>
  );
};

export default Sidebar;
