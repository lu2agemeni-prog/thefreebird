// ============================================================================
// lib/errors.ts
// تحويل أخطاء Supabase/Postgres إلى رسائل عربية ودّية — بما فيها أخطاء
// قيود القاعدة الجديدة (حد الشكاوى اليومي، تعارض المواعيد، أيام العمل).
// ============================================================================

/** يستخرج رسالة عربية ودّية من خطأ Supabase/Postgres أو أي Error */
export function getFriendlyErrorMessage(error: unknown, fallback = 'حدث خطأ غير متوقع. برجاء المحاولة مرة أخرى.'): string {
  if (!error) return fallback;

  const raw =
    typeof error === 'string'
      ? error
      : ((error as { message?: string })?.message ?? '');

  if (!raw) return fallback;

  // أخطاء الـ triggers المخصصة (بصيغة CODE: message)
  if (raw.includes('RATE_LIMIT_EXCEEDED')) {
    return raw.split('RATE_LIMIT_EXCEEDED:')[1]?.trim() || 'بلغتَ الحد اليومي المسموح به من الرسائل. برجاء المحاولة غدًا.';
  }
  if (raw.includes('ANON_RATE_LIMIT_EXCEEDED')) {
    return raw.split('ANON_RATE_LIMIT_EXCEEDED:')[1]?.trim() || 'تم استقبال العدد الأقصى من رسائل الزوار اليوم. برجاء المحاولة غدًا.';
  }
  if (raw.includes('APPOINTMENT_CONFLICT')) {
    return raw.split('APPOINTMENT_CONFLICT:')[1]?.trim() || 'يوجد موعد آخر لنفس الطبيب في هذا التوقيت. برجاء اختيار وقت مختلف.';
  }
  if (raw.includes('OUTSIDE_WORKING_DAYS')) {
    return raw.split('OUTSIDE_WORKING_DAYS:')[1]?.trim() || 'الطبيب لا يستقبل المرضى في هذا اليوم. برجاء اختيار يوم من أيام عمله.';
  }

  // أخطاء قيود CHECK (قيمة حالة غير مسموحة)
  if (raw.includes('violates check constraint')) {
    return 'قيمة غير صالحة تم رفضها من قاعدة البيانات (تحقق من الحالة/النوع المختار).';
  }

  // أخطاء RLS/صلاحيات — كانت تفشل بصمت سابقًا
  if (raw.includes('row-level security') || raw.includes('violates row-level security')) {
    return 'ليس لديك صلاحية تنفيذ هذا الإجراء.';
  }
  if (raw.includes('duplicate key')) {
    return 'هذا السجل موجود بالفعل.';
  }
  if (raw.includes('JWT') || raw.includes('token') || raw.includes('session')) {
    return 'انتهت صلاحية الجلسة. برجاء تسجيل الدخول مرة أخرى.';
  }

  // أخطاء شبكة/اتصال
  if (raw.includes('Failed to fetch') || raw.includes('NetworkError') || raw.includes('fetch failed')) {
    return 'تعذر الاتصال بالخادم. برجاء التحقق من الإنترنت وإعادة المحاولة.';
  }

  return raw || fallback;
}

/** يقرأ نص الخطأ العربي المضمّن في تفاصيل خطأ Postgres من supabase-js */
export function getPostgresHint(error: unknown): string | null {
  const e = error as { code?: string; details?: string; hint?: string };
  return e?.hint ?? e?.details ?? null;
}
