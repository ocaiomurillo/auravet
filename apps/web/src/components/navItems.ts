import type { ComponentType, SVGProps } from 'react';
import {
  BanknotesIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  HeartIcon,
  HomeIcon,
  KeyIcon,
  PlusCircleIcon,
  ShoppingBagIcon,
  UserCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

export type NavItem = {
  to: string;
  label: string;
  module?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const navItems: NavItem[] = [
  { to: '/', label: 'Início', icon: HomeIcon },
  { to: '/owners', label: 'Tutores', module: 'owners:read', icon: UserGroupIcon },
  { to: '/animals', label: 'Animais', module: 'animals:read', icon: HeartIcon },
  { to: '/appointments', label: 'Agendamentos', module: 'services:read', icon: CalendarDaysIcon },
  { to: '/calendar', label: 'Agenda', module: 'services:read', icon: CalendarIcon },
  { to: '/services', label: 'Catálogo de serviços', module: 'services:read', icon: ClipboardDocumentCheckIcon },
  { to: '/products', label: 'Produtos', module: 'products:read', icon: ShoppingBagIcon },
  { to: '/cashier', label: 'Caixa', module: 'cashier:access', icon: BanknotesIcon },
  { to: '/new-service', label: 'Registrar atendimento', module: 'services:write', icon: PlusCircleIcon },
  { to: '/users', label: 'Usuários', module: 'users:manage', icon: UserCircleIcon },
  { to: '/roles', label: 'Funções', module: 'users:manage', icon: KeyIcon },
];
