// ============================================================================
// lib/doctor-schedules.ts
// نظام إدارة مواعيد وفترات عمل الأطباء والتحديد التلقائي للتواجد (Presence):
// - تحديد مواعيد العمل بالمركز لكل طبيب باليوم والتوقيت (من كذا إلى كذا).
// - تحديد حالة التواجد تلقائياً خلال أوقات العمل والرجوع لغير متواجد بعدها.
// - دعم التعديل اليدوي للتواجد (Manual Override) من الإدارة والسكرتارية.
// - تخزين ميديا الأطباء (صورة الطبيب + المقطع الصوتي + مدة الإعلان).
// ============================================================================

export interface DoctorShift {
  id: string;
  day: number; // 0=الأحد, 1=الإثنين, 2=الثلاثاء, 3=الأربعاء, 4=الخميس, 5=الجمعة, 6=السبت
  dayName: string;
  startTime: string; // "10:00" (صيغة 24 ساعة)
  endTime: string;   // "16:00"
  enabled: boolean;
}

export interface DoctorMediaMeta {
  photo_url?: string;
  audio_url?: string;
  ad_duration_seconds: number; // الافتراضي 30 ثانية
  schedules: DoctorShift[];
  manual_override?: {
    is_active: boolean;
    presence: boolean;
    override_date: string; // YYYY-MM-DD
    updated_at: string;
  };
  bio_text?: string;
}

export const DAYS_OF_WEEK = [
  { day: 6, name: 'السبت', shortName: 'سبت' },
  { day: 0, name: 'الأحد', shortName: 'أحد' },
  { day: 1, name: 'الإثنين', shortName: 'إثنين' },
  { day: 2, name: 'الثلاثاء', shortName: 'ثلاثاء' },
  { day: 3, name: 'الأربعاء', shortName: 'أربعاء' },
  { day: 4, name: 'الخميس', shortName: 'خميس' },
  { day: 5, name: 'الجمعة', shortName: 'جمعة' },
];

export const DEFAULT_AD_DURATION = 30; // 30 ثانية لكل طبيب

/**
 * إنشاء جدول فترات عمل افتراضي للطبيب
 */
export function createDefaultSchedules(): DoctorShift[] {
  return DAYS_OF_WEEK.map((d) => ({
    id: `shift-${d.day}`,
    day: d.day,
    dayName: d.name,
    startTime: '10:00',
    endTime: '18:00',
    enabled: d.day !== 5, // الجمعة معطلة افتراضياً
  }));
}

/**
 * قراءة وتفسير بيانات ميديا ومواعيد الطبيب من عمود bio في قاعدة البيانات
 */
export function parseDoctorMediaMeta(bioString: string | null | undefined): DoctorMediaMeta {
  const fallback: DoctorMediaMeta = {
    ad_duration_seconds: DEFAULT_AD_DURATION,
    schedules: createDefaultSchedules(),
  };

  if (!bioString || typeof bioString !== 'string') {
    return fallback;
  }

  const trimmed = bioString.trim();
  if (!trimmed.startsWith('{')) {
    // نص وصفي عادي قديم — نحافظ عليه
    return {
      ...fallback,
      bio_text: trimmed,
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    return {
      photo_url: parsed.photo_url || parsed.avatar_url || '',
      audio_url: parsed.audio_url || '',
      ad_duration_seconds: Number(parsed.ad_duration_seconds) > 0 ? Number(parsed.ad_duration_seconds) : DEFAULT_AD_DURATION,
      schedules: Array.isArray(parsed.schedules) && parsed.schedules.length > 0 ? parsed.schedules : createDefaultSchedules(),
      manual_override: parsed.manual_override || undefined,
      bio_text: parsed.bio_text || '',
    };
  } catch {
    return {
      ...fallback,
      bio_text: trimmed,
    };
  }
}

/**
 * تسلسل بيانات ميديا ومواعيد الطبيب لحفظها في عمود bio
 */
export function serializeDoctorMediaMeta(meta: DoctorMediaMeta): string {
  return JSON.stringify({
    photo_url: meta.photo_url || '',
    audio_url: meta.audio_url || '',
    ad_duration_seconds: meta.ad_duration_seconds || DEFAULT_AD_DURATION,
    schedules: meta.schedules || [],
    manual_override: meta.manual_override || null,
    bio_text: meta.bio_text || '',
  });
}

/**
 * جلب الوقت الحالي بتوقيت القاهرة بصيغة (رقم اليوم 0-6 والوقت HH:mm)
 */
export function getCairoCurrentTime(): { dayOfWeek: number; timeStr: string; dateStr: string } {
  const now = new Date();
  try {
    // توقيت مصر
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const hour = getPart('hour');
    const minute = getPart('minute');

    // اليوم في الأسبوع (الأحد = 0)
    const dayOfWeek = now.getDay();
    const timeStr = `${hour}:${minute}`;
    const dateStr = `${year}-${month}-${day}`;

    return { dayOfWeek, timeStr, dateStr };
  } catch {
    const dayOfWeek = now.getDay();
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return {
      dayOfWeek,
      timeStr: `${hour}:${minute}`,
      dateStr: `${year}-${month}-${day}`,
    };
  }
}

/**
 * فحص ما إذا كان الطبيب مجدولاً في فترة عمل حالية
 */
export function isDoctorScheduledNow(schedules?: DoctorShift[]): {
  isScheduled: boolean;
  activeShift?: DoctorShift;
  nextShift?: DoctorShift;
} {
  if (!schedules || schedules.length === 0) {
    return { isScheduled: false };
  }

  const { dayOfWeek, timeStr } = getCairoCurrentTime();

  // فحص الشيفتات النشطة لليوم الحالي
  const todayShifts = schedules.filter((s) => s.enabled && s.day === dayOfWeek);

  for (const shift of todayShifts) {
    if (shift.startTime <= shift.endTime) {
      if (timeStr >= shift.startTime && timeStr <= shift.endTime) {
        return { isScheduled: true, activeShift: shift };
      }
    } else {
      // دوام يمتد بعد منتصف الليل
      if (timeStr >= shift.startTime || timeStr <= shift.endTime) {
        return { isScheduled: true, activeShift: shift };
      }
    }
  }

  return { isScheduled: false };
}

/**
 * حساب حالة تواجد الطبيب الفعلية مع احترام التعديل اليدوي لليوم الحالي
 */
export function calculateDoctorPresence(doctor: {
  is_present?: boolean;
  bio?: string | null;
  presence_updated_at?: string | null;
}): {
  isPresent: boolean;
  source: 'schedule' | 'manual';
  activeShift?: DoctorShift;
  reasonText: string;
} {
  const meta = parseDoctorMediaMeta(doctor.bio);
  const { dateStr } = getCairoCurrentTime();

  // 1. فحص التعديل اليدوي إذا كان سارياً لتاريخ اليوم
  if (
    meta.manual_override?.is_active &&
    meta.manual_override.override_date === dateStr
  ) {
    const isManualPresent = !!meta.manual_override.presence;
    return {
      isPresent: isManualPresent,
      source: 'manual',
      reasonText: isManualPresent ? 'متواجد (تعديل يدوي من الإدارة)' : 'غير متواجد (تعديل يدوي من الإدارة)',
    };
  }

  // 2. إذا لم يكن هناك تعديل يدوي، يتم التحديد التلقائي وفق جدول المواعيد
  const { isScheduled, activeShift } = isDoctorScheduledNow(meta.schedules);

  if (isScheduled && activeShift) {
    return {
      isPresent: true,
      source: 'schedule',
      activeShift,
      reasonText: `متواجد تلقائياً وفق جدول العمل (${activeShift.dayName} ${activeShift.startTime} - ${activeShift.endTime})`,
    };
  }

  return {
    isPresent: false,
    source: 'schedule',
    reasonText: 'غير متواجد (خارج فترات العمل المحددة)',
  };
}

/**
 * مزامنة تواجد الأطباء تلقائياً في قاعدة البيانات وفق مواعيد العمل الحالية
 * تُحدث عمود is_present في جدول doctors ليعكس الواقع في كافة الشاشات لحظياً
 */
export async function syncDoctorsPresenceWithDatabase(
  supabaseClient: any,
  doctorsList: any[]
): Promise<number> {
  let updatedCount = 0;

  for (const doc of doctorsList) {
    if (!doc.profile_id) continue;

    const { isPresent } = calculateDoctorPresence(doc);
    const currentDbPresence = !!doc.is_present;

    // إذا اختلفت حالة التواجد الحالية عن المسجلة بالقاعدة، نقوم بالتحديث
    if (isPresent !== currentDbPresence) {
      try {
        await supabaseClient
          .from('doctors')
          .update({
            is_present: isPresent,
            presence_updated_at: new Date().toISOString(),
          })
          .eq('profile_id', doc.profile_id);
        updatedCount++;
      } catch (err) {
        console.warn('Error syncing presence for doctor', doc.profile_id, err);
      }
    }
  }

  return updatedCount;
}
