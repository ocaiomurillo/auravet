import type { ComponentType, SVGProps } from 'react';
import {
  BanknotesIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  ReceiptPercentIcon,
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
  { to: '/animals', label: 'Pets', module: 'animals:read', icon: HeartIcon },
  { to: '/appointments', label: 'Agendamentos', module: 'services:read', icon: CalendarDaysIcon },
  { to: '/calendar', label: 'Agenda', module: 'services:read', icon: CalendarIcon },
  { to: '/services', label: 'Serviços', module: 'services:read', icon: ClipboardDocumentCheckIcon },
  { to: '/products', label: 'Produtos', module: 'products:read', icon: ShoppingBagIcon },
  { to: '/payment-conditions', label: 'Condições', module: 'cashier:access', icon: ReceiptPercentIcon },
  { to: '/accounting', label: 'Financeiro', module: 'cashier:access', icon: ReceiptPercentIcon },
  { to: '/cashier', label: 'Caixa', module: 'cashier:access', icon: BanknotesIcon },
  { to: '/new-service', label: 'Atendimento', module: 'services:write', icon: PlusCircleIcon },
  { to: '/users', label: 'Usuários', module: 'users:manage', icon: UserCircleIcon },
  { to: '/roles', label: 'Funções', module: 'users:manage', icon: KeyIcon },
];
