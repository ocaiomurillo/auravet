import type { ComponentType, SVGProps } from 'react';
import {
  BanknotesIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  ReceiptPercentIcon,
  HeartIcon,
  HomeIcon,
  KeyIcon,
  CurrencyDollarIcon,
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
  { to: '/animals', label: 'Pets', module: 'animals:read', icon: HeartIcon },
  { to: '/appointments', label: 'Agendamentos', module: 'appointments:manage', icon: CalendarDaysIcon },
  { to: '/calendar', label: 'Agenda', module: 'calendar:manage', icon: CalendarIcon },
  { to: '/attendances', label: 'Atendimentos', module: 'attendances:manage', icon: ClipboardDocumentListIcon },
  { to: '/services', label: 'Serviços', module: 'services:read', icon: ClipboardDocumentCheckIcon },
  { to: '/products', label: 'Produtos', module: 'products:read', icon: ShoppingBagIcon },
  {
    to: '/payment-conditions',
    label: 'Condições',
    module: 'payment-conditions:manage',
    icon: ReceiptPercentIcon,
  },
  { to: '/accounting', label: 'Financeiro', module: 'accounting:manage', icon: CurrencyDollarIcon },
  { to: '/cashier', label: 'Caixa', module: 'cashier:manage', icon: BanknotesIcon },
  { to: '/users', label: 'Usuários', module: 'users:manage', icon: UserCircleIcon },
  { to: '/roles', label: 'Funções', module: 'users:manage', icon: KeyIcon },
];
