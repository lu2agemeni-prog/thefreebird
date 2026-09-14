'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Monitor, Building2, Stethoscope, Maximize, Minimize, Sun, Moon,
  ZoomIn, ZoomOut, LayoutGrid, ChevronDown, Image as ImageIcon, Volume2, VolumeX,
} from 'lucide-react';
import { playQueueAnnouncement } from '@/lib/queueAudio';

type ViewMode = 'clinics' | 'doctors' | 'clinics_doctors' | 'media_clinics';

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  clinics: 'عرض العيادات فقط',
  doctors: 'عرض الأطباء فقط',
  clinics_doctors: 'عرض العيادات والأطباء',
  media_clinics: 'عرض الميديا والعيادات',
};

export default function QueueDisplay() {
  const [queue, setQueue] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [media, setMedia] = useState<any[]>([]);
  const [mediaIndex, setMediaIndex] = useState(0);

  // ==== إعدادات الشاشة ====
  const [showBar, setShowBar] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('clinics');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);
  const lastAnnouncedIdRef = useRef<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const enableSound = () => {
    // تشغيل صامت لكسر قيد المتصفح على التشغيل التلقائي بدون تفاعل مستخدم —
    // بعد الضغطة دي، أي تشغيل صوت برمجي لاحق في نفس الجلسة هيشتغل عادي.
    const unlock = new Audio('/audio/ding.mp3');
    unlock.volume = 0;
    unlock.play().catch(() => {});
    setSoundEnabled(true);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    fetchQueue();

    const sub = supabase.channel('queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_queue' }, fetchQueue)
      .subscribe();
    const pollTimer = setInterval(fetchQueue, 5000);

    return () => {
      clearInterval(timer);
      clearInterval(pollTimer);
      supabase.removeChannel(sub);
    };
  }, []);

  useEffect(() => {
    if (viewMode !== 'media_clinics') return;
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
      }
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (e.clientY < 90) {
      setShowBar(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else if (!showModeMenu) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowBar(false), 2500);
    }
  }, [showModeMenu]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  const currentCall = queue.find(q => q.status === 'calling');
  const waitingList = queue.filter(q => q.status === 'waiting').slice(0, 8);

  const destinationLabel = (q: any) => {
    if (viewMode === 'doctors') return q.doctor_name || q.clinic_name || 'غير محدد';
    if (viewMode === 'clinics_doctors') return [q.clinic_name, q.doctor_name].filter(Boolean).join(' — ') || 'غير محدد';
    return q.clinic_name || 'غير محدد';
  };

  const bg = isDark ? 'bg-slate-900 text-white' : 'bg-gray-50 text-gray-900';
  const panelBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200';
  const rowBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200';
  const mutedText = isDark ? 'text-slate-300' : 'text-gray-600';

  return (
    <div className={`h-screen ${bg} flex flex-col font-sans overflow-hidden relative transition-colors duration-300`} dir="rtl" onMouseMove={handleMouseMove}>
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
      </div>

      <div className="flex-1 flex flex-col overflow-hidden" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}>
        {/* Top Header */}
        <header className={`${panelBg} px-8 py-5 flex justify-between items-center shadow-xl border-b`}>
          <div className="flex items-center gap-4">
            <Monitor className="w-10 h-10 text-emerald-500" />
            <div>
              <h1 className="text-3xl font-bold">مركز الطائر الحر الطبي</h1>
              <p className="text-emerald-500 text-sm mt-1">شاشة النداء الآلي</p>
            </div>
          </div>
          <div className={`text-3xl font-bold font-mono tracking-wider ${mutedText}`} dir="ltr">
            {currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* النداء الحالي */}
          <div className={`flex-[2] flex flex-col items-center justify-center p-12 border-l ${isDark ? 'border-slate-800' : 'border-gray-200'} relative overflow-hidden`}>
            {currentCall ? (
              <div className="text-center z-10 w-full animate-in fade-in zoom-in duration-500">
                <div className="inline-block bg-red-600 text-white px-8 py-2 rounded-full text-2xl font-bold mb-10 animate-pulse shadow-[0_0_30px_rgba(220,38,38,0.6)]">
                  النداء الحالي
                </div>
                <div className="text-[12rem] leading-none font-black text-emerald-500 mb-8 drop-shadow-2xl font-mono">
                  {currentCall.token_number}
                </div>
                <div className={`text-5xl ${mutedText} flex items-center justify-center gap-4 flex-wrap`}>
                  تفضل بالدخول إلى:
                  <span className="text-emerald-500 font-bold bg-emerald-950/10 px-6 py-3 rounded-xl border border-emerald-800/30">
                    {viewMode === 'doctors' ? <Stethoscope className="w-10 h-10 inline-block ml-3" /> : <Building2 className="w-10 h-10 inline-block ml-3" />}
                    {destinationLabel(currentCall)}
                  </span>
                </div>
              </div>
            ) : (
              <div className={`text-center text-4xl flex flex-col items-center ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                <Monitor className={`w-32 h-32 mb-6 ${isDark ? 'text-slate-800' : 'text-gray-200'}`} />
                في انتظار النداء القادم...
              </div>
            )}
          </div>

          {/* قائمة الانتظار / الميديا */}
          <div className={`flex-1 flex flex-col ${viewMode === 'media_clinics' ? 'divide-y divide-slate-700' : ''}`}>
            <div className={viewMode === 'media_clinics' ? 'flex-1 flex flex-col overflow-hidden' : 'flex-1 flex flex-col'}>
              <div className={`${panelBg} p-6 shadow-md border-b`}>
                <h3 className={`text-2xl font-bold ${mutedText} flex items-center gap-3`}>
                  <span className="relative flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500"></span>
                  </span>
                  قائمة الانتظار ({waitingList.length})
                </h3>
              </div>
              <div className="flex-1 overflow-hidden p-6">
                <div className="flex flex-col gap-4">
                  {waitingList.map((q, idx) => (
                    <div key={q.id} className={`${rowBg} border p-5 rounded-2xl flex justify-between items-center shadow-lg`}>
                      <div className="flex items-center gap-4">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>
                          {idx + 1}
                        </span>
                        <span className={`text-lg font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>{destinationLabel(q)}</span>
                      </div>
                      <span className="font-bold text-orange-500 text-4xl font-mono">{q.token_number}</span>
                    </div>
                  ))}
                  {waitingList.length === 0 && (
                    <div className={`h-full flex items-center justify-center text-xl ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                      لا يوجد مرضى في طابور الانتظار
                    </div>
                  )}
                </div>
              </div>
            </div>

            {viewMode === 'media_clinics' && (
              <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                {media.length === 0 ? (
                  <div className="text-slate-600 flex flex-col items-center gap-2">
                    <ImageIcon className="w-12 h-12" />
                    <p className="text-sm">لا توجد وسائط مضافة</p>
                  </div>
                ) : media[mediaIndex]?.media_type === 'video' ? (
                  <video key={media[mediaIndex].id} src={media[mediaIndex].url} autoPlay muted loop className="w-full h-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={media[mediaIndex]?.id} src={media[mediaIndex]?.url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
