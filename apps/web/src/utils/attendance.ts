import type { Attendance } from '../types/api';

export const getAttendanceTotal = (attendance: Pick<Attendance, 'preco' | 'items' | 'catalogItems'>) => {
  const basePrice = attendance.preco ?? 0;

  const itemsTotal = attendance.items?.reduce((total, item) => total + (item.valorTotal ?? 0), 0) ?? 0;
  const catalogItemsTotal =
    attendance.catalogItems?.reduce((total, item) => total + (item.valorTotal ?? 0), 0) ?? 0;

  return basePrice + itemsTotal + catalogItemsTotal;
};
