
# اضافة تأثيرات حركية متقدمة لصفحة تفاصيل المنتج

## ملخص
اضافة Parallax Scrolling على صور المنتج وانيميشن Scroll-Reveal على جميع أقسام الصفحة لتجربة بصرية احترافية وسلسة.

---

## التحسينات

### 1. Parallax Effect على صور المنتج
- عند التمرير للاسفل، تتحرك الصورة ببطء اكثر من باقي الصفحة مما يعطي احساس بالعمق
- استخدام `useEffect` + `scroll` event listener مع `transform: translateY`
- التأثير يكون خفيف (عامل 0.3) لتجنب الدوخة

### 2. Scroll-Reveal Animations على كل قسم
- استخدام `useScrollAnimation` hook الموجود بالفعل في المشروع
- كل قسم (السعر، المقاسات، الالوان، الكمية، الضمانات، الوصف، التقييمات، المقترحات) يظهر بانيميشن `fade-in-up` عند الوصول اليه بالتمرير
- تأخير تدريجي (stagger) بين الاقسام لتأثير متتابع

### 3. انيميشن Scale على الشارات (Badges)
- شارات "جديد" و"خصم" و"نفذ المخزون" تظهر بتأثير `scale-in` مع bounce خفيف

### 4. انيميشن على اختيار المقاس واللون
- تأثير `spring` عند تحديد مقاس أو لون (scale bounce)

### 5. انيميشن Slide-Up على شريط الضمانات
- الايقونات الثلاثة تظهر بتأثير متتابع من الاسفل

### 6. Keyframes جديدة في Tailwind Config
- اضافة `slide-up`, `scale-bounce`, `parallax` keyframes

---

## التفاصيل التقنية

### الملفات المعدلة:

| الملف | التعديل |
|-------|---------|
| `tailwind.config.ts` | اضافة keyframes جديدة: `slide-up`, `scale-bounce`, `fade-in-up` |
| `src/pages/ProductDetails.tsx` | تغليف كل قسم بـ scroll-reveal animation مع stagger delays |
| `src/components/product-details/ProductImages.tsx` | اضافة parallax effect على حاوية الصور باستخدام scroll listener |
| `src/hooks/useScrollAnimation.tsx` | موجود بالفعل - سيتم استخدامه مباشرة |

### Keyframes الجديدة:
```text
slide-up:      0% -> translateY(20px), opacity:0  |  100% -> translateY(0), opacity:1
scale-bounce:  0% -> scale(0)  |  60% -> scale(1.1)  |  100% -> scale(1)
fade-in-up:    0% -> translateY(30px), opacity:0  |  100% -> translateY(0), opacity:1
```

### نهج Parallax:
- انشاء hook `useParallax` بسيط يستمع لـ `window.scroll` 
- يحسب `translateY` بناء على موقع العنصر من الشاشة
- يستخدم `requestAnimationFrame` للاداء
- يُطبق على حاوية صور المنتج فقط

### نهج Scroll Reveal:
- استخدام `useScrollAnimation` الموجود مع `IntersectionObserver`
- انشاء component مساعد `ScrollReveal` يغلف اي محتوى ويضيف الانيميشن تلقائياً
- يدعم تأخير (delay) لتأثير الظهور المتتابع

### ملاحظات الاداء:
- جميع الانيميشن تستخدم `transform` و `opacity` فقط (GPU-accelerated)
- Parallax يستخدم `requestAnimationFrame` + `will-change: transform`
- IntersectionObserver يفصل المراقبة بعد اول ظهور (لا اعادة حساب)
