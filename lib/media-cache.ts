// ============================================================================
// lib/media-cache.ts
// نظام التخزين المؤقت المسبق (Preloader & In-Memory Cache) للصور والمقاطع الصوتية
// - تحميل المقاطع الصوتية والصور مسبقاً في الذاكرة لتشغيلها فوريًا بدون أي تأخير.
// - التحكم الكامل في إيقاف وتشغيل الصوتيات وضمان أولوية نداء المريض بنسبة 100%.
// ============================================================================

class MediaCacheManager {
  private imageCache: Set<string> = new Set();
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private currentlyPlayingAudio: HTMLAudioElement | null = null;
  private onAudioEndedCallback: (() => void) | null = null;

  /**
   * تحميل صورة مسبقاً في كاش المتصفح
   */
  public preloadImage(url: string): Promise<boolean> {
    if (!url || typeof window === 'undefined') return Promise.resolve(false);
    if (this.imageCache.has(url)) return Promise.resolve(true);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.add(url);
        resolve(true);
      };
      img.onerror = () => {
        resolve(false);
      };
      img.src = url;
    });
  }

  /**
   * تحميل مقطع صوتي مسبقاً في الذاكرة وتجهيزه للتشغيل الفوري
   */
  public preloadAudio(url: string): HTMLAudioElement | null {
    if (!url || typeof window === 'undefined') return null;

    const cleanUrl = url.trim();
    if (this.audioCache.has(cleanUrl)) {
      return this.audioCache.get(cleanUrl)!;
    }

    try {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = cleanUrl;
      // تحميل جزء من البيانات للتأكد من الجاهزية
      audio.load();
      this.audioCache.set(cleanUrl, audio);
      return audio;
    } catch (e) {
      console.warn('Failed to preload audio:', cleanUrl, e);
      return null;
    }
  }

  /**
   * تشغيل مقطع صوتي مخزن مع التحكم في تكرار المرة الواحدة
   */
  public playDoctorAudio(
    url: string,
    onEnded?: () => void,
    volume: number = 0.9
  ): { stop: () => void; isPlaying: boolean } {
    if (!url || typeof window === 'undefined') {
      return { stop: () => {}, isPlaying: false };
    }

    // إيقاف أي مقطع صوتي كان يعمل سابقاً
    this.stopAllAudio();

    let audio: HTMLAudioElement | null | undefined = this.audioCache.get(url.trim());
    if (!audio) {
      audio = this.preloadAudio(url.trim());
    }

    if (!audio) {
      return { stop: () => {}, isPlaying: false };
    }

    try {
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, volume));
      this.currentlyPlayingAudio = audio;
      this.onAudioEndedCallback = onEnded || null;

      const endedHandler = () => {
        if (this.onAudioEndedCallback) {
          this.onAudioEndedCallback();
        }
        audio?.removeEventListener('ended', endedHandler);
        if (this.currentlyPlayingAudio === audio) {
          this.currentlyPlayingAudio = null;
        }
      };

      audio.addEventListener('ended', endedHandler, { once: true });

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Doctor audio play failed (maybe user gesture needed):', err);
          if (this.currentlyPlayingAudio === audio) {
            this.currentlyPlayingAudio = null;
          }
        });
      }

      return {
        stop: () => this.stopAllAudio(),
        isPlaying: true,
      };
    } catch (err) {
      console.warn('Error starting doctor audio:', err);
      return { stop: () => {}, isPlaying: false };
    }
  }

  /**
   * إيقاف فوري لكافة المقاطع الصوتية لإعطاء الأولوية المطلقة لنداء المريض
   */
  public stopAllAudio(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // ignore
      }
    }

    if (this.currentlyPlayingAudio) {
      try {
        this.currentlyPlayingAudio.pause();
        this.currentlyPlayingAudio.currentTime = 0;
      } catch (e) {
        // ignore
      }
      this.currentlyPlayingAudio = null;
    }

    this.audioCache.forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (e) {
        // ignore
      }
    });

    this.onAudioEndedCallback = null;
  }

  /**
   * فحص ما إذا كان هناك صوت طبيب يعمل حالياً
   */
  public isDoctorAudioPlaying(): boolean {
    return !!(this.currentlyPlayingAudio && !this.currentlyPlayingAudio.paused);
  }
}

export const mediaCache = new MediaCacheManager();
