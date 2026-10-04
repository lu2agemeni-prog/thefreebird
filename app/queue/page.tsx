'use client';

// ============================================================================
// app/queue/page.tsx
// شاشة النداء الآلي المطورة والشاملة (Call Display Screen):
// - تحكم كامل في عرض وإخفاء الأقسام (الميديا، العيادات، قائمة الانتظار، شريط الأخبار بالأسفل).
// - تحديد مقاسات وأبعاد ونسب كل قسم وزووم الشاشة وحجم أرقام النداء.
// - التحكم الكامل بأماكن وترتيب الأقسام (يمين / يسار / أعلى / أسفل).
// - تخصيص الألوان والثيمات والخطوط العربية (Cairo, Tajawal, Almarai, System).
// - شريط أخبار وتنبيهات متحرك بالأسفل (جديد) مع ربط مباشر بالأخبار الطبية والنصوص المخصصة.
// - حفظ الإعدادات كإعدادات افتراضية في قاعدة البيانات (Supabase settings) لتطبيقها على كافة الشاشات.
// - شريط إعدادات علوي تفاعلي يظهر عند مرور الماوس، مع إمكانية التبديل السريع وتخصيص التفاصيل.
// - الأولوية المطلقة لنداء المريض مع إيقاف صوت الطبيب فورياً عند صدور النداء.
// ============================================================================

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Monitor,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Stethoscope,
  Sliders,
  RotateCcw,
  Sparkles,
  Building,
  Radio,
  Image as ImageIcon,
  CheckCircle2,
  Save,
  Eye,
  EyeOff,
  Newspaper,
  Loader2,
  Calendar,
} from 'lucide-react';
import { playQueueAnnouncement } from '@/lib/queueAudio';
import {
  parseDoctorMediaMeta,
  calculateDoctorPresence,
  syncDoctorsPresenceWithDatabase,
  DEFAULT_AD_DURATION,
} from '@/lib/doctor-schedules';
import { mediaCache } from '@/lib/media-cache';
import {
  QueueLayoutConfig,
  DEFAULT_QUEUE_LAYOUT_CONFIG,
  fetchQueueLayoutConfig,
  saveQueueLayoutConfig,
  sanitizeLayoutConfig,
  formatQueueNumber,
} from '@/lib/queue-layout-config';
import { QueueNewsTicker } from '@/components/queue/QueueNewsTicker';
import { QueueLayoutSettingsModal } from '@/components/queue/QueueLayoutSettingsModal';

interface DoctorMediaSlide {
  type: 'doctor';
  doctorId: string;
  doctorName: string;
  clinicName: string;
  specialty?: string;
  photoUrl: string;
  audioUrl?: string;
  durationSeconds: number;
  currentToken: number | null;
}

interface GeneralMediaSlide {
  type: 'general';
  id: string;
  mediaType: 'image' | 'video';
  url: string;
  durationSeconds: number;
}

type MediaSlideItem = DoctorMediaSlide | GeneralMediaSlide;

export default function QueueDisplay() {
  const [queue, setQueue] = useState<any[]>([]);
  const [rawDoctors, setRawDoctors] = useState<any[]>([]);
  const [generalMedia, setGeneralMedia] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // حالة إعدادات وتخصيصات الشاشة
  const [config, setConfig] = useState<QueueLayoutConfig>(DEFAULT_QUEUE_LAYOUT_CONFIG);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState(false);

  // فهرس الشريحة المعروضة حالياً
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0); // 0 to 100%
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // إعدادات الشاشة العلوية
  const [showBar, setShowBar] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // التحكم في الصوت
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [muteDoctorAudio, setMuteDoctorAudio] = useState(false);
  const soundEnabledRef = useRef(false);
  const muteDoctorAudioRef = useRef(false);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // تتبع فترات الإعلان الصوتي لتواجد الأطباء لمنع الإزعاج الصوتي المتكرر
  const lastDoctorAudioRoundFinishedAtRef = useRef<number>(0);
  const doctorsAnnouncedInActiveRoundRef = useRef<Set<string>>(new Set());

  // مراجع نداء المريض
  const lastAnnouncedIdRef = useRef<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // إشعار النداء المنبثق
  const [dropNotice, setDropNotice] = useState<{ token: number; clinicName: string; doctorName?: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // نداء السكرتارية المباشر
  const [secretaryAlert, setSecretaryAlert] = useState<string | null>(null);
  const secretaryAlertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. تحميل الإعدادات الافتراضية للشاشة من قاعدة البيانات والتخزين المحلي
  useEffect(() => {
    let isMounted = true;
    async function initConfig() {
      try {
        const loaded = await fetchQueueLayoutConfig();
        if (isMounted) {
          setConfig(loaded);
          setIsConfigLoaded(true);
        }
      } catch (e) {
        console.warn('Error initializing queue layout config:', e);
        if (isMounted) setIsConfigLoaded(true);
      }
    }
    initConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. تحديث زووم الشاشة بناءً على الإعدادات
  useEffect(() => {
    if (config.zoom) {
      document.documentElement.style.fontSize = `${config.zoom * 100}%`;
    }
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [config.zoom]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    muteDoctorAudioRef.current = muteDoctorAudio;
    if (muteDoctorAudio) {
      mediaCache.stopAllAudio();
      setTimeout(() => setIsAudioPlaying(false), 0);
    }
  }, [muteDoctorAudio]);

  // حفظ الإعدادات في قاعدة البيانات
  const handleSaveConfigToDB = async () => {
    setIsSavingConfig(true);
    setSaveSuccessBanner(false);
    try {
      const res = await saveQueueLayoutConfig(config);
      if (res.success) {
        setSaveSuccessBanner(true);
        setTimeout(() => setSaveSuccessBanner(false), 4500);
      } else {
        alert(res.error || 'تعذر حفظ الإعدادات في قاعدة البيانات.');
      }
    } catch (err: any) {
      alert(err?.message || 'خطأ أثناء حفظ الإعدادات.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // استعادة الإعدادات الأصلية
  const handleResetToDefaults = () => {
    if (confirm('هل ترغب حقاً في استعادة الإعدادات القياسية لشاشة النداء؟')) {
      setConfig({ ...DEFAULT_QUEUE_LAYOUT_CONFIG });
    }
  };

  // تفعيل الصوت من المستخدم
  const enableSound = () => {
    const unlock = new Audio('/audio/ding.mp3');
    unlock.volume = 0;
    unlock.play().catch(() => {});
    setSoundEnabled(true);
  };

  // جلب وتحديث بيانات الطابور العام
  const fetchQueue = useCallback(async () => {
    try {
      const { data } = await supabase.rpc('get_public_queue_status');
      if (data) {
        setQueue(data);
        const calling = data.find((q: any) => q.status === 'calling');

        // اكتشاف استدعاء جديد لمريض
        if (calling && calling.id !== lastAnnouncedIdRef.current) {
          lastAnnouncedIdRef.current = calling.id;

          // 1. الأولوية المطلقة لنداء المريض: إيقاف أي صوت إعلان طبيب يعمل فوراً
          mediaCache.stopAllAudio();
          setIsAudioPlaying(false);

          // 2. تشغيل نغمة ونداء المريض الصوتي
          if (soundEnabledRef.current) {
            playQueueAnnouncement(calling.token_number, calling.clinic_name || '', calling.clinic_audio_number);
          }

          // 3. إظهار كارت النداء الكبير المنسدل
          setDropNotice({
            token: calling.token_number,
            clinicName: calling.clinic_name || 'العيادة',
            doctorName: calling.doctor_name || '',
          });

          if (noticeTimer.current) clearTimeout(noticeTimer.current);
          const noticeDurationMs = (configRef.current.patientCallNoticeDurationSec || 8) * 1000;
          noticeTimer.current = setTimeout(() => {
            setDropNotice(null);
          }, noticeDurationMs);
        }
      }
    } catch (e) {
      console.warn('Error fetching queue status:', e);
    }
  }, []);

  // جلب بيانات الأطباء ومواعيدهم
  const fetchDoctorsAndPresence = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('doctors')
        .select(`
          profile_id,
          clinic_id,
          specialty,
          bio,
          working_days,
          is_present,
          presence_updated_at,
          profiles(first_name, last_name, avatar_url),
          clinics(id, name)
        `);

      if (data) {
        setRawDoctors(data);
        // مزامنة حالة التواجد التلقائية فور الجلب
        syncDoctorsPresenceWithDatabase(supabase, data);
      }
    } catch (e) {
      console.warn('Error fetching doctors:', e);
    }
  }, []);

  // جلب الوسائط العامة (فيديوهات وصور المركز)
  const fetchGeneralMedia = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('queue_media')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (data) {
        setGeneralMedia(data);
      }
    } catch (e) {
      console.warn('Error fetching general media:', e);
    }
  }, []);

  // اشتراكات Realtime والتحديث الدوري
  useEffect(() => {
    const t = setTimeout(() => {
      fetchQueue();
      fetchDoctorsAndPresence();
      fetchGeneralMedia();
    }, 0);

    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    const periodicSync = setInterval(() => {
      fetchQueue();
      fetchDoctorsAndPresence();
    }, 15000);

    // اشتراك لحظي في تغييرات الطابور
    const channelQueue = supabase
      .channel('queue_public_display_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_queue' }, fetchQueue)
      .subscribe();

    // اشتراك لحظي في جدول الوسائط العامة
    const channelMedia = supabase
      .channel('queue_media_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_media' }, fetchGeneralMedia)
      .subscribe();

    // اشتراك لحظي في جدول الأطباء
    const channelDoctors = supabase
      .channel('queue_doctors_presence_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, fetchDoctorsAndPresence)
      .subscribe();

    // استقبال نداءات السكرتارية المباشرة
    const channelAlerts = supabase
      .channel('secretary_call_alert')
      .on('broadcast', { event: 'call_secretary' }, (payload) => {
        const msg = payload.payload?.message || 'مطلوب السكرتارية فوراً';
        setSecretaryAlert(msg);
        if (secretaryAlertTimer.current) clearTimeout(secretaryAlertTimer.current);
        secretaryAlertTimer.current = setTimeout(() => {
          setSecretaryAlert(null);
        }, 9000);
      })
      .subscribe();

    return () => {
      clearTimeout(t);
      clearInterval(clockTimer);
      clearInterval(periodicSync);
      supabase.removeChannel(channelQueue);
      supabase.removeChannel(channelMedia);
      supabase.removeChannel(channelDoctors);
      supabase.removeChannel(channelAlerts);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      if (secretaryAlertTimer.current) clearTimeout(secretaryAlertTimer.current);
      if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      mediaCache.stopAllAudio();
    };
  }, [fetchQueue, fetchDoctorsAndPresence, fetchGeneralMedia]);

  // قائمة الأطباء المتواجدين حالياً
  const presentDoctorsList = useMemo(() => {
    return rawDoctors
      .map((doc) => {
        const presence = calculateDoctorPresence(doc);
        const meta = parseDoctorMediaMeta(doc.bio);
        const currentCallingInClinic = queue.find(
          (q) => q.clinic_id === doc.clinic_id && q.status === 'calling'
        );

        return {
          ...doc,
          calculatedPresence: presence,
          meta,
          doctorName: doc.profiles ? `${doc.profiles.first_name || ''} ${doc.profiles.last_name || ''}`.trim() : 'طبيب',
          clinicName: doc.clinics?.name || 'العيادة',
          photoUrl: meta.photo_url || doc.profiles?.avatar_url || '',
          audioUrl: meta.audio_url || '',
          adDurationSeconds: meta.ad_duration_seconds || DEFAULT_AD_DURATION,
          currentToken: currentCallingInClinic ? currentCallingInClinic.token_number : null,
        };
      })
      .filter((d) => d.calculatedPresence.isPresent);
  }, [rawDoctors, queue]);

  // تجهيز شرائح الميديا (إعلانات الأطباء المتواجدين + وسائط المركز)
  const mediaSlides: MediaSlideItem[] = useMemo(() => {
    const list: MediaSlideItem[] = [];

    // 1. إضافة إعلانات الأطباء المتواجدين
    presentDoctorsList.forEach((doc) => {
      list.push({
        type: 'doctor',
        doctorId: doc.profile_id,
        doctorName: doc.doctorName,
        clinicName: doc.clinicName,
        specialty: doc.specialty,
        photoUrl: doc.photoUrl,
        audioUrl: doc.audioUrl,
        durationSeconds: doc.adDurationSeconds || DEFAULT_AD_DURATION,
        currentToken: doc.currentToken,
      });
    });

    // 2. إضافة وسائط المركز العامة
    generalMedia.forEach((m) => {
      list.push({
        type: 'general',
        id: m.id,
        mediaType: m.media_type || 'image',
        url: m.url,
        durationSeconds: 15,
      });
    });

    return list;
  }, [presentDoctorsList, generalMedia]);

  // التحميل المسبق للوسائط لتشغيل فوري بدون أي تأخير
  useEffect(() => {
    mediaSlides.forEach((slide) => {
      if (slide.type === 'doctor') {
        if (slide.photoUrl) mediaCache.preloadImage(slide.photoUrl);
        if (slide.audioUrl) mediaCache.preloadAudio(slide.audioUrl);
      } else if (slide.type === 'general' && slide.mediaType === 'image') {
        if (slide.url) mediaCache.preloadImage(slide.url);
      }
    });
  }, [mediaSlides]);

  // إدارة تدوير شرائح الميديا وتشغيل المقطع الصوتي
  const currentSlide = mediaSlides[slideIndex] || mediaSlides[0] || null;

  const goToNextSlide = useCallback(() => {
    if (mediaSlides.length <= 1) {
      setSlideIndex(0);
      return;
    }
    setSlideIndex((prev) => (prev + 1) % mediaSlides.length);
  }, [mediaSlides.length]);

  useEffect(() => {
    if (!currentSlide || !config.showMedia) {
      mediaCache.stopAllAudio();
      const t = setTimeout(() => setIsAudioPlaying(false), 0);
      return () => clearTimeout(t);
    }

    // إيقاف أي صوت سابق
    mediaCache.stopAllAudio();
    const pauseT = setTimeout(() => setIsAudioPlaying(false), 0);

    // فحص إمكانية تشغيل الإعلان الصوتي لتواجد الطبيب وفقاً للمهلة الزمنية المحددة في الإعدادات
    const shouldPlayDoctorVoice = () => {
      if (dropNotice || muteDoctorAudioRef.current) return false;
      if (currentSlide.type !== 'doctor' || !currentSlide.audioUrl) return false;

      const intervalMinutes = config.doctorAudioIntervalMinutes;
      // إذا كان الصوت مكتوماً (-1)
      if (intervalMinutes === -1) return false;
      // إذا كان مضبوطاً على التشغيل مع كل دورة (0)
      if (intervalMinutes === 0) return true;

      const now = Date.now();
      const elapsedMinutes = (now - lastDoctorAudioRoundFinishedAtRef.current) / (60 * 1000);

      // هل توجد دورة إعلانات أطباء نشطة حالياً؟
      const isRoundActive = doctorsAnnouncedInActiveRoundRef.current.size > 0;

      if (!isRoundActive) {
        // لبدء دورة جديدة: إما أنها أول مرة من فتح الشاشة (0) أو انقضت الفترة المحددة بالدقائق
        if (lastDoctorAudioRoundFinishedAtRef.current !== 0 && elapsedMinutes < intervalMinutes) {
          return false; // ما زلنا في فترة الهدوء والراحة بين الإعلانات
        }
      }

      // إذا كان هذا الطبيب قد تم الإعلان عنه صوتياً بالفعل في هذه الدورة
      if (doctorsAnnouncedInActiveRoundRef.current.has(currentSlide.doctorId)) {
        return false;
      }

      return true;
    };

    if (shouldPlayDoctorVoice() && currentSlide.type === 'doctor' && currentSlide.audioUrl) {
      const res = mediaCache.playDoctorAudio(currentSlide.audioUrl, () => {
        setIsAudioPlaying(false);
      });
      if (res.isPlaying) {
        setIsAudioPlaying(true);
        // تسجيل أن هذا الطبيب تم الإعلان عنه في هذه الدورة
        doctorsAnnouncedInActiveRoundRef.current.add(currentSlide.doctorId);

        // فحص اكتمال الإعلان الصوتي لجميع الأطباء المتواجدين الذين لديهم مقاطع صوتية
        const doctorsWithAudio = presentDoctorsList.filter((d) => d.audioUrl);
        const allCompleted =
          doctorsWithAudio.length > 0 &&
          doctorsWithAudio.every((d) =>
            doctorsAnnouncedInActiveRoundRef.current.has(d.profile_id)
          );

        if (allCompleted || doctorsAnnouncedInActiveRoundRef.current.size >= doctorsWithAudio.length) {
          // اكتملت الدورة بالكامل! بدء مؤقت فترة الهدوء (5 أو 10 دقائق أو غيرها)
          lastDoctorAudioRoundFinishedAtRef.current = Date.now();
          doctorsAnnouncedInActiveRoundRef.current.clear();
        }
      }
    }

    // حساب المدة الزمنية للشريحة
    const totalDurationMs = Math.max(8, currentSlide.durationSeconds) * 1000;
    const intervalStepMs = 100;
    const stepIncrement = (intervalStepMs / totalDurationMs) * 100;

    const startProgressTimer = setTimeout(() => {
      setSlideProgress(0);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = setInterval(() => {
        setSlideProgress((prev) => {
          if (prev >= 100) return 100;
          return prev + stepIncrement;
        });
      }, intervalStepMs);
    }, 0);

    // مؤقت الانتقال للشريحة التالية
    if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
    slideTimerRef.current = setTimeout(() => {
      goToNextSlide();
    }, totalDurationMs);

    return () => {
      clearTimeout(startProgressTimer);
      clearTimeout(pauseT);
      if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [currentSlide, goToNextSlide, dropNotice, config.showMedia]);

  // إظهار وإخفاء شريط الإعدادات عند حركة الماوس
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (e.clientY < 90) {
        setShowBar(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
      } else if (!showSettingsModal) {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setShowBar(false), 2600);
      }
    },
    [showSettingsModal]
  );

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const currentCall = queue.find((q) => q.status === 'calling');
  const waitingList = queue
    .filter((q) => q.status === 'waiting')
    .slice(0, config.maxWaitingListItems || 12);

  // إعدادات الخطوط العربية المتاحة
  const fontFamilyCss = useMemo(() => {
    switch (config.fontFamily) {
      case 'cairo':
        return "'Cairo', sans-serif";
      case 'tajawal':
        return "'Tajawal', sans-serif";
      case 'almarai':
        return "'Almarai', sans-serif";
      case 'readex':
        return "'Readex Pro', sans-serif";
      case 'ibm_plex':
        return "'IBM Plex Sans Arabic', sans-serif";
      case 'system':
      default:
        return 'system-ui, -apple-system, sans-serif';
    }
  }, [config.fontFamily]);

  // هل القسم العلوي ظاهر؟
  const hasUpperSection = config.showMedia || config.showClinics;
  // هل القسم السفلي ظاهر؟
  const hasLowerSection = config.showCurrentCall || config.showWaitingList;
  // هل عمود الخدمات الجانبي (العيادات والنداء وقائمة الانتظار) ظاهر؟
  const hasSideStack = config.showClinics || config.showCurrentCall || config.showWaitingList;

  // كثافة الكروت
  const cardPaddingClass =
    config.cardDensity === 'compact'
      ? 'p-2 sm:p-2.5'
      : config.cardDensity === 'spacious'
      ? 'p-4 sm:p-5'
      : 'p-3 sm:p-3.5';

  // استدارة زوايا الكروت
  const cardRadiusClass =
    config.cardBorderRadius === 'none'
      ? 'rounded-none'
      : config.cardBorderRadius === 'small'
      ? 'rounded-lg'
      : config.cardBorderRadius === 'large'
      ? 'rounded-3xl'
      : config.cardBorderRadius === 'full'
      ? 'rounded-full'
      : 'rounded-2xl';

  // سمك حدود وإطار الكروت
  const cardBorderWidthClass =
    config.cardBorderWidth === 0
      ? 'border-0'
      : config.cardBorderWidth === 2
      ? 'border-2'
      : config.cardBorderWidth === 3
      ? 'border-[3px]'
      : 'border';

  // تأثير وميض وتوهج كارت النداء المباشر
  const callPulseClass =
    config.callingPulseEffect === 'none'
      ? ''
      : config.callingPulseEffect === 'gentle'
      ? 'animate-pulse'
      : config.callingPulseEffect === 'neon'
      ? 'animate-pulse shadow-[0_0_35px_rgba(255,255,255,0.35)]'
      : 'animate-pulse drop-shadow-xl';

  return (
    <div
      style={{
        backgroundColor: config.bgColor,
        color: config.textColor,
        fontFamily: fontFamilyCss,
        fontWeight: config.fontWeight === 'black' ? 900 : 700,
        zoom: config.zoom || 1,
      }}
      className="h-screen flex flex-col overflow-hidden relative select-none transition-colors duration-300"
      dir="rtl"
      onMouseMove={handleMouseMove}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&family=Cairo:wght@400;600;700;900&family=Tajawal:wght@400;500;700;900&family=Readex+Pro:wght@400;600;700&family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap');

        @keyframes drop-notice-fall {
          0% { transform: translateY(-130%); opacity: 0; }
          60% { transform: translateY(6%); opacity: 1; }
          80% { transform: translateY(-2%); }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes drop-notice-glow {
          0%, 100% { box-shadow: 0 0 50px 15px rgba(16, 185, 129, 0.9); }
          50% { box-shadow: 0 0 70px 25px rgba(5, 150, 105, 0.7); }
        }
        .patient-call-notice {
          animation: drop-notice-fall 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) both, drop-notice-glow 1.2s ease-in-out infinite;
        }
        @keyframes soundwave {
          0%, 100% { height: 6px; }
          50% { height: 26px; }
        }
        .soundwave-bar {
          animation: soundwave 1s ease-in-out infinite;
        }
      `}</style>

      {/* شريط الإعدادات العلوي — يظهر عند تحريك الماوس في أعلى الشاشة */}
      <div
        className={`fixed top-0 inset-x-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-slate-950/95 backdrop-blur-md py-2.5 px-4 border-b border-slate-800 shadow-2xl transition-transform duration-300 ${
          showBar ? 'translate-y-0' : '-translate-y-full'
        }`}
        onMouseEnter={() => {
          setShowBar(true);
          if (hideTimer.current) clearTimeout(hideTimer.current);
        }}
      >
        {/* أزرار العرض والإخفاء السريع للأقسام بدلاً من القائمة المنسدلة */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 ml-1">عرض الأقسام:</span>

          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, showMedia: !prev.showMedia }))}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              config.showMedia ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-800 text-slate-400 opacity-60'
            }`}
            title="إظهار/إخفاء الميديا"
          >
            {config.showMedia ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>الميديا</span>
          </button>

          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, showClinics: !prev.showClinics }))}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              config.showClinics ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-800 text-slate-400 opacity-60'
            }`}
            title="إظهار/إخفاء العيادات"
          >
            {config.showClinics ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>العيادات</span>
          </button>

          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, showWaitingList: !prev.showWaitingList }))}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              config.showWaitingList ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-800 text-slate-400 opacity-60'
            }`}
            title="إظهار/إخفاء قائمة الانتظار"
          >
            {config.showWaitingList ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>الانتظار</span>
          </button>

          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, showCurrentCall: !prev.showCurrentCall }))}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              config.showCurrentCall ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-800 text-slate-400 opacity-60'
            }`}
            title="إظهار/إخفاء النداء المباشر"
          >
            {config.showCurrentCall ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>النداء</span>
          </button>

          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, showNewsTicker: !prev.showNewsTicker }))}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              config.showNewsTicker ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-800 text-slate-400 opacity-60'
            }`}
            title="إظهار/إخفاء شريط الأخبار بالأسفل"
          >
            {config.showNewsTicker ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>شريط الأخبار</span>
          </button>
        </div>

        {/* أزرار التخصيص الكامل والحفظ والملء الشاشة */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* زر فتح نافذة التخصيص الشاملة */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
            <span>تخصيص كامل للشاشة (الألوان، المقاسات، الأماكن)</span>
          </button>

          {/* زر حفظ كإعداد افتراضي في قاعدة البيانات */}
          <button
            type="button"
            onClick={handleSaveConfigToDB}
            disabled={isSavingConfig}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="حفظ هذه الإعدادات كافتراضية لقاعدة البيانات"
          >
            {isSavingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isSavingConfig ? 'جاري الحفظ...' : 'حفظ كافتراضي'}</span>
          </button>

          {/* مؤشر نجاح الحفظ */}
          {saveSuccessBanner && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-lg border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تم الحفظ في قاعدة البيانات</span>
            </span>
          )}

          {/* تفعيل الصوت العام للشاشة */}
          <button
            type="button"
            onClick={enableSound}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              soundEnabled ? 'bg-emerald-600 text-white' : 'text-white bg-white/10 hover:bg-white/20'
            }`}
            title="تفعيل الإشعارات الصوتية لنداء المرضى"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{soundEnabled ? 'صوت مفعّل' : 'تفعيل الصوت'}</span>
          </button>

          {/* كتم / تشغيل صوت إعلانات الأطباء */}
          <button
            type="button"
            onClick={() => setMuteDoctorAudio((m) => !m)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              !muteDoctorAudio ? 'bg-blue-600/80 text-white' : 'text-slate-300 bg-white/10 hover:bg-white/20'
            }`}
            title="التحكم في تشغيل المقطع الصوتي المسجل للأطباء"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{!muteDoctorAudio ? 'صوت الأطباء' : 'صوت مكتوم'}</span>
          </button>

          {/* ملء الشاشة */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1 text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* المحتوى الرئيسي للشاشة */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* الشريط العلوي الثابت (الهيدر) */}
        {config.showHeader && (
          <header
            style={{
              backgroundColor: config.panelBgColor,
              borderColor: config.cardBorderColor,
              minHeight: `${config.headerHeightPx || 66}px`,
            }}
            className="px-6 sm:px-8 py-2.5 flex justify-between items-center shadow-lg border-b shrink-0 z-10"
          >
            <div className="flex items-center gap-3">
              <div
                style={{
                  backgroundColor: `${config.accentColor}20`,
                  color: config.accentColor,
                  borderColor: `${config.accentColor}40`,
                }}
                className="p-2 rounded-xl border"
              >
                <Monitor className="w-6 h-6" />
              </div>
              <div>
                <h1
                  className="font-black tracking-wide"
                  style={{
                    color: config.textColor,
                    fontSize: `${config.headerTitleFontSizePx || 20}px`,
                  }}
                >
                  {config.centerTitle || 'مركز الطائر الحر الطبي'}
                </h1>
                <p
                  className="font-semibold flex items-center gap-1"
                  style={{
                    color: config.accentColor,
                    fontSize: `${config.headerSubtitleFontSizePx || 11}px`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full animate-ping inline-block"
                    style={{ backgroundColor: config.accentColor }}
                  />
                  <span>{config.centerSubtitle || 'شاشة العرض والنداء الآلي المباشر'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-5">
              {/* تاريخ اليوم الهجري / الميلادي */}
              {config.showDate !== false && (
                <div
                  style={{ color: config.mutedTextColor }}
                  className="hidden md:flex items-center gap-1.5 text-xs font-bold border border-slate-700/60 px-3 py-1 rounded-full bg-slate-800/40"
                >
                  <Calendar className="w-3.5 h-3.5" style={{ color: config.accentColor }} />
                  <span>
                    {currentTime.toLocaleDateString('ar-EG', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}

              {/* مؤشر الصوت النشط */}
              {config.showAudioIndicator !== false && isAudioPlaying && (
                <div
                  style={{
                    backgroundColor: `${config.accentColor}15`,
                    color: config.accentColor,
                    borderColor: `${config.accentColor}40`,
                  }}
                  className="flex items-center gap-2 border px-3 py-1 rounded-full text-xs font-bold animate-pulse"
                >
                  <Volume2 className="w-4 h-4" />
                  <span className="hidden sm:inline">مقطع صوتي يعمل الآن</span>
                </div>
              )}

              {/* الساعة الحية */}
              {config.showClock !== false && (
                <div
                  className="text-xl sm:text-2xl font-black font-mono tracking-wider"
                  dir="ltr"
                  style={{ color: config.accentColor }}
                >
                  {currentTime.toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: config.clockFormat !== '24h',
                  })}
                </div>
              )}
            </div>
          </header>
        )}

        {/* جسم الشاشة (وفق نمط التخطيط والترتيب المختار) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {config.screenLayoutMode === 'split_columns' ? (
            /* النمط السينمائي المتجاوب: ميديا بعرض 70% بجانب العيادات والنداء وقائمة الانتظار */
            renderSplitColumnsLayout()
          ) : config.verticalOrder === 'queue_top_media_bottom' ? (
            <>
              {/* القسم السفلي أصبح بالأعلى */}
              {hasLowerSection && renderLowerSection()}
              {/* القسم العلوي أصبح بالأسفل */}
              {hasUpperSection && renderUpperSection()}
            </>
          ) : (
            <>
              {/* الترتيب القياسي: الميديا والعيادات بالأعلى، النداء والانتظار بالأسفل */}
              {hasUpperSection && renderUpperSection()}
              {hasLowerSection && renderLowerSection()}
            </>
          )}
        </div>

        {/* شريط الأخبار المتحرك بالأسفل (جديد) */}
        <QueueNewsTicker config={config} />
      </div>

      {/* كارت النداء الكبير المنسدل من الأعلى عند استدعاء مريض (أولوية مطلقة) */}
      {dropNotice && (
        <div className="fixed inset-x-0 top-0 z-[60] flex justify-center pointer-events-none p-4">
          <div className="patient-call-notice mt-16 sm:mt-20 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 text-white text-center rounded-3xl px-8 sm:px-14 py-6 sm:py-8 shadow-2xl border-4 border-white/40 max-w-2xl w-full">
            <span className="inline-block bg-white text-emerald-900 text-xs sm:text-sm font-black px-4 py-1 rounded-full mb-3 shadow-md uppercase tracking-wider">
              نداء مريض جديد
            </span>
            <p className="text-2xl sm:text-3xl font-black mb-2">على العميل رقم</p>
            <div className="text-7xl sm:text-8xl font-black font-mono tracking-widest my-2 text-amber-300 drop-shadow-lg">
              {dropNotice.token}
            </div>
            <p className="text-2xl sm:text-3xl font-black mt-2">
              التوجه فوراً إلى {dropNotice.clinicName}
            </p>
            {dropNotice.doctorName && (
              <p className="text-base text-emerald-100 font-bold mt-1">{dropNotice.doctorName}</p>
            )}
          </div>
        </div>
      )}

      {/* نداء السكرتارية من الطبيب */}
      {secretaryAlert && (
        <div className="fixed inset-x-0 top-0 z-[60] flex justify-center pointer-events-none p-4">
          <div className="mt-44 bg-amber-600 text-white text-center rounded-2xl px-8 py-4 shadow-2xl border-2 border-white/40 flex items-center justify-center gap-3 animate-bounce">
            <span className="text-2xl">🔔</span>
            <p className="text-xl font-black">{secretaryAlert}</p>
          </div>
        </div>
      )}

      {/* زر تفعيل الصوت إذا لم يكن مفعلاً */}
      {!soundEnabled && (
        <button
          type="button"
          onClick={enableSound}
          className="fixed bottom-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black px-7 py-3 rounded-full shadow-2xl border border-white/20 animate-pulse cursor-pointer transition-all hover:scale-105 text-sm"
        >
          <VolumeX className="w-5 h-5 text-amber-300" />
          <span>اضغط هنا لتفعيل الصوت على شاشة النداء</span>
        </button>
      )}

      {/* مودال التحكم الشامل وتخصيص المقاسات والألوان والخطوط والأماكن */}
      <QueueLayoutSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        config={config}
        onChange={setConfig}
        onSaveToDB={handleSaveConfigToDB}
        onResetToDefaults={handleResetToDefaults}
        isSaving={isSavingConfig}
        saveSuccess={saveSuccessBanner}
      />
    </div>
  );

  // دالة بناء وتنسيق القسم العلوي (الميديا والعيادات)
  function renderUpperSection() {
    const bothActive = config.showMedia && config.showClinics;
    const mediaWidth = bothActive ? `${config.mediaWidthPct}%` : config.showMedia ? '100%' : '0%';
    const clinicsWidth = bothActive ? `${100 - config.mediaWidthPct}%` : config.showClinics ? '100%' : '0%';

    const heightPct = hasLowerSection ? `${100 - config.bottomHeightPct}%` : '100%';

    const mediaElement = config.showMedia && (
      <div
        style={{ width: mediaWidth }}
        className="relative bg-black flex flex-col items-center justify-center overflow-hidden border-slate-800"
      >
        {mediaSlides.length === 0 ? (
          <div className="text-slate-600 flex flex-col items-center gap-3 p-8 text-center">
            <ImageIcon className="w-16 h-16 text-slate-700" />
            <p className="text-lg font-bold text-slate-500">لا توجد وسائط مضافة حالياً</p>
            <p className="text-xs text-slate-600">
              يمكنك إضافة صور ومقاطع صوتية للأطباء من صفحة &quot;وسائط شاشة النداء&quot;
            </p>
          </div>
        ) : currentSlide?.type === 'doctor' ? (
          /* كارت إعلان الطبيب المتواجد (صورة + مقطع صوتي + معلومات الطبيب) */
          <div className="w-full h-full relative flex flex-col items-center justify-between p-6 sm:p-8 bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white overflow-hidden animate-in fade-in duration-500">
            {/* شارة إعلان الطبيب المتواجد */}
            <div className="w-full flex items-center justify-between z-10 shrink-0">
              <div
                style={{
                  backgroundColor: `${config.accentColor}25`,
                  color: config.accentColor,
                  borderColor: `${config.accentColor}40`,
                }}
                className="flex items-center gap-2 border px-4 py-1.5 rounded-full text-xs font-black shadow-lg"
              >
                <Stethoscope className="w-4 h-4" />
                <span>طبيب متواجد بالمركز حالياً</span>
              </div>

              {/* موجات الصوت التفاعلية إذا كان المقطع الصوتي يعمل */}
              {isAudioPlaying && (
                <div className="flex items-center gap-1.5 bg-slate-900/80 border border-emerald-500/30 px-3.5 py-1.5 rounded-full">
                  <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <div className="flex items-center gap-1 h-5">
                    <span className="soundwave-bar w-1 bg-emerald-400 rounded-full" style={{ animationDelay: '0.1s' }} />
                    <span className="soundwave-bar w-1 bg-emerald-400 rounded-full" style={{ animationDelay: '0.3s' }} />
                    <span className="soundwave-bar w-1 bg-emerald-400 rounded-full" style={{ animationDelay: '0.2s' }} />
                    <span className="soundwave-bar w-1 bg-emerald-400 rounded-full" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span className="text-[11px] text-emerald-300 font-bold mr-1">صوت الإعلان</span>
                </div>
              )}
            </div>

            {/* صورة الطبيب والمعلومات في المنتصف */}
            <div
              className={`flex ${
                config.doctorCardLayout === 'stacked'
                  ? 'flex-col items-center text-center'
                  : 'flex-col md:flex-row items-center justify-center'
              } gap-6 sm:gap-10 my-auto z-10 w-full max-w-4xl`}
            >
              {/* برواز صورة الطبيب بالمقاس المكبر والقابل للتحكم */}
              <div
                style={{
                  width: `${config.doctorPhotoSizePx || 280}px`,
                  height: `${config.doctorPhotoSizePx || 280}px`,
                  maxWidth: '85vw',
                  maxHeight: '48vh',
                }}
                className="relative shrink-0 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300"
              >
                <div
                  style={{
                    background: `linear-gradient(135deg, ${config.accentColor}, #0284c7)`,
                  }}
                  className="absolute -inset-2 rounded-3xl blur-md opacity-40 animate-pulse"
                />
                {currentSlide.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentSlide.photoUrl}
                    alt={currentSlide.doctorName}
                    className="relative w-full h-full rounded-3xl object-cover border-4 shadow-2xl transition-all duration-300"
                    style={{ borderColor: `${config.accentColor}90` }}
                  />
                ) : (
                  <div className="relative w-full h-full rounded-3xl bg-slate-800 border-4 border-slate-700 flex flex-col items-center justify-center text-slate-500 shadow-2xl">
                    <Stethoscope className="w-20 h-20 text-emerald-400 mb-3" />
                    <span className="text-sm font-bold">صورة الطبيب</span>
                  </div>
                )}
              </div>

              {/* بيانات الطبيب والعيادة */}
              <div className="flex flex-col text-center md:text-right space-y-3">
                <div>
                  <span className="text-xs uppercase tracking-wider font-bold block mb-1" style={{ color: config.accentColor }}>
                    استشاري معتمد
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
                    {currentSlide.doctorName}
                  </h2>
                </div>

                <div className="inline-flex items-center justify-center md:justify-start gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                  <Building className="w-4 h-4 shrink-0" style={{ color: config.accentColor }} />
                  <span className="text-base font-bold text-white">
                    {currentSlide.clinicName}
                  </span>
                </div>

                {currentSlide.specialty && (
                  <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
                    {currentSlide.specialty}
                  </p>
                )}

                {/* الدور الحالي للطبيب */}
                {currentSlide.currentToken !== null && (
                  <div className="pt-2 flex items-center justify-center md:justify-start gap-2">
                    <span className="text-xs text-slate-400 font-semibold">الدور الحالي بالعيادة:</span>
                    <span
                      style={{
                        backgroundColor: `${config.accentColor}20`,
                        color: config.accentColor,
                        borderColor: `${config.accentColor}50`,
                      }}
                      className="text-xl font-black font-mono border px-3 py-0.5 rounded-lg"
                    >
                      #{currentSlide.currentToken}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* شريط التقدم السفلي للإعلان */}
            <div className="w-full z-10 space-y-1.5 shrink-0">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>إعلان الطبيب ({currentSlide.durationSeconds} ثانية)</span>
                <span>
                  {slideIndex + 1} من {mediaSlides.length}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-100 ease-linear rounded-full"
                  style={{
                    width: `${slideProgress}%`,
                    backgroundColor: config.accentColor,
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* شريحة الوسائط العامة (فيديو أو صورة) */
          <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
            {currentSlide?.mediaType === 'video' ? (
              <video
                key={currentSlide.id}
                src={currentSlide.url}
                autoPlay
                muted
                loop
                className="w-full h-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={currentSlide?.id}
                src={currentSlide?.url}
                alt=""
                className="w-full h-full object-contain"
              />
            )}

            {/* شريط التقدم السفلي للوسائط العامة */}
            <div className="absolute bottom-3 inset-x-6 z-10">
              <div className="w-full h-1.5 bg-slate-800/80 backdrop-blur-xs rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-100 ease-linear rounded-full"
                  style={{
                    width: `${slideProgress}%`,
                    backgroundColor: config.accentColor,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );

    const clinicsElement = config.showClinics && (
      <div
        style={{
          width: clinicsWidth,
          backgroundColor: config.bgColor,
        }}
        className="flex flex-col overflow-hidden p-4 sm:p-5"
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: config.mutedTextColor }}>
            <Stethoscope className="w-4 h-4" style={{ color: config.accentColor }} />
            <span>الأطباء المتواجدون بالمركز ({presentDoctorsList.length})</span>
          </h3>
          <span
            style={{
              backgroundColor: `${config.accentColor}15`,
              color: config.accentColor,
              borderColor: `${config.accentColor}30`,
            }}
            className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border"
          >
            تحديث تلقائي حي
          </span>
        </div>

        {presentDoctorsList.length === 0 ? (
          <div
            className="flex-1 flex flex-col items-center justify-center text-sm p-6 text-center"
            style={{ color: config.mutedTextColor }}
          >
            <Stethoscope className="w-12 h-12 mb-2 opacity-30" />
            <p className="font-bold">لا يوجد أطباء متواجدون حالياً</p>
            <p className="text-xs mt-1">يتم التواجد تلقائياً عند حلول فترات العمل المحددة</p>
          </div>
        ) : (
          <div
            className={`flex-1 grid gap-3 overflow-y-auto content-start pr-1 ${
              config.clinicsGridColumns === 1
                ? 'grid-cols-1'
                : config.clinicsGridColumns === 3
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2'
            }`}
          >
            {presentDoctorsList.map((doc) => {
              const isCurrentInSlide =
                currentSlide?.type === 'doctor' && currentSlide.doctorId === doc.profile_id;

              return (
                <div
                  key={doc.profile_id}
                  style={{
                    backgroundColor: config.cardBgColor,
                    borderColor: isCurrentInSlide ? config.accentColor : config.cardBorderColor,
                    boxShadow: isCurrentInSlide ? `0 0 15px ${config.accentColor}30` : undefined,
                  }}
                  className={`border rounded-2xl ${cardPaddingClass} flex items-center gap-3 transition-all duration-300`}
                >
                  {/* صورة الطبيب الصغيرة */}
                  {doc.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={doc.photoUrl}
                      alt={doc.doctorName}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border"
                      style={{ borderColor: config.cardBorderColor }}
                    />
                  ) : (
                    <div
                      style={{
                        backgroundColor: `${config.accentColor}15`,
                        color: config.accentColor,
                        borderColor: `${config.accentColor}30`,
                      }}
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                    >
                      <Stethoscope className="w-6 h-6" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4
                        className="font-bold truncate"
                        style={{ color: config.textColor, fontSize: `${config.clinicsFontSizePx || 14}px` }}
                      >
                        {doc.doctorName}
                      </h4>
                      {isCurrentInSlide && (
                        <span
                          style={{
                            backgroundColor: config.accentColor,
                            color: '#000000',
                          }}
                          className="text-[10px] font-black px-1.5 py-0.2 rounded-md"
                        >
                          معروض
                        </span>
                      )}
                    </div>
                    <p className="text-xs truncate mt-0.5" style={{ color: config.mutedTextColor }}>
                      {doc.clinicName}
                    </p>
                  </div>

                  {/* الدور الحالي */}
                  <div className="text-left shrink-0 font-mono">
                    <span className="text-[10px] block" style={{ color: config.mutedTextColor }}>
                      الدور
                    </span>
                    <span
                      style={{
                        color: doc.currentToken ? config.accentColor : config.mutedTextColor,
                      }}
                      className="text-xl font-black"
                    >
                      {doc.currentToken ?? '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );

    return (
      <div
        className="flex flex-1 overflow-hidden border-b"
        style={{
          height: heightPct,
          borderColor: config.cardBorderColor,
        }}
      >
        {/* الترتيب الأفقي للميديا والعيادات */}
        {config.mediaPosition === 'left' ? (
          <>
            {clinicsElement}
            {mediaElement}
          </>
        ) : (
          <>
            {mediaElement}
            {clinicsElement}
          </>
        )}
      </div>
    );
  }

  // دالة بناء وتنسيق القسم السفلي (النداء الحالي وقائمة الانتظار)
  function renderLowerSection() {
    const heightPct = hasUpperSection ? `${config.bottomHeightPct}%` : '100%';
    const bothLower = config.showCurrentCall && config.showWaitingList;

    const currentCallElement = config.showCurrentCall && (
      <div
        style={{
          width: bothLower ? (config.bottomOrder === 'call_center' ? '100%' : '52%') : '100%',
          background: config.callingCardBg,
        }}
        className="text-white flex flex-col items-center justify-center p-4 relative overflow-hidden shadow-inner shrink-0"
      >
        {currentCall ? (
          <div className="text-center z-10 w-full animate-in zoom-in-95 duration-300">
            <div className="inline-flex items-center gap-2 bg-black/40 text-white px-5 py-1 rounded-full text-xs sm:text-sm font-black mb-2 shadow-lg animate-pulse border border-white/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>النداء الحالي المباشر</span>
            </div>

            <div
              style={{
                fontSize: `${config.tokenFontSize}px`,
                color: config.callingTokenColor,
              }}
              className="font-black mb-1 font-mono tracking-wider drop-shadow-md leading-none"
            >
              {currentCall.token_number}
            </div>

            <div className="text-sm sm:text-base text-white/90 flex items-center justify-center gap-2 flex-wrap font-medium mt-1">
              <span>تفضل بالدخول إلى:</span>
              <span className="text-white font-black bg-black/50 px-3.5 py-1 rounded-xl border border-white/20 text-base sm:text-lg">
                {currentCall.clinic_name || 'العيادة'}
                {currentCall.doctor_name ? ` (${currentCall.doctor_name})` : ''}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center text-sm flex flex-col items-center text-white/80">
            <Monitor className="w-12 h-12 mb-2 text-white/60" />
            <p className="font-bold text-base">في انتظار طلب الدور القادم...</p>
            <p className="text-xs text-white/70 mt-1">يتم الإعلان فور استدعاء الطبيب أو السكرتارية</p>
          </div>
        )}
      </div>
    );

    const waitingListElement = config.showWaitingList && (
      <div
        style={{
          width: bothLower ? (config.bottomOrder === 'call_center' ? '100%' : '48%') : '100%',
          backgroundColor: config.panelBgColor,
          borderColor: config.cardBorderColor,
        }}
        className="p-3 sm:p-4 overflow-y-auto border-l shrink-0"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs sm:text-sm font-bold flex items-center gap-2" style={{ color: config.mutedTextColor }}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
            </span>
            <span>قائمة الانتظار القادمة ({waitingList.length})</span>
          </h3>
        </div>

        <div
          className={`grid gap-2 ${
            config.waitingListColumns === 1
              ? 'grid-cols-1'
              : config.waitingListColumns === 3
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2'
          }`}
        >
          {waitingList.map((q, idx) => (
            <div
              key={q.id}
              style={{
                backgroundColor: config.cardBgColor,
                borderColor: config.cardBorderColor,
              }}
              className={`border ${cardPaddingClass} rounded-xl flex justify-between items-center text-xs shadow-2xs`}
            >
              <div className="truncate flex-1 min-w-0 pr-1">
                <span className="font-bold block truncate" style={{ color: config.textColor }}>
                  {idx + 1}. {q.clinic_name || 'العيادة'}
                </span>
                {q.doctor_name && (
                  <span className="text-[10px] truncate block" style={{ color: config.mutedTextColor }}>
                    {q.doctor_name}
                  </span>
                )}
              </div>
              <span className="font-black text-orange-400 font-mono text-base shrink-0">
                #{q.token_number}
              </span>
            </div>
          ))}
          {waitingList.length === 0 && (
            <div
              className="col-span-2 text-xs py-4 text-center"
              style={{ color: config.mutedTextColor }}
            >
              لا يوجد مرضى في طابور الانتظار حالياً
            </div>
          )}
        </div>
      </div>
    );

    return (
      <div
        className="flex overflow-hidden shrink-0"
        style={{
          height: heightPct,
          borderTop: `1px solid ${config.cardBorderColor}`,
        }}
      >
        {/* ترتيب كارت النداء وقائمة الانتظار */}
        {config.bottomOrder === 'call_left_queue_right' ? (
          <>
            {waitingListElement}
            {currentCallElement}
          </>
        ) : config.bottomOrder === 'call_center' ? (
          <div className="w-full flex flex-col md:flex-row h-full">
            {currentCallElement}
            {waitingListElement}
          </div>
        ) : (
          <>
            {currentCallElement}
            {waitingListElement}
          </>
        )}
      </div>
    );
  }

  // دالة بناء التخطيط السينمائي: ميديا 70% على اليسار + العيادات والنداء وقائمة الانتظار فوق بعض على اليمين
  function renderSplitColumnsLayout() {
    const bothActive = config.showMedia && hasSideStack;
    const mediaWidth = bothActive ? `${config.mediaWidthPct}%` : config.showMedia ? '100%' : '0%';
    const stackWidth = bothActive ? `${100 - config.mediaWidthPct}%` : hasSideStack ? '100%' : '0%';

    // 1. عمود الميديا لوحدها (بعرض 70% وبارتفاع كامل)
    const mediaColumn = config.showMedia && (
      <div
        style={{ width: mediaWidth }}
        className="relative bg-black flex flex-col items-center justify-center overflow-hidden h-full shrink-0 border-slate-800"
      >
        {mediaSlides.length === 0 ? (
          <div className="text-slate-600 flex flex-col items-center gap-3 p-8 text-center">
            <ImageIcon className="w-16 h-16 text-slate-700" />
            <p className="text-lg font-bold text-slate-500">لا توجد وسائط مضافة حالياً</p>
            <p className="text-xs text-slate-600">
              يمكنك إضافة صور ومقاطع صوتية للأطباء من صفحة &quot;وسائط شاشة النداء&quot;
            </p>
          </div>
        ) : currentSlide?.type === 'doctor' ? (
          /* كارت إعلان الطبيب المتواجد (صورة مكبرة + مقطع صوتي + معلومات الطبيب) */
          <div className="w-full h-full relative flex flex-col items-center justify-between p-6 sm:p-8 bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white overflow-hidden animate-in fade-in duration-500">
            {/* شارة إعلان الطبيب المتواجد */}
            <div className="w-full flex items-center justify-between z-10 shrink-0">
              <div
                style={{
                  backgroundColor: `${config.accentColor}25`,
                  color: config.accentColor,
                  borderColor: `${config.accentColor}40`,
                }}
                className="flex items-center gap-2 border px-4 py-1.5 rounded-full text-xs font-black shadow-lg"
              >
                <Stethoscope className="w-4 h-4" />
                <span>طبيب متواجد بالمركز حالياً</span>
              </div>

              {/* موجات الصوت التفاعلية إذا كان المقطع الصوتي يعمل */}
              {isAudioPlaying && (
                <div className="flex items-center gap-1.5 bg-slate-900/80 border border-emerald-500/30 px-3.5 py-1.5 rounded-full">
                  <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <div className="flex items-center gap-1 h-5">
                    <span className="soundwave-bar w-1 bg-emerald-400 rounded-full" style={{ animationDelay: '0.1s' }} />
                    <span className="soundwave-bar w-1 bg-emerald-400 rounded-full" style={{ animationDelay: '0.3s' }} />
                    <span className="soundwave-bar w-1 bg-emerald-400 rounded-full" style={{ animationDelay: '0.2s' }} />
                    <span className="soundwave-bar w-1 bg-emerald-400 rounded-full" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span className="text-[11px] text-emerald-300 font-bold mr-1">صوت الإعلان</span>
                </div>
              )}
            </div>

            {/* صورة الطبيب والمعلومات في المنتصف بالمقاس المكبر */}
            <div
              className={`flex ${
                config.doctorCardLayout === 'stacked'
                  ? 'flex-col items-center text-center'
                  : 'flex-col md:flex-row items-center justify-center'
              } gap-6 sm:gap-10 my-auto z-10 w-full max-w-4xl`}
            >
              {/* برواز صورة الطبيب بالمقاس المكبر */}
              <div
                style={{
                  width: `${config.doctorPhotoSizePx || 280}px`,
                  height: `${config.doctorPhotoSizePx || 280}px`,
                  maxWidth: '85vw',
                  maxHeight: '48vh',
                }}
                className="relative shrink-0 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300"
              >
                <div
                  style={{
                    background: `linear-gradient(135deg, ${config.accentColor}, #0284c7)`,
                  }}
                  className="absolute -inset-2 rounded-3xl blur-md opacity-40 animate-pulse"
                />
                {currentSlide.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentSlide.photoUrl}
                    alt={currentSlide.doctorName}
                    className="relative w-full h-full rounded-3xl object-cover border-4 shadow-2xl transition-all duration-300"
                    style={{ borderColor: `${config.accentColor}90` }}
                  />
                ) : (
                  <div className="relative w-full h-full rounded-3xl bg-slate-800 border-4 border-slate-700 flex flex-col items-center justify-center text-slate-500 shadow-2xl">
                    <Stethoscope className="w-20 h-20 text-emerald-400 mb-3" />
                    <span className="text-sm font-bold">صورة الطبيب</span>
                  </div>
                )}
              </div>

              {/* بيانات الطبيب والعيادة */}
              <div className="flex flex-col text-center md:text-right space-y-3">
                <div>
                  <span className="text-xs uppercase tracking-wider font-bold block mb-1" style={{ color: config.accentColor }}>
                    {currentSlide.specialty || 'تخصص عام'}
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-black text-white tracking-wide">
                    {currentSlide.doctorName}
                  </h2>
                </div>

                <div className="inline-flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 px-4 py-2 rounded-2xl w-fit mx-auto md:mr-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-sm sm:text-base font-bold text-slate-200">
                    {currentSlide.clinicName}
                  </span>
                </div>

                {currentSlide.currentToken && (
                  <div className="pt-2 flex items-center justify-center md:justify-start gap-2">
                    <span className="text-xs text-slate-400">رقم الكشف الحالي بالعيادة:</span>
                    <span
                      style={{
                        backgroundColor: `${config.accentColor}25`,
                        color: config.accentColor,
                        borderColor: `${config.accentColor}50`,
                      }}
                      className="text-xl font-black font-mono border px-3 py-0.5 rounded-lg"
                    >
                      #{currentSlide.currentToken}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* شريط التقدم السفلي للإعلان */}
            <div className="w-full z-10 space-y-1.5 shrink-0">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>إعلان الطبيب ({currentSlide.durationSeconds} ثانية)</span>
                <span>
                  {slideIndex + 1} من {mediaSlides.length}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-100 ease-linear rounded-full"
                  style={{
                    width: `${slideProgress}%`,
                    backgroundColor: config.accentColor,
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* شريحة الوسائط العامة (فيديو أو صورة) */
          <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
            {currentSlide?.mediaType === 'video' ? (
              <video
                key={currentSlide.id}
                src={currentSlide.url}
                autoPlay
                muted
                loop
                className="w-full h-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={currentSlide?.id}
                src={currentSlide?.url}
                alt=""
                className="w-full h-full object-contain"
              />
            )}

            {/* شريط التقدم السفلي للوسائط العامة */}
            <div className="absolute bottom-3 inset-x-6 z-10">
              <div className="w-full h-1.5 bg-slate-800/80 backdrop-blur-xs rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-100 ease-linear rounded-full"
                  style={{
                    width: `${slideProgress}%`,
                    backgroundColor: config.accentColor,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );

    // عناصر العمود الجانبي المكونة لهيكل الشاشة
    // 1) كارت النداء المباشر الحالي
    const sideStackCallElement = config.showCurrentCall && (
      <div
        style={{
          background: config.callingCardBg,
        }}
        className={`text-white flex flex-col items-center justify-center p-3.5 sm:p-4 relative overflow-hidden shadow-md shrink-0 border-b border-black/30 min-h-[140px] ${callPulseClass}`}
      >
        {currentCall ? (
          <div className="text-center z-10 w-full animate-in zoom-in-95 duration-300">
            <div className="inline-flex items-center gap-1.5 bg-black/40 text-white px-3.5 py-0.5 rounded-full text-xs font-black mb-1.5 shadow-md animate-pulse border border-white/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>النداء الحالي المباشر</span>
            </div>

            <div
              style={{
                fontSize: `${Math.min(config.tokenFontSize || 76, 120)}px`,
                color: config.callingTokenColor,
              }}
              className="font-black mb-0.5 font-mono tracking-wider drop-shadow-md leading-none"
            >
              {formatQueueNumber(currentCall.token_number, config.numberFormat)}
            </div>

            <div className="text-xs sm:text-sm text-white/90 flex flex-col items-center justify-center gap-0.5 font-medium mt-1">
              <span className="text-white/80 text-[11px]">تفضل بالدخول إلى:</span>
              <span
                style={{ fontSize: `${config.callingDetailsFontSizePx || 14}px` }}
                className="text-white font-black bg-black/50 px-3 py-1 rounded-xl border border-white/20 truncate max-w-full"
              >
                {currentCall.clinic_name || 'العيادة'}
                {currentCall.doctor_name ? ` (${currentCall.doctor_name})` : ''}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center text-xs flex flex-col items-center text-white/80 py-2">
            <Monitor className="w-7 h-7 mb-1 text-white/60" />
            <p className="font-bold text-xs sm:text-sm">في انتظار طلب الدور القادم...</p>
            <p className="text-[10px] text-white/70 mt-0.5">يتم الإعلان فور استدعاء الطبيب أو السكرتارية</p>
          </div>
        )}
      </div>
    );

    // 2) شبكة الأطباء والعيادات المتواجدين
    const sideStackClinicsElement = config.showClinics && (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-3 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h3 className="text-xs sm:text-sm font-bold flex items-center gap-1.5" style={{ color: config.mutedTextColor }}>
            <Stethoscope className="w-4 h-4" style={{ color: config.accentColor }} />
            <span>العيادات المتواجدة ({presentDoctorsList.length})</span>
          </h3>
          <span
            style={{
              backgroundColor: `${config.accentColor}15`,
              color: config.accentColor,
              borderColor: `${config.accentColor}30`,
            }}
            className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
          >
            تحديث حي
          </span>
        </div>

        {presentDoctorsList.length === 0 ? (
          <div
            className="flex-1 flex flex-col items-center justify-center text-xs p-4 text-center"
            style={{ color: config.mutedTextColor }}
          >
            <Stethoscope className="w-8 h-8 mb-1 opacity-30" />
            <p className="font-bold">لا يوجد أطباء متواجدون حالياً</p>
          </div>
        ) : (
          <div
            className={`flex-1 overflow-y-auto ${
              config.clinicsGridColumns === 2
                ? 'grid grid-cols-2 gap-2'
                : config.clinicsGridColumns === 3
                ? 'grid grid-cols-3 gap-2'
                : 'space-y-2'
            } pr-0.5`}
          >
            {presentDoctorsList.map((doc) => {
              const isCurrentInSlide =
                currentSlide?.type === 'doctor' && currentSlide.doctorId === doc.profile_id;
              const photoSize = config.doctorCardPhotoSizePx || 44;

              return (
                <div
                  key={doc.profile_id}
                  style={{
                    backgroundColor: config.cardBgColor,
                    borderColor: isCurrentInSlide ? config.accentColor : config.cardBorderColor,
                    boxShadow: isCurrentInSlide ? `0 0 15px ${config.accentColor}30` : undefined,
                  }}
                  className={`${cardBorderWidthClass} ${cardRadiusClass} ${cardPaddingClass} flex items-center gap-2.5 transition-all duration-300`}
                >
                  {doc.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={doc.photoUrl}
                      alt={doc.doctorName}
                      style={{
                        width: `${photoSize}px`,
                        height: `${photoSize}px`,
                        borderColor: config.cardBorderColor,
                      }}
                      className="rounded-lg object-cover shrink-0 border"
                    />
                  ) : (
                    <div
                      style={{
                        width: `${photoSize}px`,
                        height: `${photoSize}px`,
                        backgroundColor: `${config.accentColor}15`,
                        color: config.accentColor,
                        borderColor: `${config.accentColor}30`,
                      }}
                      className="rounded-lg flex items-center justify-center shrink-0 border"
                    >
                      <Stethoscope className="w-5 h-5" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <h4
                        className="font-bold truncate text-xs sm:text-sm"
                        style={{
                          color: config.textColor,
                          fontSize: config.clinicsFontSizePx ? `${config.clinicsFontSizePx}px` : undefined,
                        }}
                      >
                        {doc.doctorName}
                      </h4>
                      {isCurrentInSlide && (
                        <span
                          className="w-1.5 h-1.5 rounded-full animate-ping shrink-0"
                          style={{ backgroundColor: config.accentColor }}
                        />
                      )}
                    </div>
                    <p className="text-[11px] truncate" style={{ color: config.mutedTextColor }}>
                      {doc.clinicName}
                    </p>
                  </div>

                  {doc.currentToken && (
                    <div
                      style={{
                        backgroundColor: `${config.accentColor}20`,
                        color: config.accentColor,
                        borderColor: `${config.accentColor}40`,
                      }}
                      className="text-xs font-black font-mono border px-2 py-0.5 rounded-lg shrink-0"
                      title="رقم المريض الحالي"
                    >
                      #{formatQueueNumber(doc.currentToken, config.numberFormat)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );

    // 3) قائمة الانتظار القادمة
    const sideStackWaitingListElement = config.showWaitingList && (
      <div
        style={{
          backgroundColor: config.panelBgColor,
          borderColor: config.cardBorderColor,
        }}
        className="p-3 overflow-y-auto shrink-0 max-h-[35%] min-h-[120px] flex flex-col"
      >
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h3 className="text-xs sm:text-sm font-bold flex items-center gap-2" style={{ color: config.mutedTextColor }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
            </span>
            <span>قائمة الانتظار ({waitingList.length})</span>
          </h3>
        </div>

        {waitingList.length === 0 ? (
          <div
            className="flex-1 flex flex-col items-center justify-center text-xs p-2 text-center"
            style={{ color: config.mutedTextColor }}
          >
            <p className="text-slate-500">لا يوجد مرضى في الانتظار حالياً</p>
          </div>
        ) : (
          <div
            className={`grid ${
              config.waitingListColumns === 1
                ? 'grid-cols-1'
                : config.waitingListColumns === 3
                ? 'grid-cols-3'
                : 'grid-cols-2'
            } gap-1.5 overflow-y-auto pr-0.5`}
          >
            {waitingList.map((q, idx) => (
              <div
                key={q.id}
                style={{
                  backgroundColor: config.cardBgColor,
                  borderColor: config.cardBorderColor,
                }}
                className={`${cardBorderWidthClass} ${cardRadiusClass} ${cardPaddingClass} flex justify-between items-center text-xs shadow-2xs`}
              >
                <div className="truncate flex-1 min-w-0 pr-1">
                  <span
                    className="font-bold block truncate"
                    style={{
                      color: config.textColor,
                      fontSize: config.waitingListFontSizePx ? `${config.waitingListFontSizePx}px` : '11px',
                    }}
                  >
                    {idx + 1}. {q.clinic_name || 'العيادة'}
                  </span>
                </div>
                <span
                  style={{
                    backgroundColor: `${config.accentColor}20`,
                    color: config.accentColor,
                    borderColor: `${config.accentColor}40`,
                  }}
                  className="font-mono font-black border px-2 py-0.5 rounded-lg text-xs shrink-0"
                >
                  #{formatQueueNumber(q.token_number, config.numberFormat)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    // 2. عمود الخدمات والأطباء والنداء والانتظار فوق بعض
    const sideStackColumn = hasSideStack && (
      <div
        style={{
          width: stackWidth,
          backgroundColor: config.bgColor,
          borderColor: config.cardBorderColor,
        }}
        className="h-full flex flex-col overflow-hidden shrink-0 border-x"
      >
        {config.sideStackOrder === 'clinics_call_queue' ? (
          <>
            {sideStackClinicsElement}
            {sideStackCallElement}
            {sideStackWaitingListElement}
          </>
        ) : config.sideStackOrder === 'call_queue_clinics' ? (
          <>
            {sideStackCallElement}
            {sideStackWaitingListElement}
            {sideStackClinicsElement}
          </>
        ) : (
          <>
            {sideStackCallElement}
            {sideStackClinicsElement}
            {sideStackWaitingListElement}
          </>
        )}
      </div>
    );

    return (
      <div
        className="flex flex-1 overflow-hidden w-full h-full"
        style={{ borderColor: config.cardBorderColor }}
      >
        {/* الترتيب وفقاً لـ mediaPosition في بيئة dir=rtl: */}
        {config.mediaPosition === 'left' ? (
          <>
            {/* في اليمين: العيادات والنداء وقائمة الانتظار فوق بعض */}
            {sideStackColumn}
            {/* في اليسار: الميديا لوحدها بعرض 70% */}
            {mediaColumn}
          </>
        ) : (
          <>
            {/* في اليمين: الميديا بعرض 70% */}
            {mediaColumn}
            {/* في اليسار: العيادات والنداء وقائمة الانتظار فوق بعض */}
            {sideStackColumn}
          </>
        )}
      </div>
    );
  }
}
