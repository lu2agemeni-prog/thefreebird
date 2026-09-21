'use client';

// ============================================================================
// components/dashboards/secretary/SecretaryCallQueue.tsx
// تبويب «النداء الآلي» في حساب السكرتارية.
//
// التصميم الحالي:
//   • لا توجد أزرار إضافة هنا — كل إضافة مريض بتتم من تبويب «دليل المرضى»
//     فقط (مودال AddVisitModal الموحّد).
//   • العيادة المختارة في dropdown واحد في الأعلى عشان السكرتارية تختار العيادة
//     اللي بتشتغل عليها بسرعة من غير ما تلف على شبكة أزرار.
//   • أزرار النداء الثلاثة:
//       1) الزائر التالي (call_next_in_queue) — ياخد أول واحد في الطابور.
//       2) نداء رقم معين (call_specific_in_queue) — تكتب رقم الدور يدويًا.
//       3) اختيار زائر معين — modal فيه قائمة الانتظار، تضغط على المريض مباشرة.
//   • لا توجد شاشة وسائط هنا — شاشة النداء العام عندها تبويب منفصل في المدير
//     («وسائط شاشة النداء») لتشغيل الصور والفيديوهات في صالة الانتظار.
//   • إحصائيات لحظية في الأعلى (كام عيادة مشغولة، كام في الانتظار، كام
//     اتكشف عليهم النهارده، كام دكتور متواجد).
//   • حضور الأطباء موجود كشبكة سريعة (تشغيل/إيقاف بنقرة واحدة).
//   • قائمة الانتظار مختصرة ومركّزة — المريض الجاي في النداء بعده ظاهر
//     بشكل بارز.
//   • مرضى مكتملين اليوم قابلة للطي/الفتح (بتاخد شاشتها الكاملة لما تتفتح
//     فعلاً، عشان ما تشوّشش على السكرتارية).
// ============================================================================

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import {
  Activity, Loader2, Users, Volume2, ChevronLeft,
  Hash, Stethoscope, UserCheck, CheckCircle2, ListChecks, Clock, Sparkles, Search, X,
} from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { AddQueueServiceModal } from './AddQueueServiceModal';
import { playQueueAnnouncement } from '@/lib/queueAudio';

export function SecretaryCallQueue() {
  const [queues, setQueues] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [addServiceForRow, setAddServiceForRow] = useState<any | null>(null);
  const [completedToday, setCompletedToday] = useState<any[]>([]);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [completedSearch, setCompletedSearch] = useState('');
  const [calling, setCalling] = useState(false);
  const [specificToken, setSpecificToken] = useState('');
  const [presenceBusy, setPresenceBusy] = useState<string | null>(null);
  const [secretaryAlert, setSecretaryAlert] = useState<string | null>(null);
  const [addedToast, setAddedToast] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickSearch, setPickSearch] = useState('');

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('secretary_queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_queue' }, () => fetchQueueOnly())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, () => fetchDoctorsOnly())
      .subscribe();

    const callChannel = supabase
      .channel('secretary-calls')
      .on('broadcast', { event: 'call_secretary' }, (payload) => {
        new Audio('/audio/ding.mp3').play().catch(() => {});
        setSecretaryAlert(`نداء للسكرتارية - ${payload.payload?.clinicName || 'عيادة'}`);
        setTimeout(() => setSecretaryAlert(null), 8000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(callChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchQueueOnly = async () => {
    const { data, error } = await supabase
      .from('call_queue')
      .select('*, clinic:clinic_id(name, audio_number), service:service_id(name, price), assigned_doctor:doctor_id(first_name, last_name)')
      .in('status', ['waiting', 'calling'])
      .order('token_number', { ascending: true });
    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل حالة النداء الآلي.'));
    } else if (data) {
      setQueues(data);
    }
    fetchCompletedToday();
  };

  const fetchCompletedToday = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('call_queue')
      .select('*, clinic:clinic_id(name)')
      .eq('status', 'completed')
      .gte('updated_at', todayStart.toISOString())
      .order('updated_at', { ascending: false });
    if (data) setCompletedToday(data);
  };

  const fetchDoctorsOnly = async () => {
    const { data, error } = await supabase
      .from('doctors')
      .select('profile_id, clinic_id, is_present, specialty, profiles(first_name, last_name)');
    if (!error && data) {
      setDoctors(data);
    }
  };

  const fetchAll = async () => {
    setLoadError(null);
    const { data: clinicsData } = await supabase.from('clinics').select('*').order('name');
    if (clinicsData) {
      setClinics(clinicsData);
      if (clinicsData.length && !selectedClinicId) {
        setSelectedClinicId(clinicsData[0].id);
      }
    }

    await fetchDoctorsOnly();
    await fetchQueueOnly();
    setLoading(false);
  };


  const selectedClinic = clinics.find(c => c.id === selectedClinicId);
  const waitingList = queues.filter((q: any) => q.clinic_id === selectedClinicId && q.status === 'waiting');
  const currentCalling = queues.find((q: any) => q.clinic_id === selectedClinicId && q.status === 'calling');

  // إحصائيات سريعة في الهيدر
  const stats = {
    activeClinics: queues.filter(q => q.status === 'calling').length,
    totalWaiting: queues.filter(q => q.status === 'waiting').length,
    completed: completedToday.length,
    presentDoctors: doctors.filter(d => d.is_present).length,
  };

  const announceAndRefresh = async (data: any) => {
    if (Array.isArray(data)) {
       const calling = data.find((q: any) => q.status === 'calling');
       if (calling) {
         playQueueAnnouncement(calling.token_number, calling.clinic?.name || 'العيادة', calling.clinic?.audio_number);
       }
    } else if (data && data.status === 'calling') {
       playQueueAnnouncement(data.token_number, selectedClinic?.name || 'العيادة', selectedClinic?.audio_number);
    }
    fetchQueueOnly();
  };

  const handleCallNext = async () => {
    if (!selectedClinicId) return;
    setCalling(true);
    setActionError(null);
    const { data, error } = await supabase.rpc('call_next_in_queue', { p_clinic_id: selectedClinicId });
    setCalling(false);
    if (error) {
      setActionError(getFriendlyErrorMessage(error, 'تعذر نداء المريض التالي.'));
      return;
    }
    if (!data) {
      setActionError('لا يوجد مرضى في قائمة الانتظار لهذه العيادة.');
      return;
    }
    announceAndRefresh(data);
  };

  const handleCallSpecific = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = parseInt(specificToken, 10);
    if (!selectedClinicId || !token) return;
    setCalling(true);
    setActionError(null);
    const { data, error } = await supabase.rpc('call_specific_in_queue', {
      p_clinic_id: selectedClinicId,
      p_token: token,
    });
    setCalling(false);
    if (error) {
      setActionError(getFriendlyErrorMessage(error, 'تعذر نداء هذا الرقم.'));
      return;
    }
    if (!data) {
      setActionError(`لا يوجد مريض برقم الدور ${token} في قائمة انتظار اليوم.`);
      return;
    }
    setSpecificToken('');
    announceAndRefresh(data);
  };

  const togglePresence = async (profileId: string, current: boolean) => {
    setPresenceBusy(profileId);
    const { error } = await supabase
      .from('doctors')
      .update({ is_present: !current, presence_updated_at: new Date().toISOString() })
      .eq('profile_id', profileId);
    setPresenceBusy(null);
    if (error) {
      setActionError(getFriendlyErrorMessage(error, 'تعذر تحديث حالة حضور الطبيب.'));
    } else {
      fetchDoctorsOnly();
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchAll} />;
  }

  return (
    <div className="space-y-5" dir="rtl">
      {secretaryAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-amber-500 text-white font-bold px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-pulse">
          <Activity className="w-5 h-5" /> {secretaryAlert}
        </div>
      )}

      {/* ── هيدر + إحصائيات ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800">النداء الآلي</h2>
            <p className="text-xs text-gray-500">التحكم في ترتيب النداء — إضافة المرضى من تبويب «دليل المرضى».</p>
          </div>
        </div>
      </div>

      {/* شريط إحصائيات */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Volume2 className="w-5 h-5" /></div>
          <div>
            <p className="text-[11px] text-gray-500 font-bold">عيادات مشغولة</p>
            <p className="text-xl font-black text-gray-800" dir="ltr">{stats.activeClinics}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Clock className="w-5 h-5" /></div>
          <div>
            <p className="text-[11px] text-gray-500 font-bold">في الانتظار</p>
            <p className="text-xl font-black text-gray-800" dir="ltr">{stats.totalWaiting}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-5 h-5" /></div>
          <div>
            <p className="text-[11px] text-gray-500 font-bold">مكتمل اليوم</p>
            <p className="text-xl font-black text-gray-800" dir="ltr">{stats.completed}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><UserCheck className="w-5 h-5" /></div>
          <div>
            <p className="text-[11px] text-gray-500 font-bold">أطباء متواجدون</p>
            <p className="text-xl font-black text-gray-800" dir="ltr">{stats.presentDoctors}</p>
          </div>
        </div>
      </div>

      {actionError && <InlineError message={actionError} />}
      {addedToast && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{addedToast}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ── العمود الأيسر: اختيار العيادة + الأطباء (4/12) ── */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold text-gray-700 mb-3 text-sm">اختر العيادة</h3>
              <div className="relative">
                <select
                  value={selectedClinicId}
                  onChange={(e) => setSelectedClinicId(e.target.value)}
                  className="w-full appearance-none border-2 border-emerald-200 bg-white text-gray-800 font-bold rounded-xl py-3 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                  dir="rtl"
                >
                  {clinics.length === 0 && <option value="">لا توجد عيادات نشطة</option>}
                  {clinics.map(clinic => {
                    const callingRow = queues.find(q => q.clinic_id === clinic.id && q.status === 'calling');
                    const waitingCount = queues.filter(q => q.clinic_id === clinic.id && q.status === 'waiting').length;
                    const marker = callingRow
                      ? ` — جاري النداء #${callingRow.token_number}`
                      : waitingCount > 0
                      ? ` — ${waitingCount} منتظر`
                      : '';
                    return (
                      <option key={clinic.id} value={clinic.id}>
                        {clinic.name}{marker}
                      </option>
                    );
                  })}
                </select>
                <ChevronLeft className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none rotate-90" />
              </div>
              {selectedClinic && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {(() => {
                    const callingRow = queues.find(q => q.clinic_id === selectedClinic.id && q.status === 'calling');
                    const waitingCount = queues.filter(q => q.clinic_id === selectedClinic.id && q.status === 'waiting').length;
                    return (
                      <>
                        <span className="bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded-md">
                          جاري: {callingRow ? `#${callingRow.token_number}` : 'لا يوجد'}
                        </span>
                        <span className="bg-amber-50 text-amber-700 font-bold px-2 py-1 rounded-md">
                          منتظرين: {waitingCount}
                        </span>
                      </>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold text-gray-700 mb-3 text-sm flex items-center gap-2">
                <Stethoscope className="w-4 h-4" /> حضور الأطباء
              </h3>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {doctors.map(d => (
                  <div key={d.profile_id} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                    <div className="min-w-0">
                      <div className="font-bold text-gray-800 text-sm truncate">
                        د. {d.profiles?.first_name} {d.profiles?.last_name}
                      </div>
                      {d.specialty && <div className="text-[11px] text-gray-400 truncate">{d.specialty}</div>}
                    </div>
                    <button
                      onClick={() => togglePresence(d.profile_id, !!d.is_present)}
                      disabled={presenceBusy === d.profile_id}
                      className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full transition-colors disabled:opacity-50 ${
                        d.is_present ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {d.is_present ? 'متواجد' : 'غير متواجد'}
                    </button>
                  </div>
                ))}
                {doctors.length === 0 && (
                  <div className="text-center text-sm text-gray-400 py-4">لا يوجد أطباء مسجلون</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── العمود الأيمن: المريض الحالي + أدوات النداء + الانتظار (8/12) ── */}
        <div className="lg:col-span-8 space-y-4">
          {/* كارت البطل: المريض الجاري نداؤه */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-6">
              <p className="text-xs font-bold uppercase opacity-80 mb-1">
                {selectedClinic?.name || '—'} — جاري النداء الآن
              </p>
              {currentCalling ? (
                <>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-3xl md:text-4xl font-black">{currentCalling.patient_name}</p>
                      {currentCalling.service?.name && (
                        <p className="text-sm opacity-90 mt-1">{currentCalling.service.name}</p>
                      )}
                      {currentCalling.assigned_doctor && (
                        <p className="text-xs opacity-75 mt-0.5">د. {currentCalling.assigned_doctor.first_name} {currentCalling.assigned_doctor.last_name}</p>
                      )}
                    </div>
                    <div className="text-7xl md:text-8xl font-black leading-none" dir="ltr">
                      #{currentCalling.token_number}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-2xl font-bold opacity-90">لا يوجد نداء حالي</p>
                  <p className="text-sm opacity-70 mt-1">اختر عيادة واضغط «النداء التالي» للبدء</p>
                </div>
              )}
            </div>
          </Card>

          {/* أزرار النداء */}
          <Card className="border-emerald-100">
            <CardContent className="p-5 space-y-3">
              <button
                onClick={handleCallNext}
                disabled={calling || !selectedClinicId}
                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50 text-lg"
              >
                {calling ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronLeft className="w-5 h-5" />}
                الزائر التالي
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <form onSubmit={handleCallSpecific} className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      value={specificToken}
                      onChange={(e) => setSpecificToken(e.target.value)}
                      placeholder="رقم الدور..."
                      className="w-full border rounded-lg py-2.5 pr-9 pl-3 bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={calling || !specificToken || !selectedClinicId}
                    className="bg-blue-600 text-white font-bold px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm whitespace-nowrap"
                  >
                    نداء رقم معين
                  </button>
                </form>

                <button
                  onClick={() => { setPickOpen(true); setPickSearch(''); }}
                  disabled={!selectedClinicId}
                  className="bg-purple-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                >
                  <Users className="w-4 h-4" />
                  اختيار زائر معين
                </button>
              </div>
            </CardContent>
          </Card>

          {/* قائمة الانتظار — المريض التالي واضح في الأعلى */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold text-gray-700 mb-3 text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                قائمة الانتظار
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full" dir="ltr">{waitingList.length}</span>
              </h3>
              {waitingList.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-6">
                  لا يوجد مرضى في الانتظار
                  <br />
                  <span className="text-xs">أضف المرضى من تبويب «دليل المرضى»</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {waitingList.map((q, idx) => {
                    const hasRemaining = (q.remaining_amount || 0) > 0;
                    const isNext = idx === 0;
                    return (
                      <div key={q.id} className={`p-3 rounded-xl border transition-colors ${
                        isNext ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-200' : 'bg-white border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            {isNext && (
                              <span className="text-[10px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> التالي
                              </span>
                            )}
                            <span className="font-bold text-gray-800 truncate">{q.patient_name}</span>
                          </div>
                          <span className={`text-lg font-black ${isNext ? 'text-emerald-700' : 'text-gray-600'}`} dir="ltr">
                            #{q.token_number}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                          {q.phone && <span dir="ltr">{q.phone}</span>}
                          {q.service?.name && <span>{q.service.name}</span>}
                          {q.assigned_doctor && (
                            <span>د. {q.assigned_doctor.first_name} {q.assigned_doctor.last_name}</span>
                          )}
                        </div>
                        {(q.paid_amount > 0 || hasRemaining) && (
                          <div className="flex gap-3 mt-1 text-xs font-bold">
                            {q.paid_amount > 0 && <span className="text-emerald-600">مدفوع: {q.paid_amount} ج.م</span>}
                            {hasRemaining && <span className="text-red-500">متبقي: {q.remaining_amount} ج.م</span>}
                          </div>
                        )}
                        <button
                          onClick={() => setAddServiceForRow(q)}
                          className="mt-1.5 text-xs font-bold text-emerald-600 hover:underline"
                        >
                          + ضم خدمة
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* مكتملين اليوم — قابلة للطي عشان ما تشوّشش */}
          <Card>
            <CardContent className="p-4">
              <button
                onClick={() => setCompletedOpen(o => !o)}
                className="w-full flex items-center justify-between"
              >
                <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                  <ListChecks className="w-4 h-4" />
                  مكتملون اليوم
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full" dir="ltr">{completedToday.length}</span>
                </h3>
                <span className="text-xs text-gray-400">{completedOpen ? 'إخفاء' : 'عرض'}</span>
              </button>
              {completedOpen && (
                <>
                  <input
                    type="text"
                    value={completedSearch}
                    onChange={(e) => setCompletedSearch(e.target.value)}
                    placeholder="بحث بالاسم..."
                    className="w-full border rounded-lg p-2 text-sm mb-2 mt-3 bg-white"
                  />
                  <div className="max-h-56 overflow-y-auto space-y-1.5">
                    {completedToday
                      .filter(q => q.patient_name?.toLowerCase().includes(completedSearch.toLowerCase()))
                      .map(q => (
                        <div key={q.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 text-sm hover:bg-gray-50">
                          <div className="min-w-0">
                            <span className="font-bold text-gray-700 truncate block">{q.patient_name}</span>
                            {q.clinic?.name && <span className="text-[11px] text-gray-400">{q.clinic.name}</span>}
                          </div>
                          <button
                            onClick={() => setAddServiceForRow(q)}
                            className="text-xs font-bold text-emerald-600 hover:underline shrink-0"
                          >
                            + ضم خدمة
                          </button>
                        </div>
                      ))}
                    {completedToday.length === 0 && (
                      <div className="text-center text-sm text-gray-400 py-4">لا يوجد مرضى مكتملين اليوم بعد</div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {addServiceForRow && (
        <AddQueueServiceModal
          queueId={addServiceForRow.id}
          clinicId={addServiceForRow.clinic_id}
          patientName={addServiceForRow.patient_name}
          onClose={() => setAddServiceForRow(null)}
          onChanged={() => { fetchQueueOnly(); }}
        />
      )}

      {/* مودال «اختيار زائر معين»: قائمة الانتظار بالكامل، اضغط على مريض لندائه */}
      {pickOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                اختيار زائر معين — {selectedClinic?.name || ''}
              </h3>
              <button onClick={() => setPickOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b">
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={pickSearch}
                  onChange={(e) => setPickSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو رقم الدور..."
                  className="w-full border rounded-lg py-2.5 pr-9 pl-3 bg-white"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {waitingList.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">لا يوجد مرضى في الانتظار لهذه العيادة</p>
              ) : (
                waitingList
                  .filter(q => {
                    const q2 = pickSearch.trim().toLowerCase();
                    if (!q2) return true;
                    return q.patient_name?.toLowerCase().includes(q2) || String(q.token_number).includes(q2);
                  })
                  .map(q => (
                    <button
                      key={q.id}
                      onClick={async () => {
                        // استخدم نفس RPC الموجود — call_specific_in_queue
                        setPickOpen(false);
                        setCalling(true);
                        setActionError(null);
                        const { data, error } = await supabase.rpc('call_specific_in_queue', {
                          p_clinic_id: selectedClinicId,
                          p_token: q.token_number,
                        });
                        setCalling(false);
                        if (error) {
                          setActionError(getFriendlyErrorMessage(error, 'تعذر نداء هذا الزائر.'));
                          return;
                        }
                        if (!data) {
                          setActionError('تعذر نداء هذا الزائر — ربما تم حذفه من الطابور.');
                          return;
                        }
                        announceAndRefresh(data);
                      }}
                      className="w-full text-right p-3 rounded-xl border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-colors flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-gray-800 truncate">{q.patient_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {q.service?.name && <span>{q.service.name}</span>}
                          {q.assigned_doctor && <span> · د. {q.assigned_doctor.first_name} {q.assigned_doctor.last_name}</span>}
                        </p>
                      </div>
                      <span className="text-xl font-black text-emerald-700 shrink-0" dir="ltr">#{q.token_number}</span>
                    </button>
                  ))
              )}
            </div>

            <div className="p-3 border-t text-center">
              <button
                onClick={() => setPickOpen(false)}
                className="text-sm font-bold text-gray-500 hover:text-gray-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
