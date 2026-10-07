// ============================================================================
// lib/queue-auto-complete.ts
// نظام الإنهاء التلقائي لأدوار النداء الآلي القابل للتخصيص من المدير:
// - تحديد المدة: ساعة واحدة، ساعتان (الافتراضي)، 3 ساعات، 4 ساعات، مدة مخصصة بالدقائق
// - أو إنهاء تلقائي بنهاية اليوم عند الساعة 12:00 منتصف الليل (12 م/ص)
// - حفظ واسترجاع الإعدادات من جدول settings مع كاش وتطبيق فوري عبر كافة الشاشات
// - تحديث حالة الدور في قاعدة البيانات إلى 'completed' (انتهت المقابلة) تلقائياً
// ============================================================================

import { supabase } from '@/lib/supabase';

export type QueueAutoExpireMode = 'hours' | 'end_of_day';

export interface QueueAutoExpireConfig {
  mode: QueueAutoExpireMode; // 'hours' أو 'end_of_day'
  hours: number;             // عدد الساعات في وضع hours (1, 2, 3, 4...)
  customMinutes?: number;    // عدد الدقائق المخصصة إن وجدت
  updatedAt?: string;
  updatedBy?: string;
}

export const QUEUE_AUTO_EXPIRE_SETTINGS_KEY = 'queue_auto_expire_config';
export const QUEUE_AUTO_EXPIRE_LOCAL_KEY = 'queue_auto_expire_config_cache';

export const DEFAULT_QUEUE_AUTO_EXPIRE_CONFIG: QueueAutoExpireConfig = {
  mode: 'hours',
  hours: 2, // ساعتان افتراضياً
};

// توافق عكسي مع المتغيرات السابقة
export const QUEUE_AUTO_COMPLETE_HOURS = 2;
export const QUEUE_AUTO_COMPLETE_MS = 2 * 60 * 60 * 1000;

// كاش في الذاكرة لتسريع الوصول بدون تأخير
let memoryConfigCache: QueueAutoExpireConfig | null = null;

/**
 * فحص وتصحيح كائن الإعدادات
 */
export function sanitizeQueueAutoExpireConfig(raw: any): QueueAutoExpireConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_QUEUE_AUTO_EXPIRE_CONFIG };
  }

  const mode: QueueAutoExpireMode = raw.mode === 'end_of_day' ? 'end_of_day' : 'hours';
  const hours = typeof raw.hours === 'number' && raw.hours > 0 ? raw.hours : 2;
  const customMinutes = typeof raw.customMinutes === 'number' && raw.customMinutes > 0
    ? raw.customMinutes
    : undefined;

  return {
    mode,
    hours,
    customMinutes,
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
  };
}

/**
 * جلب إعدادات الإنهاء التلقائي المعتمدة من المدير
 */
export async function fetchQueueAutoExpireConfig(supabaseClient: any = supabase): Promise<QueueAutoExpireConfig> {
  // 1. الكاش السريع في الذاكرة
  if (memoryConfigCache) {
    return memoryConfigCache;
  }

  // 2. الكاش في التخزين المحلي (LocalStorage)
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(QUEUE_AUTO_EXPIRE_LOCAL_KEY);
      if (cached) {
        const parsed = sanitizeQueueAutoExpireConfig(JSON.parse(cached));
        memoryConfigCache = parsed;
      }
    } catch {
      // ignore
    }
  }

  // 3. الجلب المباشر من جدول settings في Supabase
  try {
    const { data, error } = await supabaseClient
      .from('settings')
      .select('value')
      .eq('key', QUEUE_AUTO_EXPIRE_SETTINGS_KEY)
      .maybeSingle();

    if (!error && data?.value) {
      const sanitized = sanitizeQueueAutoExpireConfig(data.value);
      memoryConfigCache = sanitized;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(QUEUE_AUTO_EXPIRE_LOCAL_KEY, JSON.stringify(sanitized));
        } catch {
          // ignore
        }
      }
      return sanitized;
    }
  } catch (err) {
    console.warn('Could not fetch queue auto-expire config from Supabase:', err);
  }

  // 4. محاولة بديلة عبر مسار API السيرفر
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/settings/queue-auto-expire');
      if (res.ok) {
        const json = await res.json();
        if (json?.config) {
          const sanitized = sanitizeQueueAutoExpireConfig(json.config);
          memoryConfigCache = sanitized;
          localStorage.setItem(QUEUE_AUTO_EXPIRE_LOCAL_KEY, JSON.stringify(sanitized));
          return sanitized;
        }
      }
    }
  } catch {
    // ignore
  }

  return memoryConfigCache || { ...DEFAULT_QUEUE_AUTO_EXPIRE_CONFIG };
}

/**
 * حفظ وتطبيق إعدادات الإنهاء التلقائي الجديدة من المدير
 */
export async function saveQueueAutoExpireConfig(
  newConfig: QueueAutoExpireConfig,
  supabaseClient: any = supabase
): Promise<{ success: boolean; config: QueueAutoExpireConfig; error?: string }> {
  const sanitized = sanitizeQueueAutoExpireConfig({
    ...newConfig,
    updatedAt: new Date().toISOString(),
  });

  // 1. تحديث الكاش المحلي والذاكرة فوراً
  memoryConfigCache = sanitized;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(QUEUE_AUTO_EXPIRE_LOCAL_KEY, JSON.stringify(sanitized));
    } catch {
      // ignore
    }
  }

  // 2. الحفظ المباشر في جدول settings
  try {
    const { error } = await supabaseClient
      .from('settings')
      .upsert({
        key: QUEUE_AUTO_EXPIRE_SETTINGS_KEY,
        value: sanitized,
      });

    if (!error) {
      // بث التحديث عبر القناة اللحظية لتحديث كافة الشاشات المفتوحة
      try {
        const channel = supabaseClient.channel('queue_settings_broadcast');
        channel.send({
          type: 'broadcast',
          event: 'auto_expire_config_updated',
          payload: sanitized,
        }).catch(() => {});
      } catch {
        // ignore
      }

      // تشغيل فحص وتنظيف فوري بالأرقام الجديدة
      autoCompleteExpiredQueueItems(supabaseClient, sanitized).catch(() => {});
      triggerAutoCompleteServer(sanitized).catch(() => {});

      return { success: true, config: sanitized };
    }
  } catch (err: any) {
    console.warn('Direct settings upsert failed, trying API route...', err);
  }

  // 3. الحفظ الاحتياطي عبر مسار API السيرفر
  try {
    const res = await fetch('/api/settings/queue-auto-expire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: sanitized }),
    });

    if (res.ok) {
      const json = await res.json();
      return { success: true, config: sanitized };
    }
    const errJson = await res.json().catch(() => ({}));
    return { success: false, config: sanitized, error: errJson.error || 'فشل حفظ الإعدادات' };
  } catch (err: any) {
    return { success: false, config: sanitized, error: err.message || 'فشل الاتصال بالخادم' };
  }
}

/**
 * فحص ما إذا كان دور المريض قد انتهت مدته وفق إعدادات المدير الحالية
 */
export function isQueueItemExpired(
  item: { created_at?: string | null; updated_at?: string | null; status?: string },
  configOrHours: QueueAutoExpireConfig | number = memoryConfigCache || DEFAULT_QUEUE_AUTO_EXPIRE_CONFIG
): boolean {
  if (!item) return false;
  // إذا كانت الحالة منتهية بالفعل، فلا حاجة لفحص الانتهاء التلقائي
  if (item.status === 'completed') return false;

  const rawTime = item.created_at || item.updated_at;
  if (!rawTime) return false;

  const timestamp = new Date(rawTime).getTime();
  if (isNaN(timestamp)) return false;

  const config: QueueAutoExpireConfig =
    typeof configOrHours === 'number'
      ? { mode: 'hours', hours: configOrHours }
      : sanitizeQueueAutoExpireConfig(configOrHours);

  // وضع 1: الانتهاء بنهاية اليوم عند الساعة 12:00 منتصف الليل (12 م/ص)
  if (config.mode === 'end_of_day') {
    const createdDate = new Date(timestamp);
    const now = new Date();

    // فحص ما إذا كان تاريخ إنشاء الدور في يوم سابق
    const isPastDay =
      createdDate.getFullYear() < now.getFullYear() ||
      (createdDate.getFullYear() === now.getFullYear() && createdDate.getMonth() < now.getMonth()) ||
      (createdDate.getFullYear() === now.getFullYear() &&
        createdDate.getMonth() === now.getMonth() &&
        createdDate.getDate() < now.getDate());

    if (isPastDay) return true;

    // نهاية اليوم الحالي (الساعة 23:59:59.999)
    const endOfCurrentDay = new Date(createdDate);
    endOfCurrentDay.setHours(23, 59, 59, 999);
    return Date.now() > endOfCurrentDay.getTime();
  }

  // وضع 2: الانتهاء بعد عدد ساعات أو دقائق محددة
  const durationMs = config.customMinutes
    ? config.customMinutes * 60 * 1000
    : config.hours * 60 * 60 * 1000;

  const ageMs = Date.now() - timestamp;
  return ageMs >= durationMs;
}

/**
 * تصفية فورية في المتصفح لاستبعاد أي دور تجاوز المدة المحددة
 */
export function filterOutExpiredQueueItems<T = any>(
  items: T[],
  configOrHours: QueueAutoExpireConfig | number = memoryConfigCache || DEFAULT_QUEUE_AUTO_EXPIRE_CONFIG
): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item: any) => !isQueueItemExpired(item, configOrHours));
}

/**
 * حساب الوقت المتبقي قبل الإنهاء التلقائي للدور
 */
export function getTimeRemainingBeforeExpiry(
  item: { created_at?: string | null; updated_at?: string | null },
  configOrHours: QueueAutoExpireConfig | number = memoryConfigCache || DEFAULT_QUEUE_AUTO_EXPIRE_CONFIG
): { minutesRemaining: number; isExpired: boolean; formatted: string } {
  const rawTime = item.created_at || item.updated_at;
  const config: QueueAutoExpireConfig =
    typeof configOrHours === 'number'
      ? { mode: 'hours', hours: configOrHours }
      : sanitizeQueueAutoExpireConfig(configOrHours);

  if (!rawTime) {
    return {
      minutesRemaining: config.mode === 'end_of_day' ? 720 : (config.customMinutes || config.hours * 60),
      isExpired: false,
      formatted: config.mode === 'end_of_day' ? 'نهاية اليوم' : formatExpiryConfigSummary(config),
    };
  }

  const timestamp = new Date(rawTime).getTime();
  if (isNaN(timestamp)) {
    return {
      minutesRemaining: 120,
      isExpired: false,
      formatted: 'غير محدد',
    };
  }

  // وضع نهاية اليوم 12 منتصف الليل
  if (config.mode === 'end_of_day') {
    const createdDate = new Date(timestamp);
    const endOfDay = new Date(createdDate);
    endOfDay.setHours(23, 59, 59, 999);

    const remainingMs = endOfDay.getTime() - Date.now();
    if (remainingMs <= 0) {
      return {
        minutesRemaining: 0,
        isExpired: true,
        formatted: 'انتهى تلقائياً (بانتهاء اليوم 12:00 منتصف الليل)',
      };
    }

    const minutes = Math.ceil(remainingMs / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return {
      minutesRemaining: minutes,
      isExpired: false,
      formatted: mins > 0 ? `${hours} ساعة و ${mins} دقيقة (حتى 12 ليلاً)` : `${hours} ساعة (حتى 12 ليلاً)`,
    };
  }

  // وضع الساعات أو الدقائق المخصصة
  const durationMs = config.customMinutes
    ? config.customMinutes * 60 * 1000
    : config.hours * 60 * 60 * 1000;

  const ageMs = Date.now() - timestamp;
  const remainingMs = durationMs - ageMs;

  if (remainingMs <= 0) {
    return {
      minutesRemaining: 0,
      isExpired: true,
      formatted: `انتهى تلقائياً (تجاوز ${formatExpiryConfigSummary(config)})`,
    };
  }

  const minutes = Math.ceil(remainingMs / (60 * 1000));
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return {
      minutesRemaining: minutes,
      isExpired: false,
      formatted: mins > 0 ? `${hours} ساعة و ${mins} دقيقة` : `${hours} ساعة`,
    };
  }

  return {
    minutesRemaining: minutes,
    isExpired: false,
    formatted: `${minutes} دقيقة`,
  };
}

/**
 * حساب الوقت المنقضي منذ تسجيل الحالة
 */
export function getTimeSinceRegistration(
  item: { created_at?: string | null; updated_at?: string | null }
): { minutesAgo: number; formatted: string } {
  const rawTime = item.created_at || item.updated_at;
  if (!rawTime) return { minutesAgo: 0, formatted: 'الآن' };
  const timestamp = new Date(rawTime).getTime();
  if (isNaN(timestamp)) return { minutesAgo: 0, formatted: 'الآن' };
  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return { minutesAgo: 0, formatted: 'الآن' };
  if (minutes < 60) return { minutesAgo: minutes, formatted: `${minutes} دقيقة` };
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return {
    minutesAgo: minutes,
    formatted: remainingMins > 0 ? `${hours} ساعة و ${remainingMins} دقيقة` : `${hours} ساعة`,
  };
}

/**
 * نص ملخص للإعداد الحالي للعرض باللغة العربية
 */
export function formatExpiryConfigSummary(config: QueueAutoExpireConfig): string {
  if (config.mode === 'end_of_day') {
    return 'نهاية اليوم (12:00 منتصف الليل)';
  }
  if (config.customMinutes) {
    return `${config.customMinutes} دقيقة`;
  }
  if (config.hours === 1) return 'ساعة واحدة (60 دقيقة)';
  if (config.hours === 2) return 'ساعتان (120 دقيقة)';
  if (config.hours >= 3 && config.hours <= 10) return `${config.hours} ساعات`;
  return `${config.hours} ساعة`;
}

/**
 * تشغيل مسار الخادم للإنهاء التلقائي لضمان تطبيق التحديث في قاعدة البيانات
 */
export async function triggerAutoCompleteServer(config?: QueueAutoExpireConfig): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      fetch('/api/queue/auto-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: config ? JSON.stringify({ config }) : undefined,
      }).catch(() => {});
    }
  } catch {
    // تجاهل أخطاء الشبكة المؤقتة
  }
}

/**
 * تنفيذ الإنهاء التلقائي للحالات المنتهية في قاعدة بيانات Supabase
 */
export async function autoCompleteExpiredQueueItems(
  supabaseClient: any = supabase,
  configOrHours: QueueAutoExpireConfig | number = memoryConfigCache || DEFAULT_QUEUE_AUTO_EXPIRE_CONFIG
): Promise<{ success: boolean; completedCount: number; error?: string }> {
  try {
    const config: QueueAutoExpireConfig =
      typeof configOrHours === 'number'
        ? { mode: 'hours', hours: configOrHours }
        : sanitizeQueueAutoExpireConfig(configOrHours);

    const nowIso = new Date().toISOString();
    let cutoffDate: string;

    if (config.mode === 'end_of_day') {
      // كل الحالات المسجلة قبل بداية اليوم الحالي تنتهي
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      cutoffDate = todayStart.toISOString();
    } else {
      const durationMs = config.customMinutes
        ? config.customMinutes * 60 * 1000
        : config.hours * 60 * 60 * 1000;
      cutoffDate = new Date(Date.now() - durationMs).toISOString();
    }

    // 1. تحديث الحالات التي مر على تاريخ إنشائها المدة المحددة
    const { data: updatedWithCreatedAt, error: err1 } = await supabaseClient
      .from('call_queue')
      .update({
        status: 'completed',
        updated_at: nowIso,
      })
      .in('status', ['waiting', 'calling'])
      .lt('created_at', cutoffDate)
      .select('id, token_number, patient_name');

    if (err1) {
      console.warn('Auto-complete queue items error (created_at):', err1.message);
    }

    // 2. معالجة الحالات القديمة إن كانت created_at فارغة واعتمدت على updated_at
    const { data: updatedWithUpdatedAt, error: err2 } = await supabaseClient
      .from('call_queue')
      .update({
        status: 'completed',
        updated_at: nowIso,
      })
      .in('status', ['waiting', 'calling'])
      .is('created_at', null)
      .lt('updated_at', cutoffDate)
      .select('id, token_number, patient_name');

    if (err2) {
      console.warn('Auto-complete queue items error (updated_at fallback):', err2.message);
    }

    const count1 = updatedWithCreatedAt ? updatedWithCreatedAt.length : 0;
    const count2 = updatedWithUpdatedAt ? updatedWithUpdatedAt.length : 0;
    const totalCount = count1 + count2;

    if (totalCount > 0) {
      console.info(
        `[QueueAutoExpire] تم إنهاء ${totalCount} دور تلقائياً وفق الضبط (${formatExpiryConfigSummary(config)}).`
      );
    }

    return {
      success: true,
      completedCount: totalCount,
    };
  } catch (error: any) {
    console.error('Failed to auto-complete expired queue items:', error);
    return {
      success: false,
      completedCount: 0,
      error: error?.message || 'فشل في الإنهاء التلقائي للأدوار المنتهية',
    };
  }
}
