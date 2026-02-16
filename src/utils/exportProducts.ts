
import { Product } from "@/types";

export const exportProductsToCSV = (products: Product[]) => {
  const headers = ["الاسم", "الوصف", "الفئة", "السعر", "التكلفة", "الكمية", "الألوان", "القياسات", "SKU"];
  
  const rows = products.map(p => [
    p.name,
    p.description?.replace(/,/g, '،'),
    p.category,
    p.price,
    p.cost || '',
    p.stockQuantity ?? '',
    p.colors?.map(c => c.name || c.value).join(' | ') || '',
    p.sizes?.join(' | ') || '',
    p.sku || '',
  ]);

  const BOM = '\uFEFF';
  const csv = BOM + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `products_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
