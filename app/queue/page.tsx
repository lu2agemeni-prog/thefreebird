'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Monitor, Maximize, Minimize, Sun, Moon,
  ZoomIn, ZoomOut, LayoutGrid, ChevronDown, Image as ImageIcon, Volume2, VolumeX, Stethoscope,
  Sliders, RotateCcw,
} from 'lucide-react';
import { playQueueAnnouncement } from '@/lib/queueAudio';

// أوضاع العرض المتاحة — دايمًا تركيبة من (عيادات/أطباء) + إمكانية إضافة ميديا
type ViewMode = 'clinics_doctors' | 'clinics_doctors_media' | 'doctors_media' | 'clinics_media';

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  clinics_doctors: 'عيادات + أطباء',
  clinics_doctors_media: 'عيادات + أطباء + ميديا',
  doctors_media: 'أطباء + ميديا',
  clinics_media: 'عيادات + ميديا',
};

function modeHasClinics(m: ViewMode) { return m === 'clinics_doctors' || m === 'clinics_doctors_media' || m === 'clinics_media'; }
function modeHasDoctors(m: ViewMode) { return m === 'clinics_doctors' || m === 'clinics_doctors_media' || m === 'doctors_media'; }
function modeHasMedia(m: ViewMode) { return m === 'clinics_doctors_media' || m === 'doctors_media' || m === 'clinics_media'; }

export default function QueueDisplay() {
  const [queue, setQueue] = useState<any[]>([]);
  const [presentDoctors, setPresentDoctors] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [media, setMedia] = useState<any[]>([]);
  const [mediaIndex, setMediaIndex] = useState(0);

  // ==== إعدادات الشاشة ====
  const [showBar, setShowBar] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('clinics_doctors_media');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);
  const lastAnnouncedIdRef = useRef<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ==== تخصيص أبعاد الأقسام (يُحفظ محليًا لكل شاشة/جهاز على حدة) ====
  const DEFAULT_MEDIA_WIDTH = 60;
  const DEFAULT_DOCTORS_HEIGHT = 30;
  const [mediaWidthPct, setMediaWidthPct] = useState(DEFAULT_MEDIA_WIDTH);
  const [doctorsHeightPct, setDoctorsHeightPct] = useState(DEFAULT_DOCTORS_HEIGHT);
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);

  useEffect(() => {
    const savedMedia = localStorage.getItem('queue_display_media_width');
    const savedDoctors = localStorage.getItem('queue_display_doctors_height');
    if (savedMedia) setMediaWidthPct(Number(savedMedia));
    if (savedDoctors) setDoctorsHeightPct(Number(savedDoctors));
  }, []);

  useEffect(() => {
    localStorage.setItem('queue_display_media_width', String(mediaWidthPct));
  }, [mediaWidthPct]);

  useEffect(() => {
    localStorage.setItem('queue_display_doctors_height', String(doctorsHeightPct));
  }, [doctorsHeightPct]);

  const resetLayout = () => {
    setMediaWidthPct(DEFAULT_MEDIA_WIDTH);
    setDoctorsHeightPct(DEFAULT_DOCTORS_HEIGHT);
    setZoom(1);
  };

  // الزووم بيغيّر حجم الخط الجذري (html) عشان كل وحدات rem في التصميم
  // (اللي هي كل أحجام Tailwind) تتناسب معاه فعليًا — الطريقة القديمة كانت
  // بتحط fontSize على div داخلي، وده ملوش أي تأثير على وحدات rem لأنها
  // بترجع دايمًا لحجم خط عنصر html الجذري بغض النظر عن أي عنصر أب.
  useEffect(() => {
    document.documentElement.style.fontSize = `${zoom * 100}%`;
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [zoom]);

  // ==== إشعار النداء المنبثق ====
  const [dropNotice, setDropNotice] = useState<{ token: number; clinicName: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ==== نداء السكرتارية من الطبيب — بث فوري بدون أي تخزين ====
  const [secretaryAlert, setSecretaryAlert] = useState<string | null>(null);
  const secretaryAlertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const enableSound = () => {
    const unlock = new Audio('/audio/ding.mp3');
    unlock.volume = 0;
    unlock.play().catch(() => {});
    setSoundEnabled(true);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    fetchQueue();
    fetchPresentDoctors();

    const sub = supabase.channel('queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_queue' }, fetchQueue)
      .subscribe();
    const presenceSub = supabase.channel('doctor_presence_changes_display')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, fetchPresentDoctors)
      .subscribe();
    const pollTimer = setInterval(fetchQueue, 5000);
    const presencePoll = setInterval(fetchPresentDoctors, 30000);

    // نداء السكرتارية من الطبيب — نفس البث اللي بتستقبله شاشة السكرتارية،
    // بدون أي تخزين في قاعدة البيانات
    const callChannel = supabase.channel('secretary-calls')
      .on('broadcast', { event: 'call_secretary' }, (payload) => {
        if (soundEnabledRef.current) {
          new Audio('/audio/ding.mp3').play().catch(() => {});
        }
        setSecretaryAlert(`نداء للسكرتارية - ${payload.payload?.clinicName || 'عيادة'}`);
        if (secretaryAlertTimer.current) clearTimeout(secretaryAlertTimer.current);
        secretaryAlertTimer.current = setTimeout(() => setSecretaryAlert(null), 8000);
      })
      .subscribe();

    return () => {
      clearInterval(timer);
      clearInterval(pollTimer);
      clearInterval(presencePoll);
      supabase.removeChannel(sub);
      supabase.removeChannel(presenceSub);
      supabase.removeChannel(callChannel);
    };
  }, []);

  useEffect(() => {
    if (!modeHasMedia(viewMode)) return;
    supabase.from('queue_media').select('*').eq('is_active', true).order('display_order', { ascending: true })
      .then(({ data }) => setMedia(data || []));
  }, [viewMode]);

  useEffect(() => {
    if (media.length === 0) return;
    const t = setInterval(() => setMediaIndex(i => (i + 1) % media.length), 8000);
    return () => clearInterval(t);
  }, [media]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const fetchQueue = async () => {
    const { data } = await supabase.rpc('get_public_queue_status');
    if (data) {
      setQueue(data);
      const calling = data.find((q: any) => q.status === 'calling');
      if (calling && calling.id !== lastAnnouncedIdRef.current) {
        lastAnnouncedIdRef.current = calling.id;

        if (soundEnabledRef.current) {
          playQueueAnnouncement(calling.token_number, calling.clinic_name || '', calling.clinic_audio_number);
        }

        setDropNotice({ token: calling.token_number, clinicName: calling.clinic_name || 'العيادة' });
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setDropNotice(null), 10000);
      }
    }
  };

  const fetchPresentDoctors = async () => {
    const { data } = await supabase
      .from('doctors')
      .select('profile_id, clinic_id, is_present, profiles(first_name, last_name), clinics(name)')
      .eq('is_present', true);
    if (data) setPresentDoctors(data);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (e.clientY < 90) {
      setShowBar(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else if (!showModeMenu && !showLayoutPanel) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowBar(false), 2500);
    }
  }, [showModeMenu, showLayoutPanel]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  const currentCall = queue.find(q => q.status === 'calling');
  const waitingList = queue.filter(q => q.status === 'waiting').slice(0, 8);

  const destinationLabel = (q: any) => {
    const clinic = modeHasClinics(viewMode) ? q.clinic_name : null;
    const doctor = modeHasDoctors(viewMode) ? q.doctor_name : null;
    return [clinic, doctor].filter(Boolean).join(' — ') || q.clinic_name || 'غير محدد';
  };

  // مربعات الأطباء المتواجدين — كل طبيب متواجد بمربّع لوحده (اسم الطبيب + عيادته)
  const presentDoctorBoxes = presentDoctors
    .filter(d => d.profiles)
    .map(d => {
      const calling = queue.find(q => q.status === 'calling' && q.clinic_id === d.clinic_id);
      return {
        doctorId: d.profile_id,
        doctorName: `د. ${d.profiles?.first_name || ''} ${d.profiles?.last_name || ''}`.trim(),
        clinicName: d.clinics?.name || 'عيادة',
        currentToken: calling?.token_number ?? null,
      };
    });

  const bg = isDark ? 'bg-slate-900 text-white' : 'bg-gray-50 text-gray-900';
  const panelBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200';
  const rowBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200';
  const mutedText = isDark ? 'text-slate-300' : 'text-gray-600';

  const showMedia = modeHasMedia(viewMode);

  return (
    <div className={`h-screen ${bg} flex flex-col font-sans overflow-hidden relative transition-colors duration-300`} dir="rtl" onMouseMove={handleMouseMove}>
      <style>{`
        @keyframes drop-notice-fall {
          0% { transform: translateY(-120%); opacity: 0; }
          55% { transform: translateY(8%); opacity: 1; }
          70% { transform: translateY(-3%); }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes drop-notice-flash {
          0%, 100% { box-shadow: 0 0 40px 10px rgba(220,38,38,0.9); background-color: rgb(220 38 38); }
          50% { box-shadow: 0 0 60px 20px rgba(239,68,68,0.6); background-color: rgb(185 28 28); }
        }
        .drop-notice {
          animation: drop-notice-fall 0.7s cubic-bezier(0.34,1.56,0.64,1) both, drop-notice-flash 1s ease-in-out infinite;
        }
        @keyframes drop-notice-flash-amber {
          0%, 100% { box-shadow: 0 0 40px 10px rgba(217,119,6,0.9); background-color: rgb(217 119 6); }
          50% { box-shadow: 0 0 60px 20px rgba(245,158,11,0.6); background-color: rgb(180 83 9); }
        }
        .drop-notice-amber {
          animation: drop-notice-fall 0.7s cubic-bezier(0.34,1.56,0.64,1) both, drop-notice-flash-amber 1s ease-in-out infinite;
        }
      `}</style>

      {/* شريط الإعدادات — يظهر عند تحريك الماوس أعلى الشاشة */}
      <div
        className={`fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-black/80 backdrop-blur-sm py-3 transition-transform duration-300 ${showBar ? 'translate-y-0' : '-translate-y-full'}`}
        onMouseEnter={() => { setShowBar(true); if (hideTimer.current) clearTimeout(hideTimer.current); }}
      >
        <button onClick={toggleFullscreen} className="flex items-center gap-2 text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          {isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
        </button>

        <div className="relative">
          <button onClick={() => setShowModeMenu(s => !s)} className="flex items-center gap-2 text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
            <LayoutGrid className="w-4 h-4" />
            {VIEW_MODE_LABELS[viewMode]}
            <ChevronDown className="w-4 h-4" />
          </button>
          {showModeMenu && (
            <div className="absolute top-full mt-2 right-0 bg-slate-800 border border-slate-600 rounded-xl overflow-hidden shadow-xl min-w-[220px]">
              {(Object.keys(VIEW_MODE_LABELS) as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => { setViewMode(mode); setShowModeMenu(false); }}
                  className={`w-full text-right px-4 py-3 text-sm font-bold transition-colors ${viewMode === mode ? 'bg-emerald-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`}
                >
                  {VIEW_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => setIsDark(d => !d)} className="flex items-center gap-2 text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isDark ? 'وضع النهار' : 'وضع الليل'}
        </button>

        <button onClick={enableSound} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${soundEnabled ? 'bg-emerald-600 text-white' : 'text-white bg-white/10 hover:bg-white/20'}`}>
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          {soundEnabled ? 'الصوت مفعّل' : 'تفعيل الصوت'}
        </button>

        <div className="flex items-center gap-1 bg-white/10 rounded-lg px-1">
          <button onClick={() => setZoom(z => Math.max(0.7, +(z - 0.1).toFixed(1)))} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-white text-xs font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(1.5, +(z + 0.1).toFixed(1)))} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <button onClick={() => setShowLayoutPanel(s => !s)} className="flex items-center gap-2 text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
            <Sliders className="w-4 h-4" /> تنسيق الشاشة
          </button>
          {showLayoutPanel && (
            <div className="absolute top-full mt-2 left-0 bg-slate-800 border border-slate-600 rounded-xl shadow-xl p-4 w-80 space-y-4 text-right">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>{mediaWidthPct}%</span>
                  <span>عرض قسم الميديا (والأطباء المتواجدون {100 - mediaWidthPct}%)</span>
                </div>
                <input
                  type="range" min={20} max={80} step={5}
                  value={mediaWidthPct}
                  onChange={(e) => setMediaWidthPct(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>{doctorsHeightPct}%</span>
                  <span>ارتفاع قسم النداء الحالي وقائمة الانتظار</span>
                </div>
                <input
                  type="range" min={15} max={50} step={5}
                  value={doctorsHeightPct}
                  onChange={(e) => setDoctorsHeightPct(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
              <button
                onClick={resetLayout}
                className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> استعادة الوضع الافتراضي
              </button>
            </div>
          )}
        </div>
      </div>

      {/* المحتوى — الزووم بيكبّر حجم الخط والمسافات (عن طريق تكبير خط عنصر
          html الجذري) بدل ما يعمل scale بصري للتصميم كله، عشان نسب الأقسام
          متتكسرش أو تتقص من حواف الشاشة */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header (شريط علوي رفيع، مش من ضمن نسب الأقسام التلاتة) */}
        <header className={`${panelBg} px-8 py-3 flex justify-between items-center shadow-xl border-b shrink-0`}>
          <div className="flex items-center gap-3">
            <Monitor className="w-8 h-8 text-emerald-500" />
            <h1 className="text-xl font-bold">مركز الطائر الحر الطبي</h1>
          </div>
          <div className={`text-xl font-bold font-mono tracking-wider ${mutedText}`} dir="ltr">
            {currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </header>

        {/* القسم العلوي: ميديا (يمين) + الأطباء المتواجدون (يسار) — أو 100% لو مفيش ميديا */}
        <div className="flex" style={{ height: `${100 - doctorsHeightPct}%` }}>
          {showMedia && (
            <div style={{ width: `${mediaWidthPct}%` }} className="relative bg-black flex items-center justify-center overflow-hidden border-l border-slate-700">
              {media.length === 0 ? (
                <div className="text-slate-600 flex flex-col items-center gap-2">
                  <ImageIcon className="w-16 h-16" />
                  <p className="text-lg">لا توجد وسائط مضافة</p>
                </div>
              ) : media[mediaIndex]?.media_type === 'video' ? (
                <video key={media[mediaIndex].id} src={media[mediaIndex].url} autoPlay muted loop className="w-full h-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={media[mediaIndex]?.id} src={media[mediaIndex]?.url} alt="" className="w-full h-full object-contain" />
              )}
            </div>
          )}

          {/* الأطباء المتواجدون */}
          <div style={{ width: showMedia ? `${100 - mediaWidthPct}%` : '100%' }} className="flex flex-col overflow-hidden p-4">
            <h3 className={`text-sm font-bold ${mutedText} flex items-center gap-2 mb-3 shrink-0`}>
              <Stethoscope className="w-4 h-4 text-emerald-500" /> الأطباء المتواجدون ({presentDoctorBoxes.length})
            </h3>
            {presentDoctorBoxes.length === 0 ? (
              <div className={`flex-1 flex items-center justify-center text-sm ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                لا يوجد أطباء متواجدون حاليًا
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-2 gap-3 overflow-y-auto content-start">
                {presentDoctorBoxes.map(box => (
                  <div key={box.doctorId} className={`${rowBg} border rounded-xl p-3 flex flex-col items-center justify-center text-center gap-1`}>
                    <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>{box.doctorName}</p>
                    <p className={`text-xs ${mutedText}`}>{box.clinicName}</p>
                    <p className="text-2xl font-black text-emerald-500 font-mono">{box.currentToken ?? '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* القسم السفلي: النداء الحالي (أخضر، 50% من عرض الشاشة) + قائمة الانتظار */}
        <div className="flex" style={{ height: `${doctorsHeightPct}%` }}>
          <div style={{ width: '50%' }} className={`${panelBg} border-t p-3 shrink-0 overflow-y-auto`}>
            <h3 className={`text-sm font-bold ${mutedText} flex items-center gap-2 mb-2`}>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
              </span>
              قائمة الانتظار ({waitingList.length})
            </h3>
            <div className="flex flex-col gap-1.5">
              {waitingList.map((q, idx) => (
                <div key={q.id} className={`${rowBg} border px-3 py-1.5 rounded-lg flex justify-between items-center text-sm`}>
                  <span className={isDark ? 'text-slate-300' : 'text-gray-700'}>{idx + 1}. {destinationLabel(q)}</span>
                  <span className="font-bold text-orange-500 font-mono text-lg">{q.token_number}</span>
                </div>
              ))}
              {waitingList.length === 0 && (
                <div className={`text-sm py-2 text-center ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>لا يوجد مرضى في الانتظار</div>
              )}
            </div>
          </div>

          <div style={{ width: '50%' }} className="bg-emerald-600 border-t border-emerald-700 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {currentCall ? (
              <div className="text-center z-10 w-full">
                <div className="inline-block bg-emerald-800 text-white px-5 py-1.5 rounded-full text-base font-bold mb-3 animate-pulse">
                  النداء الحالي
                </div>
                <div className="text-7xl leading-none font-black text-white mb-3 font-mono">
                  {currentCall.token_number}
                </div>
                <div className="text-lg text-emerald-50 flex items-center justify-center gap-2 flex-wrap">
                  تفضل بالدخول إلى:
                  <span className="text-white font-bold bg-emerald-800/60 px-3 py-1.5 rounded-lg border border-emerald-400/30">
                    {destinationLabel(currentCall)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center text-lg flex flex-col items-center text-emerald-100">
                <Monitor className="w-14 h-14 mb-3 text-emerald-400" />
                في انتظار النداء القادم...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* إشعار النداء المنسدل من أعلى الشاشة */}
      {dropNotice && (
        <div className="fixed inset-x-0 top-0 z-[60] flex justify-center pointer-events-none">
          <div className="drop-notice mt-24 text-white text-center rounded-2xl px-10 py-6 shadow-2xl border-4 border-white/30">
            <p className="text-2xl font-bold mb-2">على العميل رقم {dropNotice.token}</p>
            <p className="text-3xl font-black">التوجه إلى {dropNotice.clinicName}</p>
          </div>
        </div>
      )}

      {/* نداء السكرتارية من الطبيب */}
      {secretaryAlert && (
        <div className="fixed inset-x-0 top-0 z-[60] flex justify-center pointer-events-none">
          <div className="drop-notice-amber mt-56 text-white text-center rounded-2xl px-10 py-5 shadow-2xl border-4 border-white/30 flex items-center gap-3">
            <span className="text-2xl font-black">🔔</span>
            <p className="text-2xl font-bold">{secretaryAlert}</p>
          </div>
        </div>
      )}

      {!soundEnabled && (
        <button
          onClick={enableSound}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-full shadow-xl animate-pulse"
        >
          <VolumeX className="w-5 h-5" /> اضغط هنا لتفعيل صوت النداء على الشاشة
        </button>
      )}
    </div>
  );
}
