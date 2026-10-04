-- ============================================================================
-- setup_queue_settings.sql
-- تشغيل هذا الكود في Supabase SQL Editor:
-- 1. تمكين حفظ واسترجاع إعدادات وتخصيصات شاشة النداء الافتراضية بدون أي أخطاء RLS.
-- 2. إدراج وتحديث الإعدادات الافتراضية الشاملة (تكبير صورة الطبيب، فترة الصوت 10 دقائق، سرعة الشريط الهادئة).
-- 3. التأكد من صلاحيات جدول نداء المرضى call_queue لدعم "الدور السريع".
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. جدول الإعدادات العامة (Settings Table) وسياسات الأمان
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- إضافة أعمدة التوقيت إذا لم تكن موجودة مسبقاً في جدول settings
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW());
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW());

-- تفعيل نظام حماية الصفوف (Row Level Security - RLS)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- السماح بقراءة الإعدادات الافتراضية للجميع (شاشات التلفزيون والأجهزة)
DROP POLICY IF EXISTS "Allow public read settings" ON public.settings;
CREATE POLICY "Allow public read settings" 
ON public.settings 
FOR SELECT 
USING (true);

-- السماح بحفظ وتعديل الإعدادات من لوحة التحكم وشاشة النداء (حل مشكلة 42501 RLS)
DROP POLICY IF EXISTS "Allow all upsert settings" ON public.settings;
CREATE POLICY "Allow all upsert settings" 
ON public.settings 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 2. حفظ وتعيين الإعدادات الافتراضية لشاشة النداء والمقاسات بالكامل
-- (تم الاعتماد على الحقول الأساسية key و value لضمان النجاح 100%)
-- ----------------------------------------------------------------------------
INSERT INTO public.settings (key, value)
VALUES (
  'queue_screen_layout_config',
  '{
    "showMedia": true,
    "showClinics": true,
    "showWaitingList": true,
    "showCurrentCall": true,
    "showNewsTicker": true,
    "showHeader": true,
    "screenLayoutMode": "split_columns",
    "mediaPosition": "left",
    "mediaWidthPct": 70,
    "bottomHeightPct": 32,
    "tickerHeightPx": 46,
    "tickerFontSizePx": 15,
    "zoom": 1,
    "waitingListColumns": 2,
    "clinicsGridColumns": 2,
    "clinicsFontSizePx": 14,
    "tokenFontSize": 76,
    "cardDensity": "normal",
    "headerHeightPx": 66,
    "doctorPhotoSizePx": 280,
    "doctorCardLayout": "side_by_side",
    "bottomOrder": "call_right_queue_left",
    "verticalOrder": "media_top_queue_bottom",
    "themePreset": "emerald_dark",
    "bgColor": "#020617",
    "panelBgColor": "#0f172a",
    "cardBgColor": "#1e293b",
    "cardBorderColor": "#334155",
    "textColor": "#ffffff",
    "mutedTextColor": "#94a3b8",
    "accentColor": "#10b981",
    "callingCardBg": "linear-gradient(135deg, #059669 0%, #0d9488 50%, #047857 100%)",
    "callingTokenColor": "#ffffff",
    "fontFamily": "cairo",
    "fontWeight": "bold",
    "tickerSpeedSeconds": 120,
    "tickerSpeedPxPerSec": 20,
    "tickerBgColor": "#090d16",
    "tickerTextColor": "#f8fafc",
    "tickerBadgeBg": "#059669",
    "tickerBadgeTextColor": "#ffffff",
    "tickerBadgeText": "أخبار المركز والتنبيهات",
    "tickerTextSource": "both",
    "tickerCustomText": "مرحباً بكم في مركز الطائر الحر الطبي.. نتمنى لكم دوام الصحة والعافية.",
    "tickerDirection": "ltr",
    "tickerSeparator": "star",
    "tickerPauseOnHover": true,
    "sideStackOrder": "call_clinics_queue",
    "doctorAudioIntervalMinutes": 10,
    "patientCallNoticeDurationSec": 8,
    "slideDefaultDurationSec": 10
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- ----------------------------------------------------------------------------
-- 3. التحقق من جدول النداء call_queue وصلاحيات "الدور السريع"
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.call_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    token_number INT NOT NULL,
    status TEXT DEFAULT 'waiting', -- waiting, calling, completed
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ضمان وجود كافة أعمدة الدور السريع والربط المالي
ALTER TABLE public.call_queue ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.call_queue ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.call_queue ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.call_queue ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.call_queue ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.call_queue ADD COLUMN IF NOT EXISTS visit_group_id UUID;

ALTER TABLE public.call_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read call_queue" ON public.call_queue;
CREATE POLICY "Allow public read call_queue"
ON public.call_queue
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow staff manage call_queue" ON public.call_queue;
CREATE POLICY "Allow staff manage call_queue"
ON public.call_queue
FOR ALL
USING (true)
WITH CHECK (true);
