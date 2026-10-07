// ============================================================================
// lib/queue-auto-complete.ts
// نظام الإنهاء التلقائي لأدوار النداء الآلي بعد ساعتين من تسجيلها:
// - فحص واستبعاد أي حالة مر عليها أكثر من ساعتين (120 دقيقة) تلقائياً.
// - تحديث حالة الدور في قاعدة البيانات إلى 'completed' (انتهت المقابلة).
// - ضمان عدم بقاء الحالات المنسية على شاشات التلفزيون أو لوحة الطبيب والسكرتارية.
// ============================================================================

export const QUEUE_AUTO_COMPLETE_HOURS = 2; // ساعتان
export const QUEUE_AUTO_COMPLETE_MS = QUEUE_AUTO_COMPLETE_HOURS * 60 * 60 * 1000; // 7,200,000 مللي ثانية

/**
 * فحص ما إذا كان دور المريض قد تجاوز الساعتين منذ تسجيله
 */
export function isQueueItemExpired(
  item: { created_at?: string | null; updated_at?: string | null; status?: string },
  maxAgeHours: number = QUEUE_AUTO_COMPLETE_HOURS
): boolean {
  if (!item) return false;
  // إذا كانت الحالة منتهية بالفعل، فلا حاجة لفحص الانتهاء التلقائي
  if (item.status === 'completed') return false;

  const rawTime = item.created_at || item.updated_at;
  if (!rawTime) return false;

  const timestamp = new Date(rawTime).getTime();
  if (isNaN(timestamp)) return false;

  const ageMs = Date.now() - timestamp;
  return ageMs >= maxAgeHours * 60 * 60 * 1000;
}

/**
 * تصفية فورية في المتصفح لاستبعاد أي دور تجاوز الساعتين
 * يضمن عدم ظهور أي دور منتهٍ على الشاشة حتى لو كان تحديث قاعدة البيانات قيد التنفيذ
 */
export function filterOutExpiredQueueItems<T = any>(
  items: T[],
  maxAgeHours: number = QUEUE_AUTO_COMPLETE_HOURS
): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item: any) => !isQueueItemExpired(item, maxAgeHours));
}

/**
 * حساب الوقت المتبقي قبل الإنهاء التلقائي للدور
 */
export function getTimeRemainingBeforeExpiry(
  item: { created_at?: string | null; updated_at?: string | null },
  maxAgeHours: number = QUEUE_AUTO_COMPLETE_HOURS
): { minutesRemaining: number; isExpired: boolean; formatted: string } {
  const rawTime = item.created_at || item.updated_at;
  if (!rawTime) {
    return { minutesRemaining: 120, isExpired: false, formatted: 'ساعتان' };
  }

  const timestamp = new Date(rawTime).getTime();
  if (isNaN(timestamp)) {
    return { minutesRemaining: 120, isExpired: false, formatted: 'ساعتان' };
  }

  const ageMs = Date.now() - timestamp;
  const maxMs = maxAgeHours * 60 * 60 * 1000;
  const remainingMs = maxMs - ageMs;

  if (remainingMs <= 0) {
    return { minutesRemaining: 0, isExpired: true, formatted: 'انتهى تلقائياً (تجاوز ساعتين)' };
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
 * تشغيل مسار الخادم للإنهاء التلقائي لضمان تطبيق التحديث في قاعدة البيانات حتى بدون جلسة مستخدم مسجلة
 */
export async function triggerAutoCompleteServer(): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      fetch('/api/queue/auto-complete', { method: 'POST' }).catch(() => {});
    }
  } catch {
    // تجاهل أخطاء الشبكة المؤقتة
  }
}

/**
 * تنفيذ الإنهاء التلقائي للحالات المنتهية (أكثر من ساعتين) في قاعدة بيانات Supabase
 * تُحدث الحالة إلى 'completed' وتحدث توقيت updated_at
 */
export async function autoCompleteExpiredQueueItems(
  supabaseClient: any,
  maxAgeHours: number = QUEUE_AUTO_COMPLETE_HOURS
): Promise<{ success: boolean; completedCount: number; error?: string }> {
  try {
    const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    // 1. تحديث الحالات التي مر على تاريخ إنشائها ساعتان
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
      console.info(`[QueueAutoExpire] تم إنهاء ${totalCount} دور تلقائياً لتجاوزها فترة الساعتين.`);
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
