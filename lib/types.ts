// ============================================================================
// lib/types.ts
// أنواع (union types) لأعمدة الحالة/النوع بدل النص الحر — أي خطأ إملائي
// كان يُنشئ حالة غير صالحة في القاعدة. القيم هنا مطابقة تمامًا لقيود
// CHECK في fix_security_and_integrity.sql.
// ============================================================================

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type ConsultationStatus = 'pending' | 'answered';
export type ComplaintStatus = 'open' | 'resolved';
export type ComplaintType = 'complaint' | 'suggestion';
export type CallQueueStatus = 'waiting' | 'calling' | 'completed';
export type TransactionType = 'income' | 'expense' | 'salary';

// ——— قوائم القيم المسموحة (للاستخدام في الفلترة/التحقق) ———
export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];
export const CONSULTATION_STATUSES: ConsultationStatus[] = ['pending', 'answered'];
export const COMPLAINT_STATUSES: ComplaintStatus[] = ['open', 'resolved'];
export const COMPLAINT_TYPES: ComplaintType[] = ['complaint', 'suggestion'];
export const CALL_QUEUE_STATUSES: CallQueueStatus[] = ['waiting', 'calling', 'completed'];
export const TRANSACTION_TYPES: TransactionType[] = ['income', 'expense', 'salary'];

// ——— تحويل آمن من نص حر (قديم) إلى قيمة مسموحة ———
export function toAppointmentStatus(v: string | null | undefined, fallback: AppointmentStatus = 'pending'): AppointmentStatus {
  return APPOINTMENT_STATUSES.includes(v as AppointmentStatus) ? (v as AppointmentStatus) : fallback;
}
export function toConsultationStatus(v: string | null | undefined, fallback: ConsultationStatus = 'pending'): ConsultationStatus {
  return CONSULTATION_STATUSES.includes(v as ConsultationStatus) ? (v as ConsultationStatus) : fallback;
}
export function toComplaintStatus(v: string | null | undefined, fallback: ComplaintStatus = 'open'): ComplaintStatus {
  return COMPLAINT_STATUSES.includes(v as ComplaintStatus) ? (v as ComplaintStatus) : fallback;
}
export function toComplaintType(v: string | null | undefined, fallback: ComplaintType = 'complaint'): ComplaintType {
  return COMPLAINT_TYPES.includes(v as ComplaintType) ? (v as ComplaintType) : fallback;
}
export function toCallQueueStatus(v: string | null | undefined, fallback: CallQueueStatus = 'waiting'): CallQueueStatus {
  return CALL_QUEUE_STATUSES.includes(v as CallQueueStatus) ? (v as CallQueueStatus) : fallback;
}
export function toTransactionType(v: string | null | undefined, fallback: TransactionType = 'expense'): TransactionType {
  return TRANSACTION_TYPES.includes(v as TransactionType) ? (v as TransactionType) : fallback;
}

// ——— التسميات العربية ———
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

export const CONSULTATION_STATUS_LABELS: Record<ConsultationStatus, string> = {
  pending: 'قيد المراجعة',
  answered: 'تم الرد',
};

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  open: 'مفتوحة',
  resolved: 'تم الحل',
};

export const COMPLAINT_TYPE_LABELS: Record<ComplaintType, string> = {
  complaint: 'شكوى',
  suggestion: 'اقتراح',
};

export const CALL_QUEUE_STATUS_LABELS: Record<CallQueueStatus, string> = {
  waiting: 'في الانتظار',
  calling: 'جارٍ النداء',
  completed: 'تم الدخول',
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: 'إيراد',
  expense: 'مصروف',
  salary: 'راتب',
};

// ——— ألوان الحالات (Tailwind classes) ———
export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const CONSULTATION_STATUS_COLORS: Record<ConsultationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  answered: 'bg-green-100 text-green-800',
};

export const COMPLAINT_STATUS_COLORS: Record<ComplaintStatus, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
};

export const CALL_QUEUE_STATUS_COLORS: Record<CallQueueStatus, string> = {
  waiting: 'bg-yellow-100 text-yellow-800',
  calling: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
};

export const TRANSACTION_TYPE_COLORS: Record<TransactionType, string> = {
  income: 'bg-green-100 text-green-800',
  expense: 'bg-red-100 text-red-800',
  salary: 'bg-purple-100 text-purple-800',
};

// ——— أيام الأسبوع (نظام JS: 0=الأحد ... 6=السبت، مطابق لعمود working_days) ———
export const WEEK_DAYS: { value: number; label: string }[] = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الإثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
];

export function workingDaysLabel(days: number[] | null | undefined): string {
  if (!days || days.length === 0) return 'غير محدد';
  return days
    .map((d) => WEEK_DAYS.find((w) => w.value === d)?.label ?? String(d))
    .join('، ');
}

// ——— واجهات الجداول الرئيسية (تُستخدم في اللوحات) ———
export interface ClinicSettingsWorkingHours {
  open: string;
  close: string;
}

export interface ClinicSettings {
  general_working_hours?: Record<string, ClinicSettingsWorkingHours | null> & { note?: string };
  emergency_phone?: { value: string; note?: string };
  wifi_credentials?: { ssid: string; password: string; note?: string };
  complaints_daily_limit?: { value: number; note?: string };
  complaints_anon_daily_limit?: { value: number; note?: string };
}
