-- ============================================================
-- إعداد مسؤول المنصة (صاحب بداية)
-- Supabase Dashboard → SQL Editor
-- ============================================================

-- ▶ 1) تحقق: هل حسابك موجود في المصادقة؟
SELECT id AS user_id, email, email_confirmed_at, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 20;

-- ▶ 2) تحقق: هل أنت مسؤول؟
SELECT
  u.email,
  u.id AS user_id,
  (pa.user_id IS NOT NULL) AS is_platform_admin
FROM auth.users u
LEFT JOIN public.platform_admins pa ON pa.user_id = u.id
ORDER BY u.created_at DESC
LIMIT 20;

-- ▶ 3) أضف نفسك مسؤولاً (غيّر البريد — يجب أن يكون الحساب موجوداً في الخطوة 1)
INSERT INTO public.platform_admins (user_id, display_name)
SELECT id, 'مالك المنصة'
FROM auth.users
WHERE email = 'بريدك@example.com'
ON CONFLICT (user_id) DO NOTHING;

-- ▶ 4) أعد التحقق
SELECT u.email, pa.user_id IS NOT NULL AS is_admin
FROM auth.users u
LEFT JOIN public.platform_admins pa ON pa.user_id = u.id
WHERE u.email = 'بريدك@example.com';

-- ============================================================
-- إذا لم يظهر بريدك في الخطوة 1:
-- Authentication → Users → Add user → Create new user
--   ✓ Auto Confirm User
--   ضع البريد وكلمة مرور
-- ثم أعد الخطوة 3
--
-- الدخول: /admin/login (بوابة منفصلة عن دخول التجار)
-- ============================================================
