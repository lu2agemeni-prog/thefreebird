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
  audioNumber?: number | null
): Promise<void> {
  try {
    await playFile('/audio/ding.mp3');
  } catch {
    // تجاهل فشل نغمة التنبيه، النداء نفسه أهم
  }

  try {
    await playFile(`/audio/${tokenNumber}.mp3`);
  } catch {
    await speak(`دور رقم ${tokenNumber}`);
  }

  if (audioNumber) {
    try {
      await playFile(`/audio/clinic${audioNumber}.mp3`);
      return;
    } catch {
      // نكمل على TTS تحت
    }
  }

  await speak(`تفضل بالدخول إلى ${clinicName}`);
}
