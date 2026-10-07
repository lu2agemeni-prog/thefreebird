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
export type SideStackOrder = 'call_clinics_queue' | 'clinics_call_queue' | 'call_queue_clinics';
export type ScreenLayoutMode = 'split_columns' | 'classic_rows';
export type FontFamilyOption = 'cairo' | 'tajawal' | 'almarai' | 'readex' | 'ibm_plex' | 'system';
export type CardDensity = 'compact' | 'normal' | 'spacious';
export type CardGapSpacing = 'compact' | 'normal' | 'spacious';
export type CardBorderRadius = 'none' | 'small' | 'medium' | 'large' | 'full';
export type CallingPulseEffect = 'none' | 'gentle' | 'vibrant' | 'neon';
export type TickerSeparator = 'star' | 'bar' | 'dot' | 'medical' | 'crescent' | 'sparkle';
export type SlideTransitionEffect = 'fade' | 'slide' | 'zoom' | 'none';
export type LayoutBlueprintKey =
  | 'cinema_left'
  | 'cinema_right'
  | 'media_giant'
  | 'half_and_half'
  | 'call_focus'
  | 'clinics_wall'
  | 'pure_queue_no_media'
  | 'cinema_fullscreen_ads'
  | 'classic_rows'
  | 'custom';

export type ThemePresetKey =
  | 'emerald_dark'
  | 'navy_blue'
  | 'midnight_dark'
  | 'clean_light'
  | 'purple_luxury'
  | 'medical_teal'
  | 'ruby_crimson'
  | 'industrial_slate'
  | 'golden_amber'
  | 'cyber_neon'
  | 'forest_green'
  | 'custom';

export interface QueueLayoutConfig {
  // 1. خيارات عرض وإخفاء الأقسام
  showMedia: boolean;            // الميديا (إعلانات الأطباء / وسائط المركز)
  showClinics: boolean;          // شبكة العيادات والأطباء المتواجدين
  showWaitingList: boolean;      // قائمة الانتظار القادمة
  showCurrentCall: boolean;      // كارت النداء الحالي المباشر
  showNewsTicker: boolean;       // شريط الأخبار بالأسفل
  showHeader: boolean;           // الهيدر وشريط الترويسة العلوي (الشعار والساعة)

  // 2. المقاسات والأبعاد
  mediaWidthPct: number;         // نسبة عرض قسم الميديا في القسم الرئيسي (20 - 85%)
  bottomHeightPct: number;       // نسبة ارتفاع القسم السفلي من الشاشة (15 - 55%)
  tickerHeightPx: number;        // ارتفاع شريط الأخبار بالأسفل بالبكسل (32 - 85px)
  tickerFontSizePx: number;      // حجم خط شريط الأخبار بالبكسل (12 - 28px)
  zoom: number;                  // زووم عام للنصوص والعناصر (0.75 - 1.4)
  waitingListColumns: 1 | 2 | 3; // عدد أعمدة قائمة الانتظار
  clinicsGridColumns: 1 | 2 | 3; // عدد أعمدة كروت الأطباء المتواجدين
  clinicsFontSizePx: number;     // حجم خط بطاقات الأطباء والعيادات بالبكسل (11 - 24px)
  waitingListFontSizePx: number; // حجم خط عناصر قائمة الانتظار بالبكسل (10 - 22px)
  doctorCardPhotoSizePx: number; // حجم صورة الطبيب في كروت العيادات (28 - 72px)
  maxWaitingListItems: number;   // الحد الأقصى لعدد عناصر قائمة الانتظار المعروضة (4 - 30)
  tokenFontSize: number;         // حجم خط رقم النداء بالبكسل (44 - 140px)
  callingDetailsFontSizePx: number; // حجم خط تفاصيل النداء المباشر (12 - 28px)
  cardDensity: CardDensity;      // كثافة وحجم الكروت
  cardGapSpacing: CardGapSpacing;// التباعد بين الكروت
  cardBorderRadius: CardBorderRadius; // استدارة زوايا الكروت
  cardBorderWidth: 0 | 1 | 2 | 3; // سمك حدود وإطار الكروت (0, 1, 2, 3px)
  headerHeightPx: number;        // ارتفاع شريط الترويسة العلوي بالبكسل (45 - 110px)
  headerTitleFontSizePx: number; // حجم خط اسم المركز بالهيدر (14 - 32px)
  headerSubtitleFontSizePx: number; // حجم خط النص الفرعي بالهيدر (10 - 18px)

  // 2.1 مقاسات إعلان الطبيب المتواجد
  doctorPhotoSizePx: number;     // حجم صورة الطبيب في الإعلان بالبكسل (160 - 520px)
  doctorCardLayout: 'side_by_side' | 'stacked'; // طريقة عرض صورة الطبيب وبياناته

  // 3. الأماكن والترتيب في الشاشة
  screenLayoutMode: ScreenLayoutMode; // نمط التخطيط: split_columns أو classic_rows
  mediaPosition: SectionPosition; // مكان الميديا (يمين أو يسار)
  sideStackOrder: SideStackOrder; // ترتيب عناصر العمود الجانبي (نداء ثم عيادات ثم انتظار، أو عيادات أولاً)
  bottomOrder: BottomOrder;       // ترتيب كارت النداء وقائمة الانتظار بالأسفل
  verticalOrder: VerticalOrder;   // ترتيب الأقسام عمودياً

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
  callingPulseEffect: CallingPulseEffect; // تأثير وميض النداء (none, gentle, vibrant, neon)

  // 5. الخطوط ونمط الأرقام
  fontFamily: FontFamilyOption;
  fontWeight: 'medium' | 'bold' | 'black';
  numberFormat: 'western' | 'arabic'; // أرقام لاتينية (123) أو مشرقية عربية (١٢٣)

  // 6. شريط الأخبار بالأسفل والسرعة الهادئة الدقيقة
  tickerSpeedSeconds: number;    // سرعة دوران شريط الأخبار بالثواني (20 - 400s) الافتراضي 120s فائق الهدوء
  tickerSpeedPxPerSec: number;   // سرعة حركة النص بالبكسل/ثانية لضمان هدوء وثبات السرعة (10 - 90 px/s)
  tickerBgColor: string;         // خلفية شريط الأخبار
  tickerTextColor: string;       // لون نص شريط الأخبار
  tickerBadgeBg: string;         // خلفية شارة "أخبار المركز"
  tickerBadgeTextColor: string;  // لون نص شارة "أخبار المركز"
  tickerBadgeText: string;       // نص شارة شريط الأخبار الثابتة
  tickerTextSource: 'medical_news' | 'custom' | 'both'; // مصدر الأخبار
  tickerCustomText: string;      // نص إعلاني إرشادي مخصص
  tickerDirection: 'ltr' | 'rtl'; // اتجاه حركة الشريط (من اليسار لليمين 'ltr' أو من اليمين لليسار 'rtl')
  tickerSeparator: TickerSeparator; // شكل الفاصل بين الأخبار (star, bar, dot, medical, crescent, sparkle)
  tickerPauseOnHover: boolean;   // إيقاف حركة شريط الأخبار عند الوقوف عليه بالماوس

  // 7. إدارة الإعلانات الصوتية وتوقيتات الشاشة
  doctorAudioIntervalMinutes: number; // الفترة بين الإعلانات الصوتية لتواجد الأطباء (3, 5, 10, 15, 20, 30, 45 دقيقة، 0 للتكرار الدائم، -1 لكتم صوت الأطباء)
  patientCallNoticeDurationSec: number; // مدة بقاء إشعار استدعاء المريض المنسدل بالثواني (3 - 25s)
  slideDefaultDurationSec: number; // مدة عرض شريحة الميديا الافتراضية بالثواني (4 - 45s)
  slideTransition: SlideTransitionEffect; // تأثير الانتقال بين الشرائح
  showSlideProgressBar: boolean; // إظهار شريط تقدم الشريحة

  // 8. نصوص وعناصر شريط الترويسة العلوي (Header)
  centerTitle: string;           // اسم المركز بالهيدر
  centerSubtitle: string;        // النص الفرعي بالهيدر
  showClock: boolean;            // إظهار الساعة
  clockFormat: '12h' | '24h';    // صيغة الساعة
  showClockSeconds: boolean;     // إظهار الثواني في الساعة
  showDate: boolean;             // إظهار التاريخ
  showAudioIndicator: boolean;   // إظهار مؤشر الصوت
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
  medical_teal: {
    name: 'تركواز طبي حديث هادئ',
    colors: {
      bgColor: '#021817',
      panelBgColor: '#062826',
      cardBgColor: '#0c3836',
      cardBorderColor: '#155e5b',
      textColor: '#ffffff',
      mutedTextColor: '#5eead4',
      accentColor: '#14b8a6',
      callingCardBg: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
      callingTokenColor: '#ffffff',
      tickerBgColor: '#021817',
      tickerTextColor: '#ccfbf1',
      tickerBadgeBg: '#0d9488',
      tickerBadgeTextColor: '#ffffff',
    },
  },
  ruby_crimson: {
    name: 'عقيق كرزي دافئ ملكي',
    colors: {
      bgColor: '#140407',
      panelBgColor: '#22080d',
      cardBgColor: '#360c14',
      cardBorderColor: '#5c1623',
      textColor: '#ffffff',
      mutedTextColor: '#fda4af',
      accentColor: '#f43f5e',
      callingCardBg: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
      callingTokenColor: '#fef08a',
      tickerBgColor: '#140407',
      tickerTextColor: '#ffe4e6',
      tickerBadgeBg: '#e11d48',
      tickerBadgeTextColor: '#ffffff',
    },
  },
  industrial_slate: {
    name: 'رمادي داكن ناصع التباين',
    colors: {
      bgColor: '#0f172a',
      panelBgColor: '#1e293b',
      cardBgColor: '#334155',
      cardBorderColor: '#475569',
      textColor: '#ffffff',
      mutedTextColor: '#cbd5e1',
      accentColor: '#38bdf8',
      callingCardBg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      callingTokenColor: '#fef08a',
      tickerBgColor: '#090d16',
      tickerTextColor: '#f8fafc',
      tickerBadgeBg: '#2563eb',
      tickerBadgeTextColor: '#ffffff',
    },
  },
  golden_amber: {
    name: 'فخامة الأسود والذهب الملكي',
    colors: {
      bgColor: '#0a0a0b',
      panelBgColor: '#141416',
      cardBgColor: '#1c1b18',
      cardBorderColor: '#3a3322',
      textColor: '#ffffff',
      mutedTextColor: '#d4af37',
      accentColor: '#fbbf24',
      callingCardBg: 'linear-gradient(135deg, #b45309 0%, #d97706 50%, #f59e0b 100%)',
      callingTokenColor: '#000000',
      tickerBgColor: '#0c0a06',
      tickerTextColor: '#fef3c7',
      tickerBadgeBg: '#d97706',
      tickerBadgeTextColor: '#000000',
    },
  },
  cyber_neon: {
    name: 'سايبر نيون أزرق وسماوي حديث',
    colors: {
      bgColor: '#030712',
      panelBgColor: '#0b132b',
      cardBgColor: '#1c2541',
      cardBorderColor: '#3a506b',
      textColor: '#ffffff',
      mutedTextColor: '#6fffe9',
      accentColor: '#00f5d4',
      callingCardBg: 'linear-gradient(135deg, #00b4d8 0%, #0077b6 100%)',
      callingTokenColor: '#ffffff',
      tickerBgColor: '#020617',
      tickerTextColor: '#e0f2fe',
      tickerBadgeBg: '#00b4d8',
      tickerBadgeTextColor: '#ffffff',
    },
  },
  forest_green: {
    name: 'أخضر غابات طبيعي هادئ',
    colors: {
      bgColor: '#05180f',
      panelBgColor: '#0b291b',
      cardBgColor: '#113c27',
      cardBorderColor: '#1c5e3d',
      textColor: '#ffffff',
      mutedTextColor: '#86efac',
      accentColor: '#22c55e',
      callingCardBg: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
      callingTokenColor: '#ffffff',
      tickerBgColor: '#05180f',
      tickerTextColor: '#dcfce7',
      tickerBadgeBg: '#16a34a',
      tickerBadgeTextColor: '#ffffff',
    },
  },
  custom: {
    name: 'تخصيص يدوي حر',
    colors: {},
  },
};

export const LAYOUT_BLUEPRINTS: Record<LayoutBlueprintKey, {
  name: string;
  desc: string;
  badge: string;
  config: Partial<QueueLayoutConfig>;
}> = {
  cinema_left: {
    name: 'سينمائي عريض (ميديا 70% يساراً)',
    desc: 'الميديا منفردة 70% على اليسار والعيادات والنداء والانتظار فوق بعض على اليمين (المخطط الأكثر طلباً)',
    badge: '🌟 التخطيط الموصى به',
    config: {
      screenLayoutMode: 'split_columns',
      mediaPosition: 'left',
      mediaWidthPct: 70,
      showMedia: true,
      showClinics: true,
      showCurrentCall: true,
      showWaitingList: true,
      doctorPhotoSizePx: 320,
      sideStackOrder: 'call_clinics_queue',
    },
  },
  cinema_right: {
    name: 'سينمائي معكوس (ميديا 70% يميناً)',
    desc: 'الميديا على اليمين والعيادات والنداء وقائمة الانتظار على اليسار',
    badge: 'تخطيط معكوس',
    config: {
      screenLayoutMode: 'split_columns',
      mediaPosition: 'right',
      mediaWidthPct: 70,
      showMedia: true,
      showClinics: true,
      showCurrentCall: true,
      showWaitingList: true,
      doctorPhotoSizePx: 320,
      sideStackOrder: 'call_clinics_queue',
    },
  },
  media_giant: {
    name: 'شاشة ميديا عملاقة (80% يساراً)',
    desc: 'مساحة عريضة جداً 80% للفيديوهات وإعلانات الأطباء مع عمود نداء مدمج 20%',
    badge: 'تلفزيون وإعلانات واسعة',
    config: {
      screenLayoutMode: 'split_columns',
      mediaPosition: 'left',
      mediaWidthPct: 80,
      showMedia: true,
      showClinics: true,
      showCurrentCall: true,
      showWaitingList: true,
      doctorPhotoSizePx: 380,
      tokenFontSize: 68,
      clinicsFontSizePx: 12,
    },
  },
  half_and_half: {
    name: 'توازن متناصف (50% ميديا / 50% نداء وعيادات)',
    desc: 'قسمة متساوية 50/50 بين شاشة الميديا وأقسام العيادات والانتظار',
    badge: 'متوازن 50/50',
    config: {
      screenLayoutMode: 'split_columns',
      mediaPosition: 'left',
      mediaWidthPct: 50,
      showMedia: true,
      showClinics: true,
      showCurrentCall: true,
      showWaitingList: true,
      tokenFontSize: 84,
      clinicsGridColumns: 2,
    },
  },
  call_focus: {
    name: 'التركيز الفائق على النداء المباشر',
    desc: 'تكبير كارت النداء المباشر للضعف مع خط عملاق 105px وميديا 52% لسرعة توجيه المرضى',
    badge: 'تركيز على النداء',
    config: {
      screenLayoutMode: 'split_columns',
      mediaPosition: 'left',
      mediaWidthPct: 52,
      tokenFontSize: 105,
      callingPulseEffect: 'vibrant',
      showCurrentCall: true,
      showClinics: true,
      showWaitingList: true,
      sideStackOrder: 'call_clinics_queue',
    },
  },
  clinics_wall: {
    name: 'بانوراما العيادات والأطباء (Clinics Wall)',
    desc: 'مساحة واسعة للعيادات والأطباء المتواجدين (60%) مع كروت فسيحة وميديا 40% للمراكز الكبيرة',
    badge: 'مراكز العيادات المتعددة',
    config: {
      screenLayoutMode: 'split_columns',
      mediaPosition: 'left',
      mediaWidthPct: 40,
      clinicsGridColumns: 2,
      clinicsFontSizePx: 15,
      cardDensity: 'spacious',
      showClinics: true,
      showMedia: true,
      showCurrentCall: true,
      showWaitingList: true,
      sideStackOrder: 'clinics_call_queue',
    },
  },
  pure_queue_no_media: {
    name: 'لوحة استدعاء ومستشفيات نقية (بدون ميديا)',
    desc: 'إخفاء الميديا تماماً واستغلال الشاشة بنسبة 100% للعيادات والنداء وقوائم الانتظار',
    badge: 'شاشة طبية مركزة 100%',
    config: {
      screenLayoutMode: 'split_columns',
      showMedia: false,
      showClinics: true,
      showCurrentCall: true,
      showWaitingList: true,
      tokenFontSize: 92,
      waitingListColumns: 3,
      clinicsGridColumns: 3,
    },
  },
  cinema_fullscreen_ads: {
    name: 'شاشة ميديا تلفزيونية كاملة (100% وسائط)',
    desc: 'عرض الميديا الترويجية وإعلانات الأطباء بكامل الشاشة مع شريط الأخبار السفلي وشريط نداء مصغر',
    badge: 'شاشة استراحة وتلفزيون',
    config: {
      screenLayoutMode: 'split_columns',
      mediaWidthPct: 85,
      showMedia: true,
      showClinics: false,
      showWaitingList: false,
      showCurrentCall: true,
      doctorPhotoSizePx: 420,
    },
  },
  classic_rows: {
    name: 'النمط الأفقي الكلاسيكي (قسم علوي وسفلي)',
    desc: 'الميديا والعيادات بالأعلى وكارت النداء وقائمة الانتظار بعرض كامل بالأسفل',
    badge: 'كلاسيكي تقليدي',
    config: {
      screenLayoutMode: 'classic_rows',
      mediaWidthPct: 55,
      bottomHeightPct: 32,
      bottomOrder: 'call_right_queue_left',
      verticalOrder: 'media_top_queue_bottom',
      showMedia: true,
      showClinics: true,
      showCurrentCall: true,
      showWaitingList: true,
    },
  },
  custom: {
    name: 'تخصيص يدوي حر',
    desc: 'تعديل كافة المقاسات والأبعاد والخيارات يدوياً بحرية كاملة',
    badge: 'مخصص بالكامل',
    config: {},
  },
};

export const DEFAULT_QUEUE_LAYOUT_CONFIG: QueueLayoutConfig = {
  showMedia: true,
  showClinics: true,
  showWaitingList: true,
  showCurrentCall: true,
  showNewsTicker: true,
  showHeader: true,

  tickerHeightPx: 46,
  tickerFontSizePx: 15,
  zoom: 1,
  waitingListColumns: 2,
  clinicsGridColumns: 2,
  clinicsFontSizePx: 14,
  waitingListFontSizePx: 12,
  doctorCardPhotoSizePx: 44,
  maxWaitingListItems: 12,
  tokenFontSize: 76,
  callingDetailsFontSizePx: 14,
  cardDensity: 'normal',
  cardGapSpacing: 'normal',
  cardBorderRadius: 'medium',
  cardBorderWidth: 1,
  headerHeightPx: 66,
  headerTitleFontSizePx: 20,
  headerSubtitleFontSizePx: 11,

  doctorPhotoSizePx: 280,
  doctorCardLayout: 'side_by_side',

  screenLayoutMode: 'split_columns', // النمط السينمائي المتجاوب: ميديا بعرض 70% بجانب العيادات والنداء
  mediaPosition: 'left', // الميديا على اليسار بعرض 70%
  mediaWidthPct: 70, // نسبة عرض قسم الميديا (70% للميديا و 30% للعيادات والنداء وقائمة الانتظار على اليمين)
  sideStackOrder: 'call_clinics_queue',
  bottomHeightPct: 32,
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
  callingPulseEffect: 'vibrant',

  fontFamily: 'cairo',
  fontWeight: 'bold',
  numberFormat: 'western',

  tickerSpeedSeconds: 120, // سرعة هادئة جداً ومريحة ومقروءة تماماً لشريط الأخبار (120 ثانية)
  tickerSpeedPxPerSec: 22, // سرعة حركة النص بالبكسل/ثانية لضمان هدوء وثبات السرعة الدقيق
  tickerBgColor: '#090d16',
  tickerTextColor: '#f8fafc',
  tickerBadgeBg: '#059669',
  tickerBadgeTextColor: '#ffffff',
  tickerBadgeText: 'أخبار المركز والتنبيهات',
  tickerTextSource: 'both',
  tickerCustomText: 'مرحباً بكم في مركز الطائر الحر الطبي.. نتمنى لكم دوام الصحة والعافية.',
  tickerDirection: 'ltr',
  tickerSeparator: 'star',
  tickerPauseOnHover: true,

  doctorAudioIntervalMinutes: 5, // تشغيل الإعلان الصوتي والمرئي لتواجد طبيب واحد كل 5 دقائق بالتتابع ثم التكرار
  patientCallNoticeDurationSec: 8,
  slideDefaultDurationSec: 10,
  slideTransition: 'fade',
  showSlideProgressBar: true,

  centerTitle: 'مركز الطائر الحر الطبي',
  centerSubtitle: 'شاشة العرض والنداء الآلي المباشر',
  showClock: true,
  clockFormat: '12h',
  showClockSeconds: false,
  showDate: true,
  showAudioIndicator: true,
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

    mediaWidthPct: Math.min(85, Math.max(20, Number(raw.mediaWidthPct) || DEFAULT_QUEUE_LAYOUT_CONFIG.mediaWidthPct)),
    bottomHeightPct: Math.min(55, Math.max(15, Number(raw.bottomHeightPct) || DEFAULT_QUEUE_LAYOUT_CONFIG.bottomHeightPct)),
    tickerHeightPx: Math.min(85, Math.max(32, Number(raw.tickerHeightPx) || DEFAULT_QUEUE_LAYOUT_CONFIG.tickerHeightPx)),
    tickerFontSizePx: Math.min(28, Math.max(12, Number(raw.tickerFontSizePx) || DEFAULT_QUEUE_LAYOUT_CONFIG.tickerFontSizePx)),
    zoom: Math.min(1.4, Math.max(0.7, Number(raw.zoom) || DEFAULT_QUEUE_LAYOUT_CONFIG.zoom)),
    waitingListColumns: [1, 2, 3].includes(raw.waitingListColumns) ? raw.waitingListColumns : DEFAULT_QUEUE_LAYOUT_CONFIG.waitingListColumns,
    clinicsGridColumns: [1, 2, 3].includes(raw.clinicsGridColumns) ? raw.clinicsGridColumns : DEFAULT_QUEUE_LAYOUT_CONFIG.clinicsGridColumns,
    clinicsFontSizePx: Math.min(24, Math.max(11, Number(raw.clinicsFontSizePx) || DEFAULT_QUEUE_LAYOUT_CONFIG.clinicsFontSizePx)),
    waitingListFontSizePx: Math.min(22, Math.max(10, Number(raw.waitingListFontSizePx) || DEFAULT_QUEUE_LAYOUT_CONFIG.waitingListFontSizePx)),
    doctorCardPhotoSizePx: Math.min(72, Math.max(28, Number(raw.doctorCardPhotoSizePx) || DEFAULT_QUEUE_LAYOUT_CONFIG.doctorCardPhotoSizePx)),
    maxWaitingListItems: Math.min(30, Math.max(4, Number(raw.maxWaitingListItems) || DEFAULT_QUEUE_LAYOUT_CONFIG.maxWaitingListItems)),
    tokenFontSize: Math.min(140, Math.max(40, Number(raw.tokenFontSize) || DEFAULT_QUEUE_LAYOUT_CONFIG.tokenFontSize)),
    callingDetailsFontSizePx: Math.min(28, Math.max(12, Number(raw.callingDetailsFontSizePx) || DEFAULT_QUEUE_LAYOUT_CONFIG.callingDetailsFontSizePx)),
    cardDensity: ['compact', 'normal', 'spacious'].includes(raw.cardDensity) ? raw.cardDensity : DEFAULT_QUEUE_LAYOUT_CONFIG.cardDensity,
    cardGapSpacing: ['compact', 'normal', 'spacious'].includes(raw.cardGapSpacing) ? raw.cardGapSpacing : DEFAULT_QUEUE_LAYOUT_CONFIG.cardGapSpacing,
    cardBorderRadius: ['none', 'small', 'medium', 'large', 'full'].includes(raw.cardBorderRadius) ? raw.cardBorderRadius : DEFAULT_QUEUE_LAYOUT_CONFIG.cardBorderRadius,
    cardBorderWidth: [0, 1, 2, 3].includes(raw.cardBorderWidth) ? raw.cardBorderWidth : DEFAULT_QUEUE_LAYOUT_CONFIG.cardBorderWidth,
    headerHeightPx: Math.min(110, Math.max(45, Number(raw.headerHeightPx) || DEFAULT_QUEUE_LAYOUT_CONFIG.headerHeightPx)),
    headerTitleFontSizePx: Math.min(32, Math.max(14, Number(raw.headerTitleFontSizePx) || DEFAULT_QUEUE_LAYOUT_CONFIG.headerTitleFontSizePx)),
    headerSubtitleFontSizePx: Math.min(18, Math.max(10, Number(raw.headerSubtitleFontSizePx) || DEFAULT_QUEUE_LAYOUT_CONFIG.headerSubtitleFontSizePx)),

    doctorPhotoSizePx: Math.min(520, Math.max(160, Number(raw.doctorPhotoSizePx) || DEFAULT_QUEUE_LAYOUT_CONFIG.doctorPhotoSizePx)),
    doctorCardLayout: raw.doctorCardLayout === 'stacked' ? 'stacked' : 'side_by_side',

    screenLayoutMode: raw.screenLayoutMode === 'classic_rows' ? 'classic_rows' : 'split_columns',
    mediaPosition: raw.mediaPosition === 'right' ? 'right' : 'left',
    sideStackOrder: ['call_clinics_queue', 'clinics_call_queue', 'call_queue_clinics'].includes(raw.sideStackOrder)
      ? raw.sideStackOrder
      : DEFAULT_QUEUE_LAYOUT_CONFIG.sideStackOrder,
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
    callingPulseEffect: ['none', 'gentle', 'vibrant', 'neon'].includes(raw.callingPulseEffect) ? raw.callingPulseEffect : DEFAULT_QUEUE_LAYOUT_CONFIG.callingPulseEffect,

    fontFamily: ['cairo', 'tajawal', 'almarai', 'readex', 'ibm_plex', 'system'].includes(raw.fontFamily) ? raw.fontFamily : DEFAULT_QUEUE_LAYOUT_CONFIG.fontFamily,
    fontWeight: ['medium', 'bold', 'black'].includes(raw.fontWeight) ? raw.fontWeight : DEFAULT_QUEUE_LAYOUT_CONFIG.fontWeight,
    numberFormat: raw.numberFormat === 'arabic' ? 'arabic' : 'western',

    tickerSpeedSeconds: Math.min(400, Math.max(20, Number(raw.tickerSpeedSeconds) || DEFAULT_QUEUE_LAYOUT_CONFIG.tickerSpeedSeconds)),
    tickerSpeedPxPerSec: Math.min(90, Math.max(10, Number(raw.tickerSpeedPxPerSec) || DEFAULT_QUEUE_LAYOUT_CONFIG.tickerSpeedPxPerSec)),
    tickerBgColor: raw.tickerBgColor || DEFAULT_QUEUE_LAYOUT_CONFIG.tickerBgColor,
    tickerTextColor: raw.tickerTextColor || DEFAULT_QUEUE_LAYOUT_CONFIG.tickerTextColor,
    tickerBadgeBg: raw.tickerBadgeBg || DEFAULT_QUEUE_LAYOUT_CONFIG.tickerBadgeBg,
    tickerBadgeTextColor: raw.tickerBadgeTextColor || DEFAULT_QUEUE_LAYOUT_CONFIG.tickerBadgeTextColor,
    tickerBadgeText: typeof raw.tickerBadgeText === 'string' && raw.tickerBadgeText.trim() ? raw.tickerBadgeText.trim() : DEFAULT_QUEUE_LAYOUT_CONFIG.tickerBadgeText,
    tickerTextSource: ['medical_news', 'custom', 'both'].includes(raw.tickerTextSource) ? raw.tickerTextSource : DEFAULT_QUEUE_LAYOUT_CONFIG.tickerTextSource,
    tickerCustomText: typeof raw.tickerCustomText === 'string' ? raw.tickerCustomText : DEFAULT_QUEUE_LAYOUT_CONFIG.tickerCustomText,
    tickerDirection: raw.tickerDirection === 'rtl' ? 'rtl' : 'ltr',
    tickerSeparator: ['star', 'bar', 'dot', 'medical', 'crescent', 'sparkle'].includes(raw.tickerSeparator) ? raw.tickerSeparator : DEFAULT_QUEUE_LAYOUT_CONFIG.tickerSeparator,
    tickerPauseOnHover: raw.tickerPauseOnHover !== undefined ? Boolean(raw.tickerPauseOnHover) : DEFAULT_QUEUE_LAYOUT_CONFIG.tickerPauseOnHover,

    doctorAudioIntervalMinutes: Number.isFinite(Number(raw.doctorAudioIntervalMinutes))
      ? Number(raw.doctorAudioIntervalMinutes)
      : DEFAULT_QUEUE_LAYOUT_CONFIG.doctorAudioIntervalMinutes,
    patientCallNoticeDurationSec: Math.min(25, Math.max(3, Number(raw.patientCallNoticeDurationSec) || DEFAULT_QUEUE_LAYOUT_CONFIG.patientCallNoticeDurationSec)),
    slideDefaultDurationSec: Math.min(45, Math.max(4, Number(raw.slideDefaultDurationSec) || DEFAULT_QUEUE_LAYOUT_CONFIG.slideDefaultDurationSec)),
    slideTransition: ['fade', 'slide', 'zoom', 'none'].includes(raw.slideTransition) ? raw.slideTransition : DEFAULT_QUEUE_LAYOUT_CONFIG.slideTransition,
    showSlideProgressBar: raw.showSlideProgressBar !== undefined ? Boolean(raw.showSlideProgressBar) : DEFAULT_QUEUE_LAYOUT_CONFIG.showSlideProgressBar,

    centerTitle: typeof raw.centerTitle === 'string' && raw.centerTitle.trim() ? raw.centerTitle.trim() : DEFAULT_QUEUE_LAYOUT_CONFIG.centerTitle,
    centerSubtitle: typeof raw.centerSubtitle === 'string' && raw.centerSubtitle.trim() ? raw.centerSubtitle.trim() : DEFAULT_QUEUE_LAYOUT_CONFIG.centerSubtitle,
    showClock: raw.showClock !== undefined ? Boolean(raw.showClock) : DEFAULT_QUEUE_LAYOUT_CONFIG.showClock,
    clockFormat: raw.clockFormat === '24h' ? '24h' : '12h',
    showClockSeconds: raw.showClockSeconds !== undefined ? Boolean(raw.showClockSeconds) : DEFAULT_QUEUE_LAYOUT_CONFIG.showClockSeconds,
    showDate: raw.showDate !== undefined ? Boolean(raw.showDate) : DEFAULT_QUEUE_LAYOUT_CONFIG.showDate,
    showAudioIndicator: raw.showAudioIndicator !== undefined ? Boolean(raw.showAudioIndicator) : DEFAULT_QUEUE_LAYOUT_CONFIG.showAudioIndicator,
  };
}

/**
 * تحويل الأرقام إلى عربية مشرقية (١٢٣) إذا كان الخيار مفعلاً
 */
export function formatQueueNumber(num: number | string, format?: 'western' | 'arabic'): string {
  if (format !== 'arabic') return String(num);
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (w) => arabicDigits[+w]);
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
