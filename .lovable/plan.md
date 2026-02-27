
# توحيد الألوان مع هوية المنصة (الأزرق/البنفسجي)

## المشكلة
حالياً يتم استخدام اللون الأسود (`bg-foreground`) في العديد من الأزرار والعناصر التفاعلية بدلاً من اللون الأساسي للمنصة (الأزرق البنفسجي `primary`). هذا يجعل التصميم غير موحد مع بقية المنصة.

## التغييرات المطلوبة

### 1. زر "إضافة إلى السلة" (`AddToCartButton.tsx`)
- تغيير `bg-foreground` إلى `bg-primary` مع تدرج gradient
- تحديث لون hover

### 2. شريط السلة السفلي (`CartButton.tsx`)
- تغيير خلفية الشريط من `bg-foreground` إلى gradient أزرق بنفسجي
- توحيد الألوان الداخلية

### 3. اختيار المقاس في صفحة المنتج (`ProductDetails.tsx`)
- تغيير الحالة المحددة من `bg-foreground` إلى `bg-primary`
- تغيير حدود اللون المحدد من `border-foreground` إلى `border-primary`

### 4. أزرار الكمية في السلة (`CartItemCard.tsx`)
- تغيير أزرار +/- من `bg-foreground` إلى `bg-primary`

### 5. عداد الكمية (`ProductQuantity.tsx`)
- توحيد ألوان الأزرار مع اللون الأساسي

---

## التفاصيل التقنية

### الملفات المعدلة:

| الملف | التغيير |
|-------|---------|
| `src/components/product-details/AddToCartButton.tsx` | `bg-foreground` → `accent-gradient` (primary to secondary) |
| `src/components/product-details/CartButton.tsx` | `bg-foreground` → `accent-gradient` |
| `src/pages/ProductDetails.tsx` | اختيار المقاس/اللون: `bg-foreground`/`border-foreground` → `bg-primary`/`border-primary` |
| `src/components/checkout/CartItemCard.tsx` | أزرار الكمية: `bg-foreground` → `bg-primary` |
| `src/components/product-details/ProductQuantity.tsx` | أزرار +/-: hover/active colors → primary |

### النتيجة
جميع العناصر التفاعلية ستستخدم تدرجات اللون الأزرق البنفسجي (primary/secondary) بدلاً من الأسود، مما يوحد الهوية البصرية مع بقية المنصة.
