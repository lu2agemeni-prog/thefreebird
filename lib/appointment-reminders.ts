// ============================================================================
// lib/appointment-reminders.ts
// منطق ومساعدات نظام تذكير المواعيد الآلي (SMS & Push Notifications)
// يخدم إرسال التذكيرات للمرضى قبل 24 ساعة من موعد الكشف
// ============================================================================

export type DeliveryChannel = 'push' | 'sms' | 'both';

export interface ReminderSettings {
  autoEnabled: boolean;
  channels: DeliveryChannel;
  leadTimeHours: number; // الافتراضي 24 ساعة
  messageTemplate: string;
  smsSenderName: string;
}

export interface AppointmentDataForReminder {
  id: string;
  appointment_date: string;
  status: string;
  patient_id?: string;
  patient?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    patient_code?: string;
  };
  doctor?: {
    profiles?: {
      first_name?: string;
      last_name?: string;
    };
  };
  clinic?: {
    name?: string;
  };
}

export interface ReminderLogItem {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  clinicName: string;
  doctorName: string;
  appointmentDate: string;
  channel: DeliveryChannel;
  status: 'sent' | 'failed';
  message: string;
  sentAt: string;
  smsLink?: string;
  whatsappLink?: string;
}

export const DEFAULT_REMINDER_TEMPLATE =
  'مرحباً {المريض}، نود تذكيرك بموعد الكشف القادم غداً {التاريخ} الساعة {التوقيت} بعيادة {العيادة} (د. {الطبيب}). نرجو الحضور قبل الموعد بـ 15 دقيقة.';

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  autoEnabled: true,
  channels: 'both',
  leadTimeHours: 24,
  messageTemplate: DEFAULT_REMINDER_TEMPLATE,
  smsSenderName: 'المركز الطبي',
};

/**
 * تنسيق نص الرسالة استناداً للقالب وبيانات الموعد
 */
export function formatReminderMessage(
  template: string,
  appt: AppointmentDataForReminder
): string {
  const patientName =
    appt.patient?.first_name || appt.patient?.last_name
      ? `${appt.patient?.first_name || ''} ${appt.patient?.last_name || ''}`.trim()
      : 'عزيزنا المريض';

  const doctorName =
    appt.doctor?.profiles?.first_name || appt.doctor?.profiles?.last_name
      ? `${appt.doctor?.profiles?.first_name || ''} ${appt.doctor?.profiles?.last_name || ''}`.trim()
      : 'المعالج';

  const clinicName = appt.clinic?.name || 'المركز';

  const apptDateObj = new Date(appt.appointment_date);
  const dateStr = apptDateObj.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const timeStr = apptDateObj.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const patientCode = appt.patient?.patient_code || '';

  let msg = template || DEFAULT_REMINDER_TEMPLATE;
  msg = msg.replace(/{المريض}/g, patientName);
  msg = msg.replace(/{اسم_المريض}/g, patientName);
  msg = msg.replace(/{العيادة}/g, clinicName);
  msg = msg.replace(/{الطبيب}/g, doctorName);
  msg = msg.replace(/{التاريخ}/g, dateStr);
  msg = msg.replace(/{تاريخ_الموعد}/g, dateStr);
  msg = msg.replace(/{التوقيت}/g, timeStr);
  msg = msg.replace(/{توقيت_الموعد}/g, timeStr);
  msg = msg.replace(/{الكود}/g, patientCode);

  return msg;
}

/**
 * توليد رابط إرسال رسالة SMS مباشرة
 */
export function getDirectSmsUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  return `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
}

/**
 * توليد رابط إرسال عبر واتساب كقناة موازية للرسائل
 */
export function getWhatsAppUrl(phone: string, message: string): string {
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  // إضافة كود الدولة المصري لو رقم محلي يبدأ بـ 01
  if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
    cleanPhone = '2' + cleanPhone;
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * حساب الساعات المتبقية حتى الموعد
 */
export function getHoursRemaining(appointmentDate: string): number {
  const now = Date.now();
  const apptTime = new Date(appointmentDate).getTime();
  const diffMs = apptTime - now;
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
}
