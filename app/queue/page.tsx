'use client';

// ============================================================================
// app/queue/page.tsx
// شاشة النداء الآلي المطورة (Call Display Screen):
// - عرض ميديا الأطباء المتواجدين (صورة الطبيب + تشغيل المقطع الصوتي الخاص به مرة واحدة لكل فترة).
// - تحديد فترة الإعلان (30 ثانية لكل طبيب أو المدة المحددة له) مع شريط تقدم حي.
// - التخزين المؤقت المسبق (In-Memory Preload & Cache) للصور والمقاطع الصوتية لسرعة التشغيل الفوري بدون لاج.
// - الأولوية المطلقة لنداء المريض: عند صدور نداء، يتوقف صوت إعلان الطبيب فوراً ويبدأ نداء المريض.
// - التحديد التلقائي لتواجد الأطباء وفق مواعيد وفترات عملهم مع مزامنة لحظية في قاعدة البيانات.
// - شريط إعدادات ذكي بالأعلى يظهر ويختفي بسلاسة عند مرور الماوس.
// - تنسيق بصري فائق الجمال والوضوح مناسب للشاشات الكبيرة في صالات الانتظار.
// ============================================================================

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Monitor,
  Maximize,
  Minimize,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  ChevronDown,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Stethoscope,
  Sliders,
  RotateCcw,
  Sparkles,
  Clock,
  Building,
  User,
  Radio,
  ChevronRight,
  ChevronLeft,
  Play,
  Square,
  AlertCircle,
} from 'lucide-react';
import { playQueueAnnouncement } from '@/lib/queueAudio';
import {
  DoctorMediaMeta,
  parseDoctorMediaMeta,
  calculateDoctorPresence,
  syncDoctorsPresenceWithDatabase,
  DEFAULT_AD_DURATION,
} from '@/lib/doctor-schedules';
import { mediaCache } from '@/lib/media-cache';

// أوضاع العرض المتاحة
type ViewMode = 'all_media_queue' | 'doctors_media_only' | 'queue_only' | 'general_media_queue';

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  all_media_queue: 'ميديا الأطباء والمركز + طابور النداء (شامل)',
  doctors_media_only: 'إعلانات الأطباء المتواجدين فقط',
  general_media_queue: 'وسائط المركز العامة + طابور النداء',
  queue_only: 'طابور النداء والأطباء فقط بدون ميديا',
};

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

  // فهرس الشريحة المعروضة حالياً
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0); // 0 to 100%
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // إعدادات الشاشة العلوية
  const [showBar, setShowBar] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all_media_queue');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // التحكم في الصوت
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [muteDoctorAudio, setMuteDoctorAudio] = useState(false);
  const soundEnabledRef = useRef(false);
  const muteDoctorAudioRef = useRef(false);

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

  // تخصيص الأبعاد
  const DEFAULT_MEDIA_WIDTH = 58;
  const DEFAULT_BOTTOM_HEIGHT = 32;
  const [mediaWidthPct, setMediaWidthPct] = useState(DEFAULT_MEDIA_WIDTH);
  const [bottomHeightPct, setBottomHeightPct] = useState(DEFAULT_BOTTOM_HEIGHT);
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);

  // تحميل الأبعاد المحفوظة محلياً
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const savedMedia = localStorage.getItem('queue_display_media_width');
        const savedBottom = localStorage.getItem('queue_display_bottom_height');
        const savedMode = localStorage.getItem('queue_display_view_mode') as ViewMode;
        if (savedMedia) setMediaWidthPct(Number(savedMedia));
        if (savedBottom) setBottomHeightPct(Number(savedBottom));
        if (savedMode && VIEW_MODE_LABELS[savedMode]) setViewMode(savedMode);
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    localStorage.setItem('queue_display_media_width', String(mediaWidthPct));
  }, [mediaWidthPct]);

  useEffect(() => {
    localStorage.setItem('queue_display_bottom_height', String(bottomHeightPct));
  }, [bottomHeightPct]);

  useEffect(() => {
    localStorage.setItem('queue_display_view_mode', viewMode);
  }, [viewMode]);

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

  // تعديل زووم الشاشة عبر حجم خط عنصر html
  useEffect(() => {
    document.documentElement.style.fontSize = `${zoom * 100}%`;
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [zoom]);

  const resetLayout = () => {
    setMediaWidthPct(DEFAULT_MEDIA_WIDTH);
    setBottomHeightPct(DEFAULT_BOTTOM_HEIGHT);
    setZoom(1);
    setViewMode('all_media_queue');
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
          noticeTimer.current = setTimeout(() => {
            setDropNotice(null);
          }, 11000);
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
        // مزامنة حالة التواجد التلقائية فوراً مع قاعدة البيانات لضمان دقة النظام بالكامل
        syncDoctorsPresenceWithDatabase(supabase, data);
      }
    } catch (e) {
      console.warn('Error fetching doctors:', e);
    }
  }, []);

  // جلب الوسائط العامة للمركز
  const fetchGeneralMedia = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('queue_media')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (data) setGeneralMedia(data);
    } catch (e) {
      console.warn('Error fetching general media:', e);
    }
  }, []);

  // تهيئة المؤقتات والاشتراكات الحية
  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    const initialFetchTimer = setTimeout(() => {
      fetchQueue();
      fetchDoctorsAndPresence();
      fetchGeneralMedia();
    }, 0);

    // اشتراكات Realtime
    const queueSub = supabase
      .channel('queue_display_call_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_queue' }, fetchQueue)
      .subscribe();

    const doctorSub = supabase
      .channel('queue_display_doctor_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, fetchDoctorsAndPresence)
      .subscribe();

    const mediaSub = supabase
      .channel('queue_display_media_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_media' }, fetchGeneralMedia)
      .subscribe();

    // نداء السكرتارية
    const secretarySub = supabase
      .channel('secretary-calls')
      .on('broadcast', { event: 'call_secretary' }, (payload) => {
        if (soundEnabledRef.current) {
          new Audio('/audio/ding.mp3').play().catch(() => {});
        }
        setSecretaryAlert(`نداء عاجل للسكرتارية - ${payload.payload?.clinicName || 'عيادة'}`);
        if (secretaryAlertTimer.current) clearTimeout(secretaryAlertTimer.current);
        secretaryAlertTimer.current = setTimeout(() => setSecretaryAlert(null), 8000);
      })
      .subscribe();

    // استطلاع دوري
    const queuePoll = setInterval(fetchQueue, 5000);
    const doctorPoll = setInterval(fetchDoctorsAndPresence, 25000);

    return () => {
      clearTimeout(initialFetchTimer);
      clearInterval(clockTimer);
      clearInterval(queuePoll);
      clearInterval(doctorPoll);
      supabase.removeChannel(queueSub);
      supabase.removeChannel(doctorSub);
      supabase.removeChannel(mediaSub);
      supabase.removeChannel(secretarySub);
      mediaCache.stopAllAudio();
    };
  }, [fetchQueue, fetchDoctorsAndPresence, fetchGeneralMedia]);

  // تجهيز قائمة الأطباء المتواجدين مع تفاصيلهم
  const presentDoctorsList = useMemo(() => {
    return rawDoctors
      .map((doc) => {
        const presence = calculateDoctorPresence(doc);
        const meta = parseDoctorMediaMeta(doc.bio);
        const doctorName = `د. ${doc.profiles?.first_name || ''} ${doc.profiles?.last_name || ''}`.trim();
        const clinicName = doc.clinics?.name || 'عيادة متخصصة';
        const photoUrl = meta.photo_url || doc.profiles?.avatar_url || '';
        const calling = queue.find((q) => q.status === 'calling' && q.clinic_id === doc.clinic_id);

        return {
          ...doc,
          doctorName,
          clinicName,
          specialty: doc.specialty || '',
          photoUrl,
          audioUrl: meta.audio_url || '',
          adDurationSeconds: meta.ad_duration_seconds || DEFAULT_AD_DURATION,
          isPresent: presence.isPresent,
          currentToken: calling?.token_number ?? null,
        };
      })
      .filter((d) => d.isPresent);
  }, [rawDoctors, queue]);

  // بناء شرائح العرض (Media Slides) وفق وضع العرض المختار
  const mediaSlides: MediaSlideItem[] = useMemo(() => {
    if (viewMode === 'queue_only') return [];

    const slides: MediaSlideItem[] = [];

    // 1. شرائح ميديا الأطباء المتواجدين
    if (viewMode === 'all_media_queue' || viewMode === 'doctors_media_only') {
      presentDoctorsList.forEach((doc) => {
        // إذا كان الطبيب متواجداً ولديه صورة أو بيانات إعلان
        slides.push({
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
    }

    // 2. شرائح الوسائط العامة للمركز
    if (viewMode === 'all_media_queue' || viewMode === 'general_media_queue') {
      generalMedia.forEach((m) => {
        slides.push({
          type: 'general',
          id: m.id,
          mediaType: m.media_type,
          url: m.url,
          durationSeconds: 15,
        });
      });
    }

    return slides;
  }, [viewMode, presentDoctorsList, generalMedia]);

  // التحميل المسبق للصور والمقاطع الصوتية في الكاش لضمان التشغيل الفوري بدون لاج
  useEffect(() => {
    mediaSlides.forEach((slide) => {
      if (slide.type === 'doctor') {
        if (slide.photoUrl) mediaCache.preloadImage(slide.photoUrl);
        if (slide.audioUrl) mediaCache.preloadAudio(slide.audioUrl);
      } else if (slide.type === 'general' && slide.mediaType === 'image') {
        mediaCache.preloadImage(slide.url);
      }
    });
  }, [mediaSlides]);

  // معالجة تغيير الشريحة وتشغيل الصوت الخاص بكل طبيب مرة واحدة
  const currentSlide = mediaSlides[slideIndex] || null;

  const goToNextSlide = useCallback(() => {
    if (mediaSlides.length === 0) return;
    setSlideIndex((prev) => (prev + 1) % mediaSlides.length);
  }, [mediaSlides.length]);

  const goToPrevSlide = useCallback(() => {
    if (mediaSlides.length === 0) return;
    setSlideIndex((prev) => (prev - 1 + mediaSlides.length) % mediaSlides.length);
  }, [mediaSlides.length]);

  // تشغيل دورة الإعلانات وتوقيتاتها
  useEffect(() => {
    if (!currentSlide) {
      const resetT = setTimeout(() => setSlideProgress(0), 0);
      return () => clearTimeout(resetT);
    }

    // إيقاف أي صوت سابق فور الانتقال لشريحة جديدة
    mediaCache.stopAllAudio();
    const pauseT = setTimeout(() => setIsAudioPlaying(false), 0);

    // إذا كان المريض يتم نداؤه حالياً، نتوقف عن تشغيل صوت الطبيب
    const isPatientBeingCalled = !!dropNotice;

    // تشغيل المقطع الصوتي الخاص بالطبيب مرة واحدة فقط عند بدء دورته
    if (
      currentSlide.type === 'doctor' &&
      currentSlide.audioUrl &&
      soundEnabledRef.current &&
      !muteDoctorAudioRef.current &&
      !isPatientBeingCalled
    ) {
      const { isPlaying } = mediaCache.playDoctorAudio(
        currentSlide.audioUrl,
        () => setIsAudioPlaying(false),
        0.85
      );
      if (isPlaying) setTimeout(() => setIsAudioPlaying(true), 0);
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
  }, [currentSlide, goToNextSlide, dropNotice]);

  // إظهار وإخفاء شريط الإعدادات عند حركة الماوس
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (e.clientY < 90) {
        setShowBar(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
      } else if (!showModeMenu && !showLayoutPanel) {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setShowBar(false), 2600);
      }
    },
    [showModeMenu, showLayoutPanel]
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
  const waitingList = queue.filter((q) => q.status === 'waiting').slice(0, 8);

  const bg = isDark ? 'bg-slate-950 text-white' : 'bg-gray-100 text-gray-900';
  const panelBg = isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-gray-200';
  const cardBg = isDark ? 'bg-slate-800/90 border-slate-700/80 text-white' : 'bg-white border-gray-200 text-gray-800';
  const mutedText = isDark ? 'text-slate-400' : 'text-gray-500';

  const hasMediaView = viewMode !== 'queue_only';

  return (
    <div
      className={`h-screen ${bg} flex flex-col font-sans overflow-hidden relative select-none transition-colors duration-300`}
      dir="rtl"
      onMouseMove={handleMouseMove}
    >
      <style>{`
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
        className={`fixed top-0 inset-x-0 z-50 flex flex-wrap items-center justify-center gap-2 bg-slate-950/90 backdrop-blur-md py-3 px-4 border-b border-slate-800 shadow-2xl transition-transform duration-300 ${
          showBar ? 'translate-y-0' : '-translate-y-full'
        }`}
        onMouseEnter={() => {
          setShowBar(true);
          if (hideTimer.current) clearTimeout(hideTimer.current);
        }}
      >
        {/* ملء الشاشة */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center gap-1.5 text-white bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          <span>{isFullscreen ? 'تصغير' : 'ملء الشاشة'}</span>
        </button>

        {/* وضع العرض */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowModeMenu((s) => !s)}
            className="flex items-center gap-1.5 text-white bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <LayoutGrid className="w-4 h-4 text-emerald-400" />
            <span>{VIEW_MODE_LABELS[viewMode]}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showModeMenu && (
            <div className="absolute top-full mt-2 right-0 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl min-w-[240px] z-50">
              {(Object.keys(VIEW_MODE_LABELS) as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setViewMode(mode);
                    setShowModeMenu(false);
                  }}
                  className={`w-full text-right px-4 py-2.5 text-xs font-bold transition-colors ${
                    viewMode === mode ? 'bg-emerald-600 text-white' : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {VIEW_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* تفعيل الصوت العام للشاشة */}
        <button
          type="button"
          onClick={enableSound}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            soundEnabled ? 'bg-emerald-600 text-white' : 'text-white bg-white/10 hover:bg-white/20'
          }`}
          title="تفعيل الإشعارات الصوتية لنداء المرضى"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span>{soundEnabled ? 'صوت النداء مفعّل' : 'تفعيل صوت النداء'}</span>
        </button>

        {/* كتم / تشغيل صوت إعلانات الأطباء */}
        <button
          type="button"
          onClick={() => setMuteDoctorAudio((m) => !m)}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            !muteDoctorAudio ? 'bg-blue-600/80 text-white' : 'text-slate-300 bg-white/10 hover:bg-white/20'
          }`}
          title="التحكم في تشغيل المقطع الصوتي المسجل للأطباء"
        >
          <Radio className="w-4 h-4" />
          <span>{!muteDoctorAudio ? 'صوت الأطباء يعمل' : 'صوت الأطباء مكتوم'}</span>
        </button>

        {/* وضع النهار / الليل */}
        <button
          type="button"
          onClick={() => setIsDark((d) => !d)}
          className="flex items-center gap-1.5 text-white bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span>{isDark ? 'نهار' : 'ليل'}</span>
        </button>

        {/* الزووم */}
        <div className="flex items-center gap-1 bg-white/10 rounded-xl px-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors cursor-pointer"
            title="تصغير الخطوط"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-white text-xs font-mono font-bold w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(1)))}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors cursor-pointer"
            title="تكبير الخطوط"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* لوحة أبعاد الأقسام */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLayoutPanel((s) => !s)}
            className="flex items-center gap-1.5 text-white bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
            <span>تنسيق الأبعاد</span>
          </button>

          {showLayoutPanel && (
            <div className="absolute top-full mt-2 left-0 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 w-80 space-y-4 text-right z-50">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>{mediaWidthPct}%</span>
                  <span>عرض قسم الميديا (والأطباء {100 - mediaWidthPct}%)</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={80}
                  step={5}
                  value={mediaWidthPct}
                  onChange={(e) => setMediaWidthPct(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>{bottomHeightPct}%</span>
                  <span>ارتفاع قسم النداء وقائمة الانتظار</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={50}
                  step={5}
                  value={bottomHeightPct}
                  onChange={(e) => setBottomHeightPct(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={resetLayout}
                className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>استعادة الوضع الافتراضي</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* المحتوى الرئيسي للشاشة */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* الشريط العلوي الثابت (الهيدر الفخم) */}
        <header
          className={`${panelBg} px-6 sm:px-8 py-2.5 flex justify-between items-center shadow-lg border-b shrink-0 z-10`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-wide">مركز الطائر الحر الطبي</h1>
              <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>شاشة العرض والنداء الآلي المباشر</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            {/* مؤشر الصوت النشط */}
            {isAudioPlaying && (
              <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>مقطع صوتي يعمل الآن</span>
              </div>
            )}

            {/* الساعة الحية */}
            <div className="text-xl sm:text-2xl font-black font-mono tracking-wider text-emerald-400" dir="ltr">
              {currentTime.toLocaleTimeString('ar-EG', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
          </div>
        </header>

        {/* القسم العلوي: الميديا (يسار/يمين) + شبكة الأطباء المتواجدين */}
        <div className="flex flex-1 overflow-hidden" style={{ height: `${100 - bottomHeightPct}%` }}>
          {/* قسم الميديا (إعلانات الأطباء أو وسائط المركز) */}
          {hasMediaView && (
            <div
              style={{ width: `${mediaWidthPct}%` }}
              className="relative bg-black flex flex-col items-center justify-center overflow-hidden border-l border-slate-800"
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
                    <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-4 py-1.5 rounded-full text-xs font-black shadow-lg">
                      <Stethoscope className="w-4 h-4 text-emerald-400" />
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

                  {/* صورة الطبيب الفخمة والمعلومات في المنتصف */}
                  <div className="flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-10 my-auto z-10 w-full max-w-2xl">
                    {/* برواز صورة الطبيب */}
                    <div className="relative shrink-0">
                      <div className="absolute -inset-2 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-3xl blur-md opacity-40 animate-pulse" />
                      {currentSlide.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={currentSlide.photoUrl}
                          alt={currentSlide.doctorName}
                          className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-2xl object-cover border-2 border-emerald-400/50 shadow-2xl"
                        />
                      ) : (
                        <div className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-2xl bg-slate-800 border-2 border-slate-700 flex flex-col items-center justify-center text-slate-500 shadow-2xl">
                          <Stethoscope className="w-16 h-16 text-emerald-400 mb-2" />
                          <span className="text-xs font-bold">صورة الطبيب</span>
                        </div>
                      )}
                    </div>

                    {/* بيانات الطبيب والعيادة */}
                    <div className="flex flex-col text-center md:text-right space-y-3">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold block mb-1">
                          استشاري معتمد
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
                          {currentSlide.doctorName}
                        </h2>
                      </div>

                      <div className="inline-flex items-center justify-center md:justify-start gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                        <Building className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-base font-bold text-emerald-100">
                          {currentSlide.clinicName}
                        </span>
                      </div>

                      {currentSlide.specialty && (
                        <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
                          {currentSlide.specialty}
                        </p>
                      )}

                      {/* الدور الحالي للطبيب إذا كان ينادي على مريض */}
                      {currentSlide.currentToken !== null && (
                        <div className="pt-2 flex items-center justify-center md:justify-start gap-2">
                          <span className="text-xs text-slate-400 font-semibold">الدور الحالي بالعيادة:</span>
                          <span className="text-xl font-black text-emerald-400 font-mono bg-emerald-950/80 border border-emerald-500/40 px-3 py-0.5 rounded-lg">
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
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-100 ease-linear rounded-full"
                        style={{ width: `${slideProgress}%` }}
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
                        className="h-full bg-emerald-500 transition-all duration-100 ease-linear rounded-full"
                        style={{ width: `${slideProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* قسم شبكة الأطباء المتواجدين (يمين الشاشة) */}
          <div
            style={{ width: hasMediaView ? `${100 - mediaWidthPct}%` : '100%' }}
            className="flex flex-col overflow-hidden p-4 sm:p-5"
          >
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className={`text-sm font-bold ${mutedText} flex items-center gap-2`}>
                <Stethoscope className="w-4 h-4 text-emerald-400" />
                <span>الأطباء المتواجدون بالمركز ({presentDoctorsList.length})</span>
              </h3>
              <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                تحديث تلقائي حي
              </span>
            </div>

            {presentDoctorsList.length === 0 ? (
              <div
                className={`flex-1 flex flex-col items-center justify-center text-sm p-6 text-center ${
                  isDark ? 'text-slate-600' : 'text-gray-400'
                }`}
              >
                <Stethoscope className="w-12 h-12 mb-2 opacity-30" />
                <p className="font-bold">لا يوجد أطباء متواجدون حالياً</p>
                <p className="text-xs mt-1">يتم التواجد تلقائياً عند حلول فترات العمل المحددة</p>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto content-start pr-1">
                {presentDoctorsList.map((doc) => {
                  const isCurrentInSlide =
                    currentSlide?.type === 'doctor' && currentSlide.doctorId === doc.profile_id;

                  return (
                    <div
                      key={doc.profile_id}
                      className={`${cardBg} border rounded-2xl p-3.5 flex items-center gap-3 transition-all duration-300 ${
                        isCurrentInSlide
                          ? 'border-emerald-500 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                          : 'hover:border-slate-600'
                      }`}
                    >
                      {/* صورة الطبيب الصغيرة */}
                      {doc.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={doc.photoUrl}
                          alt={doc.doctorName}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                          <Stethoscope className="w-6 h-6" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs sm:text-sm truncate">{doc.doctorName}</h4>
                          {isCurrentInSlide && (
                            <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-1.5 py-0.2 rounded-md">
                              معروض
                            </span>
                          )}
                        </div>
                        <p className={`text-xs ${mutedText} truncate mt-0.5`}>{doc.clinicName}</p>
                      </div>

                      {/* الدور الحالي */}
                      <div className="text-left shrink-0 font-mono">
                        <span className="text-[10px] text-slate-400 block">الدور</span>
                        <span
                          className={`text-xl font-black ${
                            doc.currentToken ? 'text-emerald-400' : 'text-slate-600'
                          }`}
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
        </div>

        {/* القسم السفلي: النداء الحالي (يمين) + قائمة الانتظار (يسار) */}
        <div className="flex border-t border-slate-800" style={{ height: `${bottomHeightPct}%` }}>
          {/* قائمة الانتظار */}
          <div style={{ width: '48%' }} className={`${panelBg} border-l border-slate-800 p-3 sm:p-4 overflow-y-auto`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-xs sm:text-sm font-bold ${mutedText} flex items-center gap-2`}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                </span>
                <span>قائمة الانتظار القادمة ({waitingList.length})</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {waitingList.map((q, idx) => (
                <div
                  key={q.id}
                  className={`${cardBg} border px-3 py-2 rounded-xl flex justify-between items-center text-xs shadow-2xs`}
                >
                  <div className="truncate flex-1 min-w-0 pr-1">
                    <span className="font-bold block truncate">
                      {idx + 1}. {q.clinic_name || 'العيادة'}
                    </span>
                    {q.doctor_name && <span className="text-[10px] text-slate-400 truncate block">{q.doctor_name}</span>}
                  </div>
                  <span className="font-black text-orange-400 font-mono text-base shrink-0">
                    #{q.token_number}
                  </span>
                </div>
              ))}
              {waitingList.length === 0 && (
                <div className={`col-span-2 text-xs py-4 text-center ${mutedText}`}>
                  لا يوجد مرضى في طابور الانتظار حالياً
                </div>
              )}
            </div>
          </div>

          {/* النداء الحالي المباشر (أخضر فاقع وعريض جداً) */}
          <div
            style={{ width: '52%' }}
            className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden shadow-inner"
          >
            {currentCall ? (
              <div className="text-center z-10 w-full animate-in zoom-in-95 duration-300">
                <div className="inline-flex items-center gap-2 bg-emerald-900/90 text-white px-5 py-1 rounded-full text-xs sm:text-sm font-black mb-2 shadow-lg animate-pulse border border-emerald-400/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>النداء الحالي المباشر</span>
                </div>

                <div className="text-6xl sm:text-7xl font-black text-white mb-2 font-mono tracking-wider drop-shadow-md">
                  {currentCall.token_number}
                </div>

                <div className="text-sm sm:text-base text-emerald-50 flex items-center justify-center gap-2 flex-wrap font-medium">
                  <span>تفضل بالدخول إلى:</span>
                  <span className="text-white font-black bg-emerald-950/70 px-3.5 py-1 rounded-xl border border-emerald-400/30 text-base sm:text-lg">
                    {currentCall.clinic_name || 'العيادة'}
                    {currentCall.doctor_name ? ` (${currentCall.doctor_name})` : ''}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center text-sm flex flex-col items-center text-emerald-100/80">
                <Monitor className="w-12 h-12 mb-2 text-emerald-300/60" />
                <p className="font-bold text-base">في انتظار طلب الدور القادم...</p>
                <p className="text-xs text-emerald-200/70 mt-1">يتم الإعلان فور استدعاء الطبيب أو السكرتارية</p>
              </div>
            )}
          </div>
        </div>
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
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black px-7 py-3.5 rounded-full shadow-2xl border border-white/20 animate-pulse cursor-pointer transition-all hover:scale-105 text-sm"
        >
          <VolumeX className="w-5 h-5 text-amber-300" />
          <span>اضغط هنا لتفعيل الصوت على شاشة النداء</span>
        </button>
      )}
    </div>
  );
}
