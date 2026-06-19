import { format } from 'date-fns';
import { Product } from '@/types';
import { getProductLifecycleStatus, lifecycleStatusLabel } from '@/lib/productLifecycle';
import { isProductLowStock } from '@/lib/productUpdateUtils';

const escapeCsv = (value: string | number) => {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const exportProductsToCsv = (products: Product[], filename = 'products.csv') => {
  const headers = [
    'الاسم',
    'التصنيف',
    'السعر',
    'التكلفة',
    'المخزون',
    'الحالة',
    'مخزون منخفض',
    'المقاسات',
    'الوصف',
  ];

  const rows = products.map((p) => {
    const lifecycle = getProductLifecycleStatus(p);
    return [
      p.name,
      p.category ?? '',
      p.price,
      p.cost ?? '',
      p.stockQuantity ?? '',
      lifecycleStatusLabel[lifecycle],
      isProductLowStock(p) ? 'نعم' : 'لا',
      p.sizes?.join('|') ?? '',
      p.description ?? '',
    ];
  });

  const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const buildProductsExportFilename = () =>
  `products-${format(new Date(), 'yyyy-MM-dd')}.csv`;
