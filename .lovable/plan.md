
# توحيد ألوان جميع صفحات المنصة

## المشكلة
عدة صفحات تستخدم ألوان مُثبّتة (hardcoded) مثل `bg-black`, `bg-white`, `bg-gray-50`, `text-gray-900`, `text-black`, `#000000` بدلاً من متغيرات CSS الخاصة بالثيم (`bg-background`, `bg-card`, `text-foreground`, `bg-muted`, `text-muted-foreground`). هذا يسبب عدم توافق مع الوضع الداكن وعدم توحيد الهوية البصرية.

## الصفحات والملفات المتأثرة

### 1. صفحة تفاصيل الطلب (OrderDetails)
**`src/pages/OrderDetails.tsx`**
- `bg-gray-50` -> `bg-background`

**`src/components/order-details/OrderDetailsCard.tsx`**
- `bg-white` -> `bg-card`
- `bg-black text-white` (Header) -> `accent-gradient text-white` (تدرج أزرق بنفسجي بدل الأسود)
- `bg-gray-50` -> `bg-muted`
- `text-black` -> `text-foreground`

**`src/components/order-details/OrderDetailsPageHeader.tsx`**
- `bg-white` -> `bg-card`
- `hover:bg-gray-100` -> `hover:bg-muted`
- `text-gray-800` -> `text-foreground`

**`src/components/order-details/OrderNotFound.tsx`**
- `bg-gray-50` -> `bg-background`
- `text-gray-800` -> `text-foreground`
- gradient أزرق مُثبّت -> `bg-primary hover:bg-primary/90`

**`src/components/order-details/OrderItems.tsx`**
- `text-gray-500`, `text-gray-600` -> `text-muted-foreground`
- `bg-gray-100` -> `bg-muted`
- `border-gray-200` -> `border-border`

**`src/components/order-details/OrderTotal.tsx`**
- `from-blue-50 to-blue-100` -> `bg-primary/5 border border-primary/20`
- `text-blue-800`, `text-blue-900`, `text-blue-700` -> `text-primary`, `text-foreground`
- `border-blue-200` -> `border-primary/20`

**`src/components/order-details/OrderHeader.tsx`**
- `text-blue-100` -> `text-primary-foreground/80`

### 2. صفحة معاينة المتجر (PreviewStore)
**`src/pages/PreviewStore.tsx`**
- `bg-white` -> `bg-background`
- `border-gray-100` -> `border-border`
- `text-gray-900` -> `text-foreground`
- `text-gray-700` -> `text-muted-foreground`
- `text-gray-500` -> `text-muted-foreground`
- `text-gray-400` -> `text-muted-foreground`
- `bg-black text-white` (فلاتر الفئات المحددة) -> `bg-primary text-primary-foreground`
- `bg-gray-100 text-gray-500` (فلاتر غير محددة) -> `bg-muted text-muted-foreground`
- `bg-gray-100` (صور) -> `bg-muted`
- `bg-black` (شريط السلة) -> `accent-gradient`
- `text-black` (عداد السلة) -> `text-primary`
- `from-white via-white` (تدرج خلفية السلة) -> `from-background via-background`

### 3. CSS العام
**`src/index.css`**
- ازالة `color: #000000` من body و input overrides واستبدالها بمتغيرات الثيم
- ازالة `!important` من قواعد الألوان المثبتة

---

## التفاصيل التقنية

### الملفات المعدلة (12 ملف):

| الملف | عدد التغييرات |
|-------|-------------|
| `src/pages/OrderDetails.tsx` | 1 |
| `src/components/order-details/OrderDetailsCard.tsx` | 6 |
| `src/components/order-details/OrderDetailsPageHeader.tsx` | 3 |
| `src/components/order-details/OrderNotFound.tsx` | 3 |
| `src/components/order-details/OrderItems.tsx` | 5 |
| `src/components/order-details/OrderTotal.tsx` | 7 |
| `src/components/order-details/OrderHeader.tsx` | 2 |
| `src/pages/PreviewStore.tsx` | ~15 |
| `src/index.css` | 3 |

### القاعدة العامة للتحويل:
```text
bg-white / bg-gray-50    ->  bg-background / bg-card / bg-muted
text-black / text-gray-900  ->  text-foreground
text-gray-500/600/700     ->  text-muted-foreground
bg-black                  ->  bg-primary / accent-gradient
border-gray-*             ->  border-border
bg-gray-100               ->  bg-muted
```

### ملاحظات:
- صفحات Login, Signup, Builder, Store, Orders, Statistics, Settings, Marketing, AddProduct, Checkout, ProductDetails تستخدم بالفعل متغيرات الثيم بشكل صحيح ولا تحتاج تعديل
- التركيز على PreviewStore و OrderDetails وملفاتهما الفرعية لانها الأكثر استخداماً للألوان المثبتة
- ازالة `#000000` من CSS العام يضمن توافق الألوان مع الوضع الداكن
