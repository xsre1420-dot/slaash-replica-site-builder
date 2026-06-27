-- ============================================================
-- إنشاء رمز دخول من Supabase (طريقة سهلة)
-- Dashboard → SQL Editor → الصق وشغّل
-- ============================================================

-- ▶ الخطوة 1: اعرض العملاء وانسخ lead_id
SELECT
  id AS lead_id,
  full_name AS الاسم,
  whatsapp_number AS واتساب,
  selected_plan_name AS الباقة,
  status AS الحالة,
  created_at AS التاريخ
FROM public.leads
ORDER BY created_at DESC
LIMIT 20;

-- ▶ الخطوة 2: أنشئ الرمز (غيّر lead_id فقط)
SELECT public.sql_generate_access_code(
  'ضع-uuid-العميل-هنا'::UUID,
  'annual',       -- annual = 6 أشهر | yearly = سنة
  125000,         -- السعر المتفق عليه (اختياري)
  NULL,           -- اسم المتجر (NULL = اسم العميل)
  NULL            -- ملاحظة داخلية
);

-- النتيجة:
--   access_code        ← أرسل هذا للعميل
--   whatsapp_message   ← رسالة جاهزة للنسخ على واتساب
