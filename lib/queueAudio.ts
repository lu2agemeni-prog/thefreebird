// ============================================================================
// lib/queueAudio.ts
// تشغيل تتابع صوتي للنداء الآلي: ding.mp3 -> {رقم الدور}.mp3 -> clinic{رقم}.mp3
// الملفات المتوقعة في /public/audio/. لو أي ملف ناقص أو فشل تحميله،
// بيتحول تلقائيًا لقراءة نصية بصوت المتصفح (Web Speech API) بدل ما
// النداء يفشل بصمت.
// ============================================================================

let currentAnnouncementAudio: HTMLAudioElement | null = null;
let currentAnnouncementId = 0;

export function stopCurrentAnnouncement(): void {
  currentAnnouncementId++;
  if (currentAnnouncementAudio) {
    try {
      currentAnnouncementAudio.pause();
      currentAnnouncementAudio.currentTime = 0;
    } catch {
      // ignore
    }
    currentAnnouncementAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

function playFile(src: string, myId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (myId !== currentAnnouncementId) {
      resolve();
      return;
    }
    const audio = new Audio(src);
    currentAnnouncementAudio = audio;

    const cleanup = () => {
      if (currentAnnouncementAudio === audio) {
        currentAnnouncementAudio = null;
      }
    };

    audio.addEventListener('ended', () => {
      cleanup();
      resolve();
    });
    audio.addEventListener('error', () => {
      cleanup();
      reject(new Error(`تعذر تشغيل ${src}`));
    });
    audio.play().catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

function speak(text: string, myId: number): Promise<void> {
  return new Promise((resolve) => {
    if (myId !== currentAnnouncementId) {
      resolve();
      return;
    }
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-EG';
      utterance.rate = 0.95;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}

export interface QueueAnnouncementOptions {
  isRepeat?: boolean;
  repeatTimes?: number;
  chimeCount?: number;
}

/**
 * ينادي على رقم دور معيّن مع توجيهه لعيادة معيّنة.
 * ملفات الصوت المتوقعة:
 *   /public/audio/ding.mp3        — نغمة تنبيه قبل النداء
 *   /public/audio/{tokenNumber}.mp3 — نطق الرقم (1.mp3, 2.mp3 ...)
 *   /public/audio/clinic{audioNumber}.mp3 — اسم العيادة (clinic1.mp3 ...)
 */
export async function playQueueAnnouncement(
  tokenNumber: number,
  clinicName: string,
  audioNumber?: number | null,
  options?: QueueAnnouncementOptions
): Promise<void> {
  // إلغاء أي نداء صوتي سابق شغال لمنع تداخل أو تكرار الأصوات
  stopCurrentAnnouncement();
  const myId = currentAnnouncementId;

  const isRepeat = !!options?.isRepeat;
  const chimeCount = options?.chimeCount || (isRepeat ? 2 : 1);
  const totalRounds = Math.max(1, Math.min(3, options?.repeatTimes || 1));

  for (let round = 0; round < totalRounds; round++) {
    if (myId !== currentAnnouncementId) return;

    // 1. تشغيل نغمة التنبيه (ding) مع دعم التكرار السريع في حالة تكرار النداء
    for (let c = 0; c < chimeCount; c++) {
      if (myId !== currentAnnouncementId) return;
      try {
        await playFile('/audio/ding.mp3', myId);
        if (c < chimeCount - 1) {
          await new Promise((r) => setTimeout(r, 120));
        }
      } catch {
        // تجاهل فشل نغمة التنبيه، النداء نفسه أهم
      }
    }

    if (myId !== currentAnnouncementId) return;

    // 2. نطق رقم الدور
    try {
      await playFile(`/audio/${tokenNumber}.mp3`, myId);
    } catch {
      if (myId !== currentAnnouncementId) return;
      const prefix = isRepeat ? 'تكرار النداء.. ' : '';
      await speak(`${prefix}دور رقم ${tokenNumber}`, myId);
    }

    if (myId !== currentAnnouncementId) return;

    // 3. نطق اسم أو رقم العيادة
    let playedClinicFile = false;
    if (audioNumber) {
      try {
        await playFile(`/audio/clinic${audioNumber}.mp3`, myId);
        playedClinicFile = true;
      } catch {
        // نكمل على TTS تحت
      }
    }

    if (!playedClinicFile && myId === currentAnnouncementId) {
      await speak(`تفضل بالدخول إلى ${clinicName}`, myId);
    }

    if (round < totalRounds - 1 && myId === currentAnnouncementId) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
}

/**
 * الإعلان الصوتي عن تواجد الطبيب عبر قراءة صوتية باللغة العربية (TTS)
 * في حال عدم توفر مقطع صوتي مخصص مسجل للطبيب
 */
export function speakDoctorAnnouncement(
  doctorName: string,
  clinicName: string,
  specialty?: string
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const specText = specialty ? `، ${specialty}` : '';
      const text = `يتواجد الآن في ${clinicName || 'العيادة'}: دكتور ${doctorName}${specText}.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-EG';
      utterance.rate = 0.92;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}

