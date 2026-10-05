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
 * إنشاء جدول فترات عمل افتراضي للطبيب مع مراعاة أيام العمل المحددة مسبقاً
 */
export function createDefaultSchedules(legacyWorkingDays?: number[] | null): DoctorShift[] {
  return DAYS_OF_WEEK.map((d) => ({
    id: `shift-${d.day}`,
    day: d.day,
    dayName: d.name,
    startTime: '10:00',
    endTime: '18:00',
    enabled: Array.isArray(legacyWorkingDays) && legacyWorkingDays.length > 0
      ? legacyWorkingDays.includes(d.day)
      : d.day !== 5, // الجمعة معطلة افتراضياً
  }));
}

/**
 * تحويل وقت بنظام 24 ساعة (مثال "14:30") إلى صيغة عربية مفهومة ("02:30 م")
 */
export function formatTime12h(timeStr: string): string {
  if (!timeStr || !timeStr.includes(':')) return timeStr || '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return timeStr;
  const isPM = h >= 12;
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  const paddedH = String(h).padStart(2, '0');
  return `${paddedH}:${m} ${isPM ? 'م' : 'ص'}`;
}

/**
 * صياغة ملخص موحد لجدول مواعيد وساعات عمل الطبيب باللغة العربية
 */
export function formatDoctorScheduleSummary(
  schedules?: DoctorShift[],
  workingDays?: number[] | null
): string {
  const shifts = Array.isArray(schedules) && schedules.length > 0
    ? schedules.filter((s) => s.enabled)
    : (Array.isArray(workingDays) && workingDays.length > 0
        ? createDefaultSchedules(workingDays).filter((s) => s.enabled)
        : []);

  if (shifts.length === 0) {
    return 'غير مجدول';
  }

  // إذا كانت كل الورديات لها نفس التوقيت
  const firstShift = shifts[0];
  const sameHours = shifts.every(
    (s) => s.startTime === firstShift.startTime && s.endTime === firstShift.endTime
  );

  const daysLabel = shifts.map((s) => s.dayName).join('، ');

  if (sameHours) {
    const timeLabel = `${formatTime12h(firstShift.startTime)} - ${formatTime12h(firstShift.endTime)}`;
    if (shifts.length === 7) return `يومياً (${timeLabel})`;
    if (shifts.length >= 5) return `${shifts.length} أيام (${timeLabel})`;
    return `${daysLabel} (${timeLabel})`;
  }

  return `${shifts.length} أيام عمل أسبوعياً`;
}

/**
 * قراءة وتفسير بيانات ميديا ومواعيد الطبيب من عمود bio في قاعدة البيانات
 * مع الحفاظ على التوافق التام مع أيام العمل القديمة (legacyWorkingDays)
 */
export function parseDoctorMediaMeta(
  bioString: string | null | undefined,
  legacyWorkingDays?: number[] | null
): DoctorMediaMeta {
  const fallback: DoctorMediaMeta = {
    ad_duration_seconds: DEFAULT_AD_DURATION,
    schedules: createDefaultSchedules(legacyWorkingDays),
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
    const scheds = Array.isArray(parsed.schedules) && parsed.schedules.length > 0
      ? parsed.schedules
      : createDefaultSchedules(legacyWorkingDays);

    return {
      photo_url: parsed.photo_url || parsed.avatar_url || '',
      audio_url: parsed.audio_url || '',
      ad_duration_seconds: Number(parsed.ad_duration_seconds) > 0 ? Number(parsed.ad_duration_seconds) : DEFAULT_AD_DURATION,
      schedules: scheds,
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
  working_days?: number[] | null;
  presence_updated_at?: string | null;
}): {
  isPresent: boolean;
  source: 'schedule' | 'manual';
  activeShift?: DoctorShift;
  reasonText: string;
} {
  const meta = parseDoctorMediaMeta(doctor.bio, doctor.working_days);
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
 * استخراج أيام العمل كأرقام مصفوفة (0=الأحد ... 6=السبت) من فترات العمل المفعلة
 */
export function extractWorkingDaysFromSchedules(schedules?: DoctorShift[]): number[] {
  if (!schedules || !Array.isArray(schedules)) return [];
  return schedules
    .filter((s) => s.enabled)
    .map((s) => s.day)
    .sort((a, b) => a - b);
}

/**
 * دمج أيام العمل كأرقام مع فترات وساعات العمل لضمان تطابق كامل في مصدر الحقيقة
 */
export function mergeWorkingDaysIntoSchedules(
  workingDays: number[],
  existingSchedules?: DoctorShift[]
): DoctorShift[] {
  const baseSchedules =
    Array.isArray(existingSchedules) && existingSchedules.length > 0
      ? existingSchedules
      : createDefaultSchedules();

  return baseSchedules.map((s) => ({
    ...s,
    enabled: workingDays.includes(s.day),
  }));
}

/**
 * تبديل أو تعيين حالة تواجد الطبيب يدوياً بصورة موحدة وثابتة:
 * يُسجل التعديل في كل من:
 * 1. عمود is_present
 * 2. عمود presence_updated_at
 * 3. حقل manual_override داخل bio JSON (لمنع شاشة النداء من إلغاء تعديل السكرتارية أو الإدارة)
 */
export async function toggleDoctorPresenceUnified(
  supabaseClient: any,
  profileId: string,
  targetPresence?: boolean
): Promise<{ success: boolean; isPresent: boolean; error?: string }> {
  try {
    const { data: doc, error: fetchErr } = await supabaseClient
      .from('doctors')
      .select('profile_id, bio, is_present')
      .eq('profile_id', profileId)
      .single();

    if (fetchErr || !doc) {
      return { success: false, isPresent: false, error: fetchErr?.message || 'طبيب غير موجود' };
    }

    const nextPresence = typeof targetPresence === 'boolean' ? targetPresence : !doc.is_present;
    const { dateStr } = getCairoCurrentTime();
    const meta = parseDoctorMediaMeta(doc.bio);

    // تسجيل التعديل اليدوي في مصدر الحقيقة الموحد
    meta.manual_override = {
      is_active: true,
      presence: nextPresence,
      override_date: dateStr,
      updated_at: new Date().toISOString(),
    };

    const bioPayload = serializeDoctorMediaMeta(meta);

    const { error: updErr } = await supabaseClient
      .from('doctors')
      .update({
        bio: bioPayload,
        is_present: nextPresence,
        presence_updated_at: new Date().toISOString(),
      })
      .eq('profile_id', profileId);

    if (updErr) {
      return { success: false, isPresent: doc.is_present, error: updErr.message };
    }

    return { success: true, isPresent: nextPresence };
  } catch (err: any) {
    return { success: false, isPresent: false, error: err.message };
  }
}

/**
 * إعادة حالة تواجد الطبيب لتتبع الجدول التلقائي وإلغاء التعديل اليدوي
 */
export async function resetDoctorPresenceToScheduleUnified(
  supabaseClient: any,
  profileId: string
): Promise<{ success: boolean; isPresent: boolean; error?: string }> {
  try {
    const { data: doc, error: fetchErr } = await supabaseClient
      .from('doctors')
      .select('profile_id, bio, is_present')
      .eq('profile_id', profileId)
      .single();

    if (fetchErr || !doc) {
      return { success: false, isPresent: false, error: fetchErr?.message || 'طبيب غير موجود' };
    }

    const meta = parseDoctorMediaMeta(doc.bio);
    if (meta.manual_override) {
      meta.manual_override.is_active = false;
    }

    const bioPayload = serializeDoctorMediaMeta(meta);
    const updatedDoc = { ...doc, bio: bioPayload };
    const { isPresent } = calculateDoctorPresence(updatedDoc);

    const { error: updErr } = await supabaseClient
      .from('doctors')
      .update({
        bio: bioPayload,
        is_present: isPresent,
        presence_updated_at: new Date().toISOString(),
      })
      .eq('profile_id', profileId);

    if (updErr) {
      return { success: false, isPresent: doc.is_present, error: updErr.message };
    }

    return { success: true, isPresent };
  } catch (err: any) {
    return { success: false, isPresent: false, error: err.message };
  }
}

/**
 * حفظ ملف الطبيب وجدوله ومواعيده وسعر الكشف بشكل موحد دون فقدان أي بيانات ميديا
 */
export async function saveDoctorUnifiedProfileAndSchedule(
  supabaseClient: any,
  profileId: string,
  data: {
    specialty?: string | null;
    consultation_fee?: number | null;
    bioText?: string | null;
    workingDays?: number[];
    schedules?: DoctorShift[];
    photoUrl?: string;
    audioUrl?: string;
    adDurationSeconds?: number;
    clinicId?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. قراءة البيانات الحالية لتجنب مسح أي بيانات سابقة
    const { data: currentDoc } = await supabaseClient
      .from('doctors')
      .select('bio, working_days, is_present')
      .eq('profile_id', profileId)
      .maybeSingle();

    const meta = parseDoctorMediaMeta(currentDoc?.bio, currentDoc?.working_days);

    if (data.bioText !== undefined) {
      meta.bio_text = data.bioText || '';
    }
    if (data.photoUrl !== undefined) {
      meta.photo_url = data.photoUrl;
    }
    if (data.audioUrl !== undefined) {
      meta.audio_url = data.audioUrl;
    }
    if (data.adDurationSeconds !== undefined) {
      meta.ad_duration_seconds = data.adDurationSeconds;
    }

    // مزامنة المواعيد وأيام العمل بدقة
    let finalSchedules = meta.schedules;
    let finalWorkingDays: number[] = [];

    if (data.schedules) {
      finalSchedules = data.schedules;
      finalWorkingDays = extractWorkingDaysFromSchedules(data.schedules);
    } else if (data.workingDays) {
      finalSchedules = mergeWorkingDaysIntoSchedules(data.workingDays, meta.schedules);
      finalWorkingDays = data.workingDays.sort((a, b) => a - b);
    } else {
      finalWorkingDays = extractWorkingDaysFromSchedules(meta.schedules);
    }

    meta.schedules = finalSchedules;
    const bioPayload = serializeDoctorMediaMeta(meta);

    // حساب التواجد التلقائي بناءً على الجدول الجديد
    const dummyDoc = { ...currentDoc, bio: bioPayload, working_days: finalWorkingDays };
    const { isPresent } = calculateDoctorPresence(dummyDoc);

    const updatePayload: any = {
      bio: bioPayload,
      working_days: finalWorkingDays,
      is_present: isPresent,
      presence_updated_at: new Date().toISOString(),
    };

    if (data.specialty !== undefined) updatePayload.specialty = data.specialty;
    if (data.consultation_fee !== undefined) updatePayload.consultation_fee = data.consultation_fee;
    if (data.clinicId !== undefined) updatePayload.clinic_id = data.clinicId;

    if (!currentDoc) {
      const { error: insErr } = await supabaseClient
        .from('doctors')
        .upsert([{ profile_id: profileId, ...updatePayload }]);
      if (insErr) return { success: false, error: insErr.message };
      return { success: true };
    }

    const { error } = await supabaseClient
      .from('doctors')
      .update(updatePayload)
      .eq('profile_id', profileId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
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
