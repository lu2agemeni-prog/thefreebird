// ============================================================================
// lib/queue-broadcast.ts
// نظام البث والتحكم اللحظي في نداء وتكرار نداء المرضى على الشاشات:
// - بث نداء لحظي عبر WebSockets (0ms زمن استجابة)
// - تحديث حالة وتوقيت النداء في قاعدة البيانات (call_queue.updated_at)
// - ضمان استجابة شاشة الانتظار للتكرار صوتياً ومرئياً
// ============================================================================

import { supabase } from '@/lib/supabase';
import { playQueueAnnouncement } from '@/lib/queueAudio';

export interface PatientCallBroadcastPayload {
  queueId: string;
  token: number;
  patientName?: string;
  clinicName?: string;
  doctorName?: string;
  audioNumber?: number | null;
  isRepeat?: boolean;
  timestamp?: number;
}

export const PATIENT_CALL_CHANNEL = 'patient_call_announcements';
export const PATIENT_CALL_EVENT = 'call_patient';

/**
 * إرسال بث لحظي للنداء أو تكرار النداء إلى جميع الشاشات المتصلة
 */
export async function broadcastPatientCall(payload: PatientCallBroadcastPayload): Promise<void> {
  try {
    const channel = supabase.channel(PATIENT_CALL_CHANNEL);
    await channel.send({
      type: 'broadcast',
      event: PATIENT_CALL_EVENT,
      payload: {
        ...payload,
        timestamp: payload.timestamp || Date.now(),
      },
    });
  } catch (err) {
    console.warn('Failed to broadcast patient call:', err);
  }
}

/**
 * تكرار النداء على مريض في الطابور مع تحديث قاعدة البيانات وبث النداء وتشغيل الصوت
 */
export async function repeatPatientCall(
  queueItem: { id: string; token_number: number; patient_name?: string },
  clinic?: { name?: string; audio_number?: number | null; doctor_name?: string },
  options?: { playLocalAudio?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();

    // 1. تحديث قاعدة البيانات لتسجيل توقيت النداء الجديد وضمان status = 'calling'
    const { error } = await supabase
      .from('call_queue')
      .update({
        status: 'calling',
        updated_at: now,
      })
      .eq('id', queueItem.id);

    if (error) {
      return { success: false, error: error.message };
    }

    // 2. إرسال البث اللحظي لشاشة التلفزيون وشاشات الانتظار
    await broadcastPatientCall({
      queueId: queueItem.id,
      token: queueItem.token_number,
      patientName: queueItem.patient_name,
      clinicName: clinic?.name || 'العيادة',
      doctorName: clinic?.doctor_name,
      audioNumber: clinic?.audio_number,
      isRepeat: true,
      timestamp: Date.now(),
    });

    // 3. تشغيل الصوت محلياً على جهاز المنادي (طبيب أو سكرتارية) إذا كان مفضلاً
    if (options?.playLocalAudio && clinic?.name) {
      playQueueAnnouncement(
        queueItem.token_number,
        clinic.name,
        clinic.audio_number,
        { isRepeat: true }
      ).catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ أثناء تكرار النداء' };
  }
}
