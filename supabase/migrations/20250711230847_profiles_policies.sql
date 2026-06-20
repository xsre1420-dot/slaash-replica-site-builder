-- إضافة جدول إعدادات المتجر لكل مستخدم
CREATE TABLE public.store_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  store_name TEXT,
  store_logo TEXT,
  store_governorate TEXT,
  menu_background_color TEXT DEFAULT '#ffffff',
  menu_text_color TEXT DEFAULT '#333333',
  menu_accent_color TEXT DEFAULT '#6366f1',
  banner_images TEXT[] DEFAULT '{}',
  primary_banner_index INTEGER DEFAULT 0,
  delivery_prices JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(owner_id)
);

-- تمكين Row Level Security
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- إنشاء سياسات للوصول
CREATE POLICY "Users can view their own store settings" 
ON public.store_settings 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own store settings" 
ON public.store_settings 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own store settings" 
ON public.store_settings 
FOR UPDATE 
USING (auth.uid() = owner_id);

-- إنشاء دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION public.update_store_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء trigger لتحديث الوقت
CREATE TRIGGER update_store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_store_settings_updated_at();