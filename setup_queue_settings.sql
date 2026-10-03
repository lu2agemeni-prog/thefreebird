-- ============================================================================
-- setup_queue_settings.sql
-- تشغيل هذا الكود في Supabase SQL Editor لتمكين حفظ واسترجاع إعدادات شاشة النداء
-- ============================================================================

-- 1. التأكد من وجود جدول settings
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. تفعيل نظام حماية الصفوف (Row Level Security - RLS)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 3. السماح لأي جهاز وشاشة بقراءة الإعدادات الافتراضية
DROP POLICY IF EXISTS "Allow public read settings" ON public.settings;
CREATE POLICY "Allow public read settings" 
ON public.settings 
FOR SELECT 
USING (true);

-- 4. السماح بحفظ وتعديل الإعدادات من لوحة التحكم وشاشة النداء
DROP POLICY IF EXISTS "Allow all upsert settings" ON public.settings;
CREATE POLICY "Allow all upsert settings" 
ON public.settings 
FOR ALL 
USING (true) 
WITH CHECK (true);
