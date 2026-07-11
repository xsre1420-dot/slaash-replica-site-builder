import { format } from 'date-fns';
import { Order } from '@/types';
import { escapeHtml } from '@/lib/security/sanitize';
import {
  formatOrderNumber,
  getSimplifiedOrderDisplayStatus,
} from '@/utils/orderWorkflowUtils';
import { getPaymentMethodLabel } from '@/utils/paymentUtils';

export const printOrderInvoice = (order: Order) => {
  const e = escapeHtml;
  const { label: statusLabel } = getSimplifiedOrderDisplayStatus(order);
  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${e(item.product.name)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:left">${(item.product.price * item.quantity).toLocaleString()} د.ع</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8"/>
  <title>فاتورة ${e(formatOrderNumber(order.id))}</title>
  <style>
    body { font-family: Tajawal, Arial, sans-serif; padding: 24px; color: #111; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
    .section { margin-bottom: 18px; }
    .label { font-size: 11px; color: #888; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { text-align: right; font-size: 12px; color: #666; padding: 8px; border-bottom: 2px solid #ddd; }
    .total { font-size: 18px; font-weight: bold; text-align: left; margin-top: 16px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>فاتورة طلب ${e(formatOrderNumber(order.id))}</h1>
  <p class="meta">${format(new Date(order.date), 'yyyy-MM-dd HH:mm')} · ${e(getPaymentMethodLabel(order.paymentMethod))} · <strong>${e(statusLabel)}</strong></p>

  <div class="section">
    <div class="label">العميل</div>
    <strong>${e(order.customerInfo.name)}</strong><br/>
    <span dir="ltr">${e(order.customerInfo.phone)}</span><br/>
    ${order.customerInfo.governorate ? `${e(order.customerInfo.governorate)} — ` : ''}${e(order.customerInfo.address)}
  </div>

  ${order.customerInfo.notes ? `<div class="section"><div class="label">ملاحظات</div>${e(order.customerInfo.notes)}</div>` : ''}

  <div class="section">
    <div class="label">المنتجات</div>
    <table>
      <thead><tr><th>المنتج</th><th style="text-align:center">الكمية</th><th style="text-align:left">المبلغ</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  </div>

  ${order.discountAmount ? `<p>خصم: -${order.discountAmount.toLocaleString()} د.ع${order.couponCode ? ` (${e(order.couponCode)})` : ''}</p>` : ''}
  ${order.deliveryFee ? `<p>التوصيل: ${order.deliveryFee.toLocaleString()} د.ع</p>` : ''}
  <p class="total">الإجمالي: ${order.total.toLocaleString()} د.ع</p>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
};

export type ShippingLabelOptions = {
  storeName?: string;
  trackingNumber?: string;
  carrier?: string;
};

export const printShippingLabel = (
  order: Order,
  options: ShippingLabelOptions = {}
) => {
  const e = escapeHtml;
  const { storeName = 'متجر', trackingNumber, carrier } = options;
  const itemsSummary = order.items
    .map((i) => `${e(i.product.name)} ×${i.quantity}`)
    .join(' · ');

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8"/>
  <title>ملصق شحن ${e(formatOrderNumber(order.id))}</title>
  <style>
    @page { size: 100mm 150mm; margin: 8mm; }
    body { font-family: Tajawal, Arial, sans-serif; font-size: 12px; line-height: 1.4; margin: 0; }
    .label { border: 2px dashed #333; padding: 12px; min-height: 120mm; box-sizing: border-box; }
    h1 { font-size: 14px; margin: 0 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 6px; }
    .big { font-size: 16px; font-weight: bold; margin: 6px 0; }
    .section { margin: 10px 0; }
    .muted { color: #666; font-size: 10px; }
    .barcode { font-family: monospace; font-size: 11px; letter-spacing: 2px; margin-top: 8px; }
    @media print { .label { border: 1px solid #000; } }
  </style>
</head>
<body>
  <div class="label">
    <p class="muted">${e(storeName)} · ${e(formatOrderNumber(order.id))}</p>
    <h1>ملصق الشحن</h1>
    <div class="section">
      <p class="muted">المستلم</p>
      <p class="big">${e(order.customerInfo.name)}</p>
      <p dir="ltr">${e(order.customerInfo.phone)}</p>
    </div>
    <div class="section">
      <p class="muted">العنوان</p>
      <p><strong>${e(order.customerInfo.governorate || '')}</strong></p>
      <p>${e(order.customerInfo.address)}</p>
    </div>
    ${order.customerInfo.notes ? `<div class="section"><p class="muted">ملاحظات</p><p>${e(order.customerInfo.notes)}</p></div>` : ''}
    <div class="section">
      <p class="muted">المحتويات</p>
      <p>${itemsSummary}</p>
      <p><strong>${order.total.toLocaleString()} د.ع</strong> · ${e(getPaymentMethodLabel(order.paymentMethod))}</p>
    </div>
    ${carrier ? `<p class="muted">الناقل: ${e(carrier)}</p>` : ''}
    ${trackingNumber ? `<p class="barcode">تتبع: ${e(trackingNumber)}</p>` : `<p class="barcode">${e(order.id.slice(0, 13).toUpperCase())}</p>`}
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=420,height=640');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
};
