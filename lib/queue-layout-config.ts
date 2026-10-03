// ============================================================================
// lib/queue-layout-config.ts
// إعدادات وتخصيصات شاشة النداء الآلي بالكامل:
// - عرض وإخفاء الأقسام (الميديا، العيادات، قائمة الانتظار، شريط الأخبار بالأسفل).
// - تحديد مقاسات وأبعاد كل قسم ونسب العرض والارتفاع والزووم.
// - التحكم بأماكن وترتيب الأقسام (يمين/يسار/أعلى/أسفل).
// - التحكم بالألوان، القوالب، درجات الخلفية، الكروت، النصوص والتمييز.
// - التحكم بالخطوط (Cairo, Tajawal, Almarai, System).
// - التحكم في شريط الأخبار التفاعلي بالأسفل (السرعة، النص المخصص، جلب الأخبار).
// - الحفظ كإعدادات افتراضية في قاعدة البيانات (جدول settings) مع كاش محلي.
// ============================================================================

import { supabase } from '@/lib/supabase';

export type SectionPosition = 'right' | 'left';
export type BottomOrder = 'call_right_queue_left' | 'call_left_queue_right' | 'call_center';
export type VerticalOrder = 'media_top_queue_bottom' | 'queue_top_media_bottom';
export type FontFamilyOption = 'cairo' | 'tajawal' | 'almarai' | 'system';
export type CardDensity = 'compact' | 'normal' | 'spacious';
export type ThemePresetKey = 'emerald_dark' | 'navy_blue' | 'midnight_dark' | 'clean_light' | 'purple_luxury' | 'custom';

export interface QueueLayoutConfig {
  // 1. خيارات عرض وإخفاء الأقسام
  showMedia: boolean;            // الميديا (إعلانات الأطباء / وسائط المركز)
  showClinics: boolean;          // شبكة العيادات والأطباء المتواجدين
  showWaitingList: boolean;      // قائمة الانتظار القادمة
  showCurrentCall: boolean;      // كارت النداء الحالي المباشر
  showNewsTicker: boolean;       // شريط الأخبار بالأسفل (جديد)
  showHeader: boolean;           // الهيدر وشريط الترويسة العلوي (الشعار والساعة)

  // 2. المقاسات والأبعاد
  mediaWidthPct: number;         // نسبة عرض قسم الميديا في القسم الرئيسي (30 - 80%)
  bottomHeightPct: number;       // نسبة ارتفاع القسم السفلي من الشاشة (15 - 50%)
  tickerHeightPx: number;        // ارتفاع شريط الأخبار بالأسفل بالبكسل (36 - 65px)
  zoom: number;                  // زووم عام للنصوص والعناصر (0.8 - 1.4)
  waitingListColumns: 1 | 2 | 3; // عدد أعمدة قائمة الانتظار
  clinicsGridColumns: 1 | 2 | 3; // عدد أعمدة كروت الأطباء المتواجدين
  tokenFontSize: number;         // حجم خط رقم النداء بالبكسل (48 - 110px)
  cardDensity: CardDensity;      // كثافة وحجم الكروت

  // 3. الأماكن والترتيب في الشاشة
  mediaPosition: SectionPosition; // مكان الميديا في القسم الرئيسي (يمين أو يسار)
  bottomOrder: BottomOrder;       // ترتيب كارت النداء وقائمة الانتظار بالأسفل
  verticalOrder: VerticalOrder;   // ترتيب الأقسام عمودياً (الميديا بالأعلى أم النداء بالأعلى)

  // 4. الألوان والقوالب
  themePreset: ThemePresetKey;
  bgColor: string;               // خلفية الشاشة الرئيسية
  panelBgColor: string;          // خلفية اللوحات والهيدر
  cardBgColor: string;           // خلفية كروت الأطباء وقائمة الانتظار
  cardBorderColor: string;       // لون حدود الكروت
  textColor: string;             // لون النص الأساسي
  mutedTextColor: string;        // لون النص الثانوي
  accentColor: string;           // لون التمييز واللمسات الحية
  callingCardBg: string;         // خلفية كارت النداء المباشر
  callingTokenColor: string;     // لون رقم النداء المباشر

  // 5. الخطوط
  fontFamily: FontFamilyOption;
  fontWeight: 'bold' | 'black';

  // 6. شريط الأخبار بالأسفل (جديد)
  tickerSpeedSeconds: number;    // سرعة دوران شريط الأخبار بالثواني (15 - 60s)
  tickerBgColor: string;         // خلفية شريط الأخبار
  tickerTextColor: string;       // لون نص شريط الأخبار
  tickerBadgeBg: string;         // خلفية شارة "أخبار المركز"
  tickerBadgeTextColor: string;  // لون نص شارة "أخبار المركز"
  tickerTextSource: 'medical_news' | 'custom' | 'both'; // مصدر الأخبار
  tickerCustomText: string;      // نص إعلاني إرشادي مخصص
}

export const SETTINGS_KEY = 'queue_screen_layout_config';
export const LOCAL_STORAGE_KEY = 'queue_screen_layout_config_v2';

export const THEME_PRESETS: Record<ThemePresetKey, {
  name: string;
  colors: Partial<QueueLayoutConfig>;
}> = {
  emerald_dark: {
    name: 'زمردي داكن ملكي (الافتراضي)',
    colors: {
      bgColor: '#020617', // slate-950
      panelBgColor: '#0f172a', // slate-900
      cardBgColor: '#1e293b', // slate-800
      cardBorderColor: '#334155', // slate-700
      textColor: '#ffffff',
      mutedTextColor: '#94a3b8', // slate-400
      accentColor: '#10b981', // emerald-500
      callingCardBg: 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #047857 100%)',
      callingTokenColor: '#ffffff',
      tickerBgColor: '#090d16',
      tickerTextColor: '#f8fafc',
      tickerBadgeBg: '#059669',
      tickerBadgeTextColor: '#ffffff',
    },
  },
  navy_blue: {
    name: 'أزرق كحلي طبي فاخر',
    colors: {
      bgColor: '#030b1c',
      panelBgColor: '#0a1936',
      cardBgColor: '#10274f',
      cardBorderColor: '#1d3c73',
      textColor: '#ffffff',
      mutedTextColor: '#93c5fd',
      accentColor: '#38bdf8',
      callingCardBg: 'linear-gradient(135deg, #1d4ed8 0%, #0284c7 100%)',
      callingTokenColor: '#fef08a',
      tickerBgColor: '#040d21',
      tickerTextColor: '#e0f2fe',
      tickerBadgeBg: '#0284c7',
      tickerBadgeTextColor: '#ffffff',
    },
  },
  midnight_dark: {
    name: 'فحمي ناصع التباين',
    colors: {
      bgColor: '#000000',
      panelBgColor: '#111111',
      cardBgColor: '#1c1c1c',
      cardBorderColor: '#2d2d2d',
      textColor: '#ffffff',
      mutedTextColor: '#a1a1aa',
      accentColor: '#eab308',
      callingCardBg: 'linear-gradient(135deg, #ca8a04 0%, #a16207 100%)',
      callingTokenColor: '#000000',
      tickerBgColor: '#0d0d0d',
      tickerTextColor: '#fef08a',
      tickerBadgeBg: '#eab308',
      tickerBadgeTextColor: '#000000',
    },
  },
  clean_light: {
    name: 'فاتح ناصع طبي',
    colors: {
      bgColor: '#f1f5f9',
      panelBgColor: '#ffffff',
      cardBgColor: '#ffffff',
      cardBorderColor: '#e2e8f0',
      textColor: '#0f172a',
      mutedTextColor: '#64748b',
      accentColor: '#059669',
      callingCardBg: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
      callingTokenColor: '#ffffff',
      tickerBgColor: '#ffffff',
      tickerTextColor: '#0f172a',
      tickerBadgeBg: '#059669',
      tickerBadgeTextColor: '#ffffff',
    },
  },
  purple_luxury: {
    name: 'أرجواني ملكي حديث',
    colors: {
      bgColor: '#0d071a',
      panelBgColor: '#170c2e',
      cardBgColor: '#241445',
      cardBorderColor: '#3e2373',
      textColor: '#ffffff',
      mutedTextColor: '#c084fc',
      accentColor: '#a855f7',
      callingCardBg: 'linear-gradient(135deg, #7e22ce 0%, #9333ea 100%)',
      callingTokenColor: '#fef08a',
      tickerBgColor: '#0d061c',
      tickerTextColor: '#f3e8ff',
      tickerBadgeBg: '#9333ea',
      tickerBadgeTextColor: '#ffffff',
    },
  },
  custom: {
    name: 'تخصيص يدوي حر',
    colors: {},
  },
};

export const DEFAULT_QUEUE_LAYOUT_CONFIG: QueueLayoutConfig = {
  showMedia: true,
  showClinics: true,
  showWaitingList: true,
  showCurrentCall: true,
  showNewsTicker: true,
  showHeader: true,

  mediaWidthPct: 56,
  bottomHeightPct: 32,
  tickerHeightPx: 46,
  zoom: 1,
  waitingListColumns: 2,
  clinicsGridColumns: 2,
  tokenFontSize: 76,
  cardDensity: 'normal',

  mediaPosition: 'right', // الميديا على اليمين وشبكة الأطباء على اليسار
  bottomOrder: 'call_right_queue_left', // كارت النداء على اليمين وقائمة الانتظار على اليسار
  verticalOrder: 'media_top_queue_bottom',

  themePreset: 'emerald_dark',
  bgColor: '#020617',
  panelBgColor: '#0f172a',
  cardBgColor: '#1e293b',
  cardBorderColor: '#334155',
  textColor: '#ffffff',
  mutedTextColor: '#94a3b8',
  accentColor: '#10b981',
  callingCardBg: 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #047857 100%)',
  callingTokenColor: '#ffffff',

  fontFamily: 'cairo',
  fontWeight: 'bold',

  tickerSpeedSeconds: 28,
  tickerBgColor: '#090d16',
  tickerTextColor: '#f8fafc',
  tickerBadgeBg: '#059669',
  tickerBadgeTextColor: '#ffffff',
  tickerTextSource: 'both',
  tickerCustomText: 'مرحباً بكم في مركز الطائر الحر الطبي.. نتمنى لكم دوام الصحة والعافية.',
};

/**
 * دمج الإعدادات المحفوظة مع الإعدادات الافتراضية لضمان عدم وجود حقول فارغة
 */
export function sanitizeLayoutConfig(raw: any): QueueLayoutConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_QUEUE_LAYOUT_CONFIG };
  }

  return {
    showMedia: raw.showMedia !== undefined ? Boolean(raw.showMedia) : DEFAULT_QUEUE_LAYOUT_CONFIG.showMedia,
    showClinics: raw.showClinics !== undefined ? Boolean(raw.showClinics) : DEFAULT_QUEUE_LAYOUT_CONFIG.showClinics,
    showWaitingList: raw.showWaitingList !== undefined ? Boolean(raw.showWaitingList) : DEFAULT_QUEUE_LAYOUT_CONFIG.showWaitingList,
    showCurrentCall: raw.showCurrentCall !== undefined ? Boolean(raw.showCurrentCall) : DEFAULT_QUEUE_LAYOUT_CONFIG.showCurrentCall,
    showNewsTicker: raw.showNewsTicker !== undefined ? Boolean(raw.showNewsTicker) : DEFAULT_QUEUE_LAYOUT_CONFIG.showNewsTicker,
    showHeader: raw.showHeader !== undefined ? Boolean(raw.showHeader) : DEFAULT_QUEUE_LAYOUT_CONFIG.showHeader,

    mediaWidthPct: Math.min(80, Math.max(20, Number(raw.mediaWidthPct) || DEFAULT_QUEUE_LAYOUT_CONFIG.mediaWidthPct)),
    bottomHeightPct: Math.min(55, Math.max(15, Number(raw.bottomHeightPct) || DEFAULT_QUEUE_LAYOUT_CONFIG.bottomHeightPct)),
    tickerHeightPx: Math.min(75, Math.max(34, Number(raw.tickerHeightPx) || DEFAULT_QUEUE_LAYOUT_CONFIG.tickerHeightPx)),
    zoom: Math.min(1.5, Math.max(0.7, Number(raw.zoom) || DEFAULT_QUEUE_LAYOUT_CONFIG.zoom)),
    waitingListColumns: [1, 2, 3].includes(raw.waitingListColumns) ? raw.waitingListColumns : DEFAULT_QUEUE_LAYOUT_CONFIG.waitingListColumns,
    clinicsGridColumns: [1, 2, 3].includes(raw.clinicsGridColumns) ? raw.clinicsGridColumns : DEFAULT_QUEUE_LAYOUT_CONFIG.clinicsGridColumns,
    tokenFontSize: Math.min(120, Math.max(40, Number(raw.tokenFontSize) || DEFAULT_QUEUE_LAYOUT_CONFIG.tokenFontSize)),
    cardDensity: ['compact', 'normal', 'spacious'].includes(raw.cardDensity) ? raw.cardDensity : DEFAULT_QUEUE_LAYOUT_CONFIG.cardDensity,

    mediaPosition: raw.mediaPosition === 'left' ? 'left' : 'right',
    bottomOrder: ['call_right_queue_left', 'call_left_queue_right', 'call_center'].includes(raw.bottomOrder) ? raw.bottomOrder : DEFAULT_QUEUE_LAYOUT_CONFIG.bottomOrder,
    verticalOrder: raw.verticalOrder === 'queue_top_media_bottom' ? 'queue_top_media_bottom' : 'media_top_queue_bottom',

    themePreset: raw.themePreset in THEME_PRESETS ? raw.themePreset : DEFAULT_QUEUE_LAYOUT_CONFIG.themePreset,
    bgColor: raw.bgColor || DEFAULT_QUEUE_LAYOUT_CONFIG.bgColor,
    panelBgColor: raw.panelBgColor || DEFAULT_QUEUE_LAYOUT_CONFIG.panelBgColor,
    cardBgColor: raw.cardBgColor || DEFAULT_QUEUE_LAYOUT_CONFIG.cardBgColor,
    cardBorderColor: raw.cardBorderColor || DEFAULT_QUEUE_LAYOUT_CONFIG.cardBorderColor,
    textColor: raw.textColor || DEFAULT_QUEUE_LAYOUT_CONFIG.textColor,
    mutedTextColor: raw.mutedTextColor || DEFAULT_QUEUE_LAYOUT_CONFIG.mutedTextColor,
    accentColor: raw.accentColor || DEFAULT_QUEUE_LAYOUT_CONFIG.accentColor,
    callingCardBg: raw.callingCardBg || DEFAULT_QUEUE_LAYOUT_CONFIG.callingCardBg,
    callingTokenColor: raw.callingTokenColor || DEFAULT_QUEUE_LAYOUT_CONFIG.callingTokenColor,

    fontFamily: ['cairo', 'tajawal', 'almarai', 'system'].includes(raw.fontFamily) ? raw.fontFamily : DEFAULT_QUEUE_LAYOUT_CONFIG.fontFamily,
    fontWeight: raw.fontWeight === 'black' ? 'black' : 'bold',

    tickerSpeedSeconds: Math.min(80, Math.max(10, Number(raw.tickerSpeedSeconds) || DEFAULT_QUEUE_LAYOUT_CONFIG.tickerSpeedSeconds)),
    tickerBgColor: raw.tickerBgColor || DEFAULT_QUEUE_LAYOUT_CONFIG.tickerBgColor,
    tickerTextColor: raw.tickerTextColor || DEFAULT_QUEUE_LAYOUT_CONFIG.tickerTextColor,
    tickerBadgeBg: raw.tickerBadgeBg || DEFAULT_QUEUE_LAYOUT_CONFIG.tickerBadgeBg,
    tickerBadgeTextColor: raw.tickerBadgeTextColor || DEFAULT_QUEUE_LAYOUT_CONFIG.tickerBadgeTextColor,
    tickerTextSource: ['medical_news', 'custom', 'both'].includes(raw.tickerTextSource) ? raw.tickerTextSource : DEFAULT_QUEUE_LAYOUT_CONFIG.tickerTextSource,
    tickerCustomText: typeof raw.tickerCustomText === 'string' ? raw.tickerCustomText : DEFAULT_QUEUE_LAYOUT_CONFIG.tickerCustomText,
  };
}

/**
 * جلب الإعدادات الحالية من قاعدة البيانات أو التخزين المحلي
 */
export async function fetchQueueLayoutConfig(): Promise<QueueLayoutConfig> {
  // 1. قراءة سريعة من التخزين المحلي لتفادي أي وميض
  let localFallback: QueueLayoutConfig = { ...DEFAULT_QUEUE_LAYOUT_CONFIG };
  if (typeof window !== 'undefined') {
    try {
      const localStr = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localStr) {
        localFallback = sanitizeLayoutConfig(JSON.parse(localStr));
      }
    } catch {
      // ignore
    }
  }

  // 2. محاولة جلب الإعدادات الافتراضية من جدول settings في Supabase
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (!error && data?.value) {
      const remoteConfig = sanitizeLayoutConfig(data.value);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remoteConfig));
        } catch {
          // ignore
        }
      }
      return remoteConfig;
    }
  } catch (err) {
    console.warn('Could not fetch queue layout from Supabase settings:', err);
  }

  // 3. محاولة بديلة عبر مسار API السيرفر
  try {
    const res = await fetch('/api/settings/queue-layout');
    if (res.ok) {
      const json = await res.json();
      if (json?.config) {
        const parsed = sanitizeLayoutConfig(json.config);
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  return localFallback;
}

/**
 * حفظ الإعدادات كإعدادات افتراضية في قاعدة البيانات والتخزين المحلي
 */
export async function saveQueueLayoutConfig(config: QueueLayoutConfig): Promise<{ success: boolean; error?: string }> {
  const sanitized = sanitizeLayoutConfig(config);

  // 1. الحفظ الفوري في التخزين المحلي
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // ignore
    }
  }

  // 2. الحفظ المباشر عبر Supabase client
  try {
    const { error } = await supabase
      .from('settings')
      .upsert({
        key: SETTINGS_KEY,
        value: sanitized,
      });

    if (!error) {
      return { success: true };
    }
  } catch (err: any) {
    console.warn('Supabase direct upsert failed, trying API route...', err);
  }

  // 3. الحفظ الاحتياطي عبر مسار API السيرفر
  try {
    const res = await fetch('/api/settings/queue-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: sanitized }),
    });

    if (res.ok) {
      return { success: true };
    }
    const errJson = await res.json();
    return { success: false, error: errJson?.message || 'فشل حفظ الإعدادات في الخادم' };
  } catch (apiErr: any) {
    return { success: false, error: apiErr?.message || 'تعذر الاتصال بالخادم لحفظ الإعدادات' };
  }
}
