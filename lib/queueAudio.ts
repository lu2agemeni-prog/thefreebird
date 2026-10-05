// ============================================================================
// lib/queueAudio.ts
// تشغيل تتابع صوتي للنداء الآلي: ding.mp3 -> {رقم الدور}.mp3 -> clinic{رقم}.mp3
// الملفات المتوقعة في /public/audio/. لو أي ملف ناقص أو فشل تحميله،
// بيتحول تلقائيًا لقراءة نصية بصوت المتصفح (Web Speech API) بدل ما
// النداء يفشل بصمت.
// ============================================================================

function playFile(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(src);
    audio.addEventListener('ended', () => resolve());
    audio.addEventListener('error', () => reject(new Error(`تعذر تشغيل ${src}`)));
    audio.play().catch(reject);
  });
}

function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
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
  const isRepeat = !!options?.isRepeat;
  const chimeCount = options?.chimeCount || (isRepeat ? 2 : 1);
  const totalRounds = Math.max(1, Math.min(3, options?.repeatTimes || 1));

  for (let round = 0; round < totalRounds; round++) {
    // 1. تشغيل نغمة التنبيه (ding) مع دعم التكرار السريع في حالة تكرار النداء
    for (let c = 0; c < chimeCount; c++) {
      try {
        await playFile('/audio/ding.mp3');
        if (c < chimeCount - 1) {
          await new Promise((r) => setTimeout(r, 120));
        }
      } catch {
        // تجاهل فشل نغمة التنبيه، النداء نفسه أهم
      }
    }

    // 2. نطق رقم الدور
    try {
      await playFile(`/audio/${tokenNumber}.mp3`);
    } catch {
      const prefix = isRepeat ? 'تكرار النداء.. ' : '';
      await speak(`${prefix}دور رقم ${tokenNumber}`);
    }

    // 3. نطق اسم أو رقم العيادة
    let playedClinicFile = false;
    if (audioNumber) {
      try {
        await playFile(`/audio/clinic${audioNumber}.mp3`);
        playedClinicFile = true;
      } catch {
        // نكمل على TTS تحت
      }
    }

    if (!playedClinicFile) {
      await speak(`تفضل بالدخول إلى ${clinicName}`);
    }

    if (round < totalRounds - 1) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
}
