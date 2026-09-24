'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { playQueueAnnouncement } from '@/lib/queueAudio';
import {
  Clock,
  Volume2,
  VolumeX,
  RefreshCw,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Radio,
  UserCheck,
  Stethoscope,
  Building,
  Check,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Flame,
  ArrowRight,
} from 'lucide-react';

interface ClinicInfo {
  id: string;
  name: string;
  audio_number?: number | null;
}

interface DoctorInfo {
  profile_id: string;
  clinic_id: string;
  is_present: boolean;
  specialty?: string;
  name?: string;
}

interface QueueItem {
  id: string;
  clinic_id: string;
  patient_name: string;
  phone?: string | null;
  token_number: number;
  status: 'waiting' | 'calling' | 'completed' | string;
  patient_id?: string | null;
  service_custom_name?: string | null;
  created_at?: string;
  updated_at?: string;
  clinic?: ClinicInfo | null;
}

interface PatientLiveQueueProps {
  user?: any;
  initialClinicId?: string | null;
  initialToken?: number | null;
}

export function PatientLiveQueue({ user, initialClinicId, initialToken }: PatientLiveQueueProps) {
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [doctors, setDoctors] = useState<DoctorInfo[]>([]);
  const [myTickets, setMyTickets] = useState<QueueItem[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<QueueItem | null>(null);
  const [clinicQueue, setClinicQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Manual search mode
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [manualClinicId, setManualClinicId] = useState(initialClinicId || '');
  const [manualToken, setManualToken] = useState(initialToken ? String(initialToken) : '');
  const [manualPhone, setManualPhone] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);

  // Audio & Notification controls
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);
  const lastCallingIdRef = useRef<string | null>(null);

  // UI state
  const [showFullQueue, setShowFullQueue] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Request sound unlock
  const toggleSound = () => {
    if (!soundEnabled) {
      const unlockAudio = new Audio('/audio/ding.mp3');
      unlockAudio.volume = 0.2;
      unlockAudio.play().catch(() => {});
      setSoundEnabled(true);
    } else {
      setSoundEnabled(false);
    }
  };

  // 1. Fetch clinics & present doctors
  const fetchClinicsAndDoctors = useCallback(async () => {
    try {
      const [clinicsRes, doctorsRes] = await Promise.all([
        supabase.from('clinics').select('id, name, audio_number').order('name'),
        supabase.from('doctors').select('profile_id, clinic_id, is_present, specialty, profiles(first_name, last_name)').eq('is_present', true),
      ]);

      if (clinicsRes.data) setClinics(clinicsRes.data);
      if (doctorsRes.data) {
        const formatted = doctorsRes.data.map((d: any) => ({
          profile_id: d.profile_id,
          clinic_id: d.clinic_id,
          is_present: d.is_present,
          specialty: d.specialty,
          name: d.profiles ? `د. ${d.profiles.first_name || ''} ${d.profiles.last_name || ''}`.trim() : undefined,
        }));
        setDoctors(formatted);
      }
    } catch {
      // Ignored
    }
  }, []);

  // 2. Fetch logged-in user's active queue tickets for today
  const fetchMyTickets = useCallback(async () => {
    if (!user) return [];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      // First check by patient_id
      let query = supabase
        .from('call_queue')
        .select('*, clinic:clinic_id(id, name, audio_number)')
        .eq('patient_id', user.id)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        return data as QueueItem[];
      }

      // Fallback: check by user's phone or profile name if patient_id is not set
      if (user.phone) {
        const { data: phoneData } = await supabase
          .from('call_queue')
          .select('*, clinic:clinic_id(id, name, audio_number)')
          .eq('phone', user.phone)
          .gte('created_at', todayStart.toISOString())
          .order('created_at', { ascending: false });

        if (phoneData && phoneData.length > 0) {
          return phoneData as QueueItem[];
        }
      }

      return [];
    } catch {
      return [];
    }
  }, [user]);

  // 3. Fetch entire clinic queue for the active clinic to compute positions
  const fetchClinicQueue = useCallback(async (clinicId: string) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      const { data, error } = await supabase
        .from('call_queue')
        .select('*, clinic:clinic_id(id, name, audio_number)')
        .eq('clinic_id', clinicId)
        .gte('created_at', todayStart.toISOString())
        .order('token_number', { ascending: true });

      if (!error && data) {
        return data as QueueItem[];
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  // Primary loader & sync
  const refreshAll = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);

    await fetchClinicsAndDoctors();

    // If initial token passed via props or manual params
    if (initialClinicId && initialToken) {
      setMode('manual');
      setManualClinicId(initialClinicId);
      setManualToken(String(initialToken));
      const q = await fetchClinicQueue(initialClinicId);
      setClinicQueue(q);
      const match = q.find((item) => item.token_number === initialToken);
      if (match) setSelectedTicket(match);
    } else if (user) {
      const mine = await fetchMyTickets();
      setMyTickets(mine);

      if (mine.length > 0) {
        // Pick active ticket (calling or waiting first, otherwise most recent)
        const active = mine.find((t) => t.status === 'calling' || t.status === 'waiting') || mine[0];
        setSelectedTicket((prev) => {
          if (!prev) return active;
          const fresh = mine.find((t) => t.id === prev.id);
          return fresh || active;
        });

        if (active.clinic_id) {
          const q = await fetchClinicQueue(active.clinic_id);
          setClinicQueue(q);
        }
      }
    }

    setLastRefreshed(new Date());
    setLoading(false);
    if (showIndicator) {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [fetchClinicsAndDoctors, fetchMyTickets, fetchClinicQueue, initialClinicId, initialToken, user]);

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // 4. Real-time Subscription to `call_queue` changes
  useEffect(() => {
    const channel = supabase
      .channel('live-queue-patient-tracking')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_queue' },
        (payload) => {
          // Re-fetch data smoothly
          refreshAll();

          // Check if payload is an update for selected ticket
          if (payload.new && typeof payload.new === 'object') {
            const updated = payload.new as any;
            if (selectedTicket && updated.id === selectedTicket.id) {
              if (updated.status === 'calling' && lastCallingIdRef.current !== updated.id) {
                lastCallingIdRef.current = updated.id;
                // Play audio announcement and vibrate
                if (soundEnabledRef.current) {
                  const audioNum = selectedTicket.clinic?.audio_number || null;
                  playQueueAnnouncement(updated.token_number, selectedTicket.clinic?.name || 'العيادة', audioNum);
                }
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                  navigator.vibrate([300, 150, 300, 150, 500]);
                }
              }
            }
          }
        }
      )
      .subscribe();

    // Fallback poll every 6 seconds
    const interval = setInterval(() => {
      refreshAll();
    }, 6000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [refreshAll, selectedTicket]);

  // Audio alert if selectedTicket becomes calling
  useEffect(() => {
    if (selectedTicket && selectedTicket.status === 'calling') {
      if (lastCallingIdRef.current !== `${selectedTicket.id}-${selectedTicket.status}`) {
        lastCallingIdRef.current = `${selectedTicket.id}-${selectedTicket.status}`;
        if (soundEnabled) {
          const audioNum = selectedTicket.clinic?.audio_number || null;
          playQueueAnnouncement(selectedTicket.token_number, selectedTicket.clinic?.name || 'العيادة', audioNum);
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([300, 150, 300, 150, 500]);
        }
      }
    }
  }, [selectedTicket, soundEnabled]);

  // Handle manual ticket search
  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);

    const tokenNum = parseInt(manualToken.trim(), 10);
    if (!manualClinicId) {
      setSearchError('يرجى اختيار العيادة.');
      return;
    }

    if (!tokenNum && !manualPhone.trim()) {
      setSearchError('يرجى إدخال رقم الدور أو رقم الهاتف للبحث.');
      return;
    }

    setIsRefreshing(true);
    const q = await fetchClinicQueue(manualClinicId);
    setClinicQueue(q);

    let match: QueueItem | undefined;
    if (tokenNum) {
      match = q.find((t) => t.token_number === tokenNum);
    } else if (manualPhone.trim()) {
      match = q.find((t) => t.phone && t.phone.includes(manualPhone.trim()));
    }

    if (match) {
      setSelectedTicket(match);
      setMode('manual');
    } else {
      setSearchError('لم يتم العثور على تذكرة بهذا الرقم أو الهاتف في هذه العيادة لليوم.');
    }
    setIsRefreshing(false);
  };

  // Computed metrics for active ticket
  const activeClinicId = selectedTicket?.clinic_id || manualClinicId;
  const activeClinic = clinics.find((c) => c.id === activeClinicId);
  const activeDoctor = doctors.find((d) => d.clinic_id === activeClinicId);

  // Calling token in clinic right now
  const callingTicket = clinicQueue.find((item) => item.status === 'calling');
  const callingToken = callingTicket ? callingTicket.token_number : null;

  // Patients ahead of selected ticket
  const myToken = selectedTicket?.token_number || 0;
  const waitingAhead = clinicQueue.filter(
    (item) => item.status === 'waiting' && item.token_number < myToken
  );
  const patientsAheadCount = waitingAhead.length;

  // Estimated wait time: ~10-12 mins per patient ahead
  const estWaitMinsMin = patientsAheadCount * 8;
  const estWaitMinsMax = Math.max(estWaitMinsMin, patientsAheadCount * 14);

  // Status definition
  const isCalling = selectedTicket?.status === 'calling';
  const isCompleted = selectedTicket?.status === 'completed';
  const isWaiting = selectedTicket?.status === 'waiting';

  // Copy shareable link
  const copyShareLink = () => {
    if (typeof window !== 'undefined' && selectedTicket) {
      const url = `${window.location.origin}/queue/track?clinic=${selectedTicket.clinic_id}&token=${selectedTicket.token_number}`;
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 font-sans" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-teal-400/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-bold text-emerald-100 mb-3 border border-white/20">
              <Radio className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
              <span>نظام البث اللحظي للدور (Live Queue)</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              تتبع الدور المباشر من هاتفك
            </h1>
            <p className="text-emerald-100/90 text-sm mt-1 max-w-xl leading-relaxed">
              شاهد مكانك في طابور العيادة بالثواني، وتابع وقت دخولك التقريبي براحة تامة خارج صالة الانتظار.
            </p>
          </div>

          {/* Controls: Sound toggle & Refresh */}
          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={toggleSound}
              type="button"
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border shadow-sm ${
                soundEnabled
                  ? 'bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-400'
                  : 'bg-white/15 text-white border-white/20 hover:bg-white/25'
              }`}
              title={soundEnabled ? 'التنبيه الصوتي مفعّل' : 'تفعيل صوت التنبيه عند مناداة دورك'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-white animate-bounce" />
                  الصوت مفعّل
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-emerald-200" />
                  تشغيل صوت التنبيه
                </>
              )}
            </button>

            <button
              onClick={() => refreshAll(true)}
              type="button"
              disabled={isRefreshing}
              className="p-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-2xl transition-colors disabled:opacity-50"
              title="تحديث البيانات الآن"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex bg-emerald-950/40 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setMode('auto')}
              className={`px-4 py-1.5 rounded-lg font-bold transition-colors ${
                mode === 'auto' ? 'bg-white text-emerald-900 shadow-sm' : 'text-white/80 hover:text-white'
              }`}
            >
              طابوري اليوم {myTickets.length > 0 && `(${myTickets.length})`}
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`px-4 py-1.5 rounded-lg font-bold transition-colors ${
                mode === 'manual' ? 'bg-white text-emerald-900 shadow-sm' : 'text-white/80 hover:text-white'
              }`}
            >
              تتبع تذكرة ورقية / بالرقم
            </button>
          </div>

          <span className="text-emerald-200/80 text-[11px] font-medium" dir="ltr">
            Sync: {lastRefreshed.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Manual Search Bar (if mode is manual or no auto tickets found) */}
      {mode === 'manual' && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-600" />
            البحث عن تذكرة برقم الدور أو الهاتف
          </h3>
          <form onSubmit={handleManualSearch} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-gray-600 mb-1">العيادة</label>
              <select
                value={manualClinicId}
                onChange={(e) => setManualClinicId(e.target.value)}
                className="w-full border rounded-xl p-2.5 text-sm bg-gray-50 focus:bg-white transition-colors"
                required
              >
                <option value="">-- اختر العيادة --</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-gray-600 mb-1">رقم الدور (التذكرة)</label>
              <input
                type="number"
                min="1"
                placeholder="مثال: 12"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="w-full border rounded-xl p-2.5 text-sm"
              />
            </div>

            <div className="sm:col-span-4 flex items-end">
              <button
                type="submit"
                disabled={isRefreshing}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                تتبع الدور الآن
              </button>
            </div>
          </form>

          {searchError && (
            <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {searchError}
            </div>
          )}
        </div>
      )}

      {/* Multiple user tickets tabs (if patient has >1 ticket today) */}
      {mode === 'auto' && myTickets.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {myTickets.map((t) => {
            const isSelected = selectedTicket?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={async () => {
                  setSelectedTicket(t);
                  if (t.clinic_id) {
                    const q = await fetchClinicQueue(t.clinic_id);
                    setClinicQueue(q);
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                دور رقم #{t.token_number} - {t.clinic?.name || 'العيادة'}
                {t.status === 'calling' && ' 🚨 (يُستدعى الآن)'}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Live Tracking Body */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-sm">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-bold text-base">جاري جلب حالة الطابور المباشر...</p>
          <p className="text-gray-400 text-xs mt-1">يتم الاتصال بقاعدة بيانات النداء الآلي</p>
        </div>
      ) : !selectedTicket ? (
        /* No active ticket empty state */
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-200 shadow-sm space-y-4">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-2">
            <Clock className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-black text-gray-800">لا يوجد دور مسجل لحسابك اليوم</h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto leading-relaxed">
            عندما تقوم بحجز موعد اليوم أو تسجيل زيارة في مكتب الاستقبال، سيظهر رقم دورك وتحديثاته اللحظية هنا تلقائياً.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setMode('manual')}
              className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold px-5 py-2.5 rounded-xl text-sm border border-emerald-200 transition-colors"
            >
              <Search className="w-4 h-4" />
              أو قم بإدخال رقم تذكرة ورقية يدوياً
            </button>
          </div>
        </div>
      ) : (
        /* Live Ticket Dashboard Card */
        <div className="space-y-6">
          {/* Urgent CALLING Alert Banner */}
          {isCalling && (
            <div className="p-5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-3 text-center sm:text-right">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                  <Flame className="w-7 h-7 text-yellow-300 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-wide">🚨 دورك الآن! تم النداء عليك</h3>
                  <p className="text-white/90 text-xs sm:text-sm font-medium">
                    يرجى التوجه فوراً لعيادة {activeClinic?.name || 'المركز'} والدخول لغرفة الطبيب.
                  </p>
                </div>
              </div>
              <div className="text-center sm:text-left shrink-0">
                <span className="inline-block bg-white text-red-700 font-black text-xl px-5 py-2 rounded-2xl shadow-md">
                  تذكرة #{myToken}
                </span>
              </div>
            </div>
          )}

          {/* Hero Ticket Status Card */}
          <div
            className={`bg-white rounded-3xl p-6 sm:p-8 border-2 shadow-xl transition-all relative overflow-hidden ${
              isCalling
                ? 'border-red-500 ring-4 ring-red-100'
                : isWaiting
                ? 'border-emerald-500/80 shadow-emerald-50'
                : 'border-gray-200'
            }`}
          >
            {/* Background watermark */}
            <div className="absolute top-4 left-4 text-gray-100 font-black text-8xl select-none pointer-events-none opacity-40">
              #{myToken}
            </div>

            <div className="relative z-10">
              {/* Card Header: Clinic & Doctor info */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center shrink-0">
                    <Building className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">
                      {activeClinic?.name || selectedTicket.clinic?.name || 'عيادة المركز'}
                    </h2>
                    {activeDoctor && (
                      <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{activeDoctor.name}</span>
                        {activeDoctor.specialty && <span>({activeDoctor.specialty})</span>}
                        {activeDoctor.is_present && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                            متواجد بالعيادة
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Share Ticket Button */}
                <button
                  onClick={copyShareLink}
                  type="button"
                  className="px-3.5 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      تم نسخ الرابط!
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 text-gray-500" />
                      مشاركة الرابط
                    </>
                  )}
                </button>
              </div>

              {/* Main Numbers Spotlight */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-8">
                {/* 1. Your Token */}
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 text-center flex flex-col items-center justify-center">
                  <span className="text-xs font-black text-emerald-800 uppercase tracking-wider mb-1">
                    رقم دورك الخاص
                  </span>
                  <div className="text-5xl sm:text-6xl font-black text-emerald-700 tracking-tight my-1">
                    #{myToken}
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600">
                    {selectedTicket.patient_name}
                  </span>
                </div>

                {/* 2. Now Calling */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 text-center flex flex-col items-center justify-center">
                  <span className="text-xs font-black text-amber-800 uppercase tracking-wider mb-1">
                    الدور الحالي بالعيادة
                  </span>
                  <div className="text-5xl sm:text-6xl font-black text-amber-600 tracking-tight my-1">
                    {callingToken !== null ? `#${callingToken}` : '—'}
                  </div>
                  <span className="text-[11px] font-bold text-amber-700">
                    {callingToken !== null ? 'داخل غرفة الكشف الآن' : 'في انتظار استدعاء التالي'}
                  </span>
                </div>

                {/* 3. Patients Ahead */}
                <div
                  className={`rounded-2xl p-5 text-center flex flex-col items-center justify-center border ${
                    patientsAheadCount === 0 && isWaiting
                      ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                      : 'bg-gray-50 border-gray-200 text-gray-800'
                  }`}
                >
                  <span className="text-xs font-black text-gray-600 uppercase tracking-wider mb-1">
                    المرضى أمامك
                  </span>
                  <div className="text-5xl sm:text-6xl font-black tracking-tight my-1">
                    {isCalling ? 0 : patientsAheadCount}
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">
                    {isCalling
                      ? 'دورك الآن للدخول'
                      : patientsAheadCount === 0
                      ? '⚡ أنت التالي مباشرة!'
                      : `${patientsAheadCount} مريض في صالة الانتظار`}
                  </span>
                </div>
              </div>

              {/* Progress Steps */}
              <div className="py-4 border-t border-gray-100">
                <div className="relative flex items-center justify-between text-center">
                  {/* Step 1: Booked */}
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold mb-1 shadow-sm">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-700">تم حجز الدور</span>
                  </div>

                  <div className={`h-1 flex-1 transition-all ${isWaiting || isCalling || isCompleted ? 'bg-emerald-500' : 'bg-gray-200'}`} />

                  {/* Step 2: Waiting */}
                  <div className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 shadow-sm ${
                        isWaiting
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                          : isCalling || isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      2
                    </div>
                    <span className="text-[11px] font-bold text-gray-700">في الانتظار</span>
                  </div>

                  <div className={`h-1 flex-1 transition-all ${isCalling || isCompleted ? 'bg-emerald-500' : 'bg-gray-200'}`} />

                  {/* Step 3: Calling */}
                  <div className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 shadow-sm ${
                        isCalling
                          ? 'bg-red-600 text-white ring-4 ring-red-100 animate-pulse'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      3
                    </div>
                    <span className="text-[11px] font-bold text-gray-700">جاري النداء</span>
                  </div>

                  <div className={`h-1 flex-1 transition-all ${isCompleted ? 'bg-emerald-500' : 'bg-gray-200'}`} />

                  {/* Step 4: Completed */}
                  <div className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 shadow-sm ${
                        isCompleted ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      4
                    </div>
                    <span className="text-[11px] font-bold text-gray-700">اكتمل الكشف</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Advice & Estimated Time Banner */}
              <div
                className={`mt-4 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm ${
                  isCalling
                    ? 'bg-red-50 border border-red-200 text-red-900'
                    : patientsAheadCount === 0 && isWaiting
                    ? 'bg-blue-50 border border-blue-200 text-blue-900'
                    : patientsAheadCount <= 2
                    ? 'bg-amber-50 border border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <Clock className="w-5 h-5 shrink-0 mt-0.5 text-current" />
                  <div>
                    <p className="font-bold">
                      {isCalling
                        ? 'تنبيه عاجل: توجه لغرفة الطبيب الآن'
                        : isCompleted
                        ? 'تم الانتهاء من الزيارة والكشف بنجاح'
                        : patientsAheadCount === 0
                        ? 'استعد للدخول! أنت المريض التالي بمجرد خروج الحالة الحالية'
                        : patientsAheadCount <= 2
                        ? 'اقترب دورك: يفضل التواجد في صالة الانتظار أمام باب العيادة'
                        : 'يمكنك الانتظار خارج المركز أو في كافيه مجاور بارتياح تام'}
                    </p>
                    <p className="text-xs opacity-90 mt-0.5">
                      {isWaiting && patientsAheadCount > 0
                        ? `الوقت التقريبي المتبقي لدخولك: حوالي ${estWaitMinsMin} إلى ${estWaitMinsMax} دقيقة`
                        : isWaiting && patientsAheadCount === 0
                        ? 'الوقت التقريبي: أقل من 5 دقائق'
                        : ''}
                    </p>
                  </div>
                </div>

                {!soundEnabled && isWaiting && (
                  <button
                    onClick={toggleSound}
                    type="button"
                    className="self-start sm:self-auto text-xs font-bold px-3 py-1.5 bg-white rounded-xl shadow-sm border text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-1.5"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    فعّل رنين التنبيه
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Clinic Full Queue Accordion (Transparency with masked privacy) */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowFullQueue(!showFullQueue)}
              className="w-full p-5 flex items-center justify-between text-right hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 font-bold text-gray-800 text-sm">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>عرض قائمة الانتظار الكاملة للعيادة ({clinicQueue.length} تذكرة اليوم)</span>
              </div>
              {showFullQueue ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showFullQueue && (
              <div className="p-5 pt-0 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-3">
                  يتم إخفاء أجزاء من الأسماء لحماية خصوصية المرضى. الصف المميز بالأخضر يمثل تذكرتك.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="border-b text-gray-500 font-bold bg-gray-50">
                        <th className="p-2.5">رقم الدور</th>
                        <th className="p-2.5">المريض</th>
                        <th className="p-2.5">الحالة</th>
                        <th className="p-2.5">وقت التسجيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {clinicQueue.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-gray-400">
                            لا يوجد مرضى في طابور هذه العيادة حالياً
                          </td>
                        </tr>
                      ) : (
                        clinicQueue.map((item) => {
                          const isMine = item.id === selectedTicket.id || item.token_number === myToken;
                          // Mask patient name for privacy: "أحمد محمد" -> "أحـ... مـ..."
                          const maskedName = isMine
                            ? `${item.patient_name} (أنت)`
                            : item.patient_name
                                .split(' ')
                                .map((part) => (part.length > 2 ? `${part.slice(0, 2)}...` : part))
                                .join(' ');

                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors ${
                                isMine
                                  ? 'bg-emerald-100/70 font-bold text-emerald-950 ring-1 ring-emerald-300'
                                  : item.status === 'calling'
                                  ? 'bg-amber-50 font-bold text-amber-900'
                                  : 'hover:bg-gray-50 text-gray-700'
                              }`}
                            >
                              <td className="p-2.5 font-black text-sm">#{item.token_number}</td>
                              <td className="p-2.5">{maskedName}</td>
                              <td className="p-2.5">
                                {item.status === 'calling' ? (
                                  <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
                                    يتم النداء الآن
                                  </span>
                                ) : item.status === 'waiting' ? (
                                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                    في الانتظار
                                  </span>
                                ) : (
                                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                    اكتمل
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-gray-400" dir="ltr">
                                {item.created_at
                                  ? new Date(item.created_at).toLocaleTimeString('ar-EG', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
