'use client';

// ============================================================================
// components/dashboards/secretary/SecretaryCallQueue.tsx
// شاشة النداء الآلي — عمود يسار 30% (شبكة العيادات + حضور الأطباء)،
// عمود يمين 70% (عرض وسائط + أزرار التحكم بالنداء + قائمة الانتظار).
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import {
  Activity, Plus, Loader2, Users, Volume2, CheckCircle2,
  ChevronRight, ChevronLeft, Hash, Stethoscope, ImageIcon, UserCheck, PlusCircle,
} from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { AddPatientModal } from './AddPatientModal';
import { AddExistingPatientModal } from './AddExistingPatientModal';
import { AddQueueServiceModal } from './AddQueueServiceModal';
import { playQueueAnnouncement } from '@/lib/queueAudio';

export function SecretaryCallQueue() {
  const [queues, setQueues] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddExistingModal, setShowAddExistingModal] = useState(false);
  const [addServiceForRow, setAddServiceForRow] = useState<any | null>(null);
  const [completedToday, setCompletedToday] = useState<any[]>([]);
  const [completedSearch, setCompletedSearch] = useState('');
  const [addedToast, setAddedToast] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const [specificToken, setSpecificToken] = useState('');
  const [presenceBusy, setPresenceBusy] = useState<string | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('secretary_queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_queue' }, () => fetchQueueOnly())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, () => fetchDoctorsOnly())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // دوران بسيط للوسائط كل 8 ثواني للصور (الفيديو بيكمل لوحده)
  useEffect(() => {
    if (media.length < 2) return;
    const timer = setInterval(() => setMediaIndex(i => (i + 1) % media.length), 8000);
    return () => clearInterval(timer);
  }, [media.length]);

  const fetchAll = async () => {
    setLoadError(null);
    setLoading(true);
    // امسح أي حضور من يوم سابق قبل ما نعرض القائمة
    await supabase.rpc('reset_stale_doctor_presence');
    const [clinicsRes, doctorsRes, mediaRes] = await Promise.all([
      supabase.from('clinics').select('*').eq('is_active', true),
      supabase.from('doctors').select('profile_id, clinic_id, specialty, is_present, profiles(first_name, last_name)'),
      supabase.from('queue_media').select('*').eq('is_active', true).order('display_order', { ascending: true }),
    ]);

    if (clinicsRes.error) {
      setLoadError(getFriendlyErrorMessage(clinicsRes.error, 'تعذر تحميل قائمة العيادات.'));
      setLoading(false);
      return;
    }
    setClinics(clinicsRes.data || []);
    if (clinicsRes.data?.length && !selectedClinicId) {
      setSelectedClinicId(clinicsRes.data[0].id);
    }
    if (doctorsRes.data) setDoctors(doctorsRes.data);
    if (mediaRes.data) setMedia(mediaRes.data);

    await fetchQueueOnly();
    setLoading(false);
  };

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
      .gte('created_at', todayStart.toISOString())
      .order('updated_at', { ascending: false })
      .limit(100);
    if (data) setCompletedToday(data);
  };

  const fetchDoctorsOnly = async () => {
    const { data } = await supabase
      .from('doctors')
      .select('profile_id, clinic_id, specialty, is_present, profiles(first_name, last_name)');
    if (data) setDoctors(data);
  };

  const selectedClinic = clinics.find(c => c.id === selectedClinicId);
  const clinicQueue = queues.filter(q => q.clinic_id === selectedClinicId);
  const currentCalling = clinicQueue.find(q => q.status === 'calling');
  const waitingList = clinicQueue.filter(q => q.status === 'waiting');

  const announceAndRefresh = useCallback(async (row: any) => {
    if (!row || !selectedClinic) return;
    fetchQueueOnly();
    try {
      await playQueueAnnouncement(row.token_number, selectedClinic.name, selectedClinic.audio_number);
    } catch {
      // النداء المرئي على الشاشة يفضل شغال حتى لو الصوت فشل
    }
  }, [selectedClinic]);

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

  const handleCallPrevious = async () => {
    if (!selectedClinicId) return;
    setCalling(true);
    setActionError(null);
    const { data, error } = await supabase.rpc('call_previous_in_queue', { p_clinic_id: selectedClinicId });
    setCalling(false);
    if (error) {
      setActionError(getFriendlyErrorMessage(error, 'تعذر استدعاء المريض السابق.'));
      return;
    }
    if (!data) {
      setActionError('لا يوجد نداء سابق يمكن الرجوع إليه.');
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
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-emerald-600" />
          <h2 className="text-3xl font-bold text-gray-800">إدارة النداء الآلي</h2>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddExistingModal(true)}
            className="bg-blue-600 text-white font-bold px-5 py-3 rounded-xl hover:bg-blue-700 flex items-center gap-2 shadow-sm"
          >
            <UserCheck className="w-5 h-5" /> مريض مسجّل
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 text-white font-bold px-5 py-3 rounded-xl hover:bg-emerald-700 flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-5 h-5" /> مريض جديد
          </button>
        </div>
      </div>

      {actionError && <InlineError message={actionError} />}
      {addedToast && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{addedToast}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── العمود الأيسر 30% ── */}
        <div className="w-full lg:w-[30%] space-y-6">
          {/* شبكة العيادات */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold text-gray-700 mb-3 text-sm">العيادات</h3>
              <div className="grid grid-cols-2 gap-3">
                {clinics.map(clinic => {
                  const callingRow = queues.find(q => q.clinic_id === clinic.id && q.status === 'calling');
                  const isSelected = clinic.id === selectedClinicId;
                  return (
                    <button
                      key={clinic.id}
                      onClick={() => setSelectedClinicId(clinic.id)}
                      className={`text-right p-3 rounded-xl border transition-colors ${
                        isSelected ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-white border-gray-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className={`text-xs font-bold mb-1 truncate ${isSelected ? 'text-emerald-50' : 'text-gray-500'}`}>
                        {clinic.name}
                      </div>
                      <div className={`text-2xl font-black ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                        {callingRow ? `#${callingRow.token_number}` : '—'}
                      </div>
                    </button>
                  );
                })}
                {clinics.length === 0 && (
                  <div className="col-span-2 text-center text-sm text-gray-400 py-4">لا توجد عيادات نشطة</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* حضور الأطباء */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold text-gray-700 mb-3 text-sm flex items-center gap-2">
                <Stethoscope className="w-4 h-4" /> الأطباء المتواجدون اليوم
              </h3>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {doctors.map(d => (
                  <div key={d.profile_id} className="flex items-center justify-between p-2 rounded-lg border border-gray-100">
                    <div className="min-w-0">
                      <div className="font-bold text-gray-800 text-sm truncate">
                        {d.profiles?.first_name} {d.profiles?.last_name}
                      </div>
                      {d.specialty && <div className="text-xs text-gray-400 truncate">{d.specialty}</div>}
                    </div>
                    <button
                      onClick={() => togglePresence(d.profile_id, !!d.is_present)}
                      disabled={presenceBusy === d.profile_id}
                      className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full transition-colors disabled:opacity-50 ${
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

        {/* ── العمود الأيمن 70% ── */}
        <div className="w-full lg:w-[70%] space-y-6">
          {/* منطقة عرض الوسائط */}
          <Card className="overflow-hidden">
            <div className="bg-gray-900 aspect-video flex items-center justify-center relative">
              {media.length === 0 ? (
                <div className="text-slate-500 flex flex-col items-center gap-2">
                  <ImageIcon className="w-12 h-12" />
                  <span className="text-sm">لا توجد وسائط معروضة حاليًا</span>
                </div>
              ) : media[mediaIndex]?.media_type === 'video' ? (
                <video
                  key={media[mediaIndex].id}
                  src={media[mediaIndex].url}
                  className="w-full h-full object-contain"
                  autoPlay muted loop playsInline
                />
              ) : (
                <img
                  key={media[mediaIndex]?.id}
                  src={media[mediaIndex]?.url}
                  alt=""
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </Card>

          {/* أزرار التحكم بالنداء */}
          <Card className="border-emerald-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-lg">
                  التحكم بالنداء — {selectedClinic?.name || '—'}
                </h3>
                {currentCalling && (
                  <span className="flex items-center gap-1 text-sm font-bold bg-blue-100 text-blue-800 px-3 py-1 rounded-full animate-pulse">
                    <Volume2 className="w-4 h-4" /> جارٍ نداء #{currentCalling.token_number}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <button
                  onClick={handleCallNext}
                  disabled={calling || !selectedClinicId}
                  className="bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {calling ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronLeft className="w-5 h-5" />}
                  العميل التالي
                </button>
                <button
                  onClick={handleCallPrevious}
                  disabled={calling || !selectedClinicId}
                  className="bg-gray-100 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ChevronRight className="w-5 h-5" />
                  العميل السابق
                </button>
              </div>

              <form onSubmit={handleCallSpecific} className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={specificToken}
                    onChange={(e) => setSpecificToken(e.target.value)}
                    placeholder="نداء رقم دور محدد..."
                    className="w-full border rounded-lg py-3 pr-9 pl-3"
                  />
                </div>
                <button
                  type="submit"
                  disabled={calling || !specificToken || !selectedClinicId}
                  className="bg-blue-600 text-white font-bold px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  نداء
                </button>
              </form>
            </CardContent>
          </Card>

          {/* قائمة الانتظار للعيادة المختارة */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold text-gray-700 mb-3 text-sm flex items-center gap-2">
                <Users className="w-4 h-4" /> قائمة الانتظار ({waitingList.length})
              </h3>
              {waitingList.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-6">لا يوجد مرضى في الانتظار</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {waitingList.map(q => {
                    const hasRemaining = (q.remaining_amount || 0) > 0;
                    return (
                      <div key={q.id} className="p-3 rounded-xl border bg-white border-gray-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-800 truncate">{q.patient_name}</span>
                          <span className="text-lg font-black text-gray-600">#{q.token_number}</span>
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
                          className="mt-2 text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                        >
                          <PlusCircle className="w-3 h-3" /> ضم خدمة
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* مرضى تم الكشف عليهم اليوم — لضم خدمات إضافية (تحاليل/أشعة) */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold text-gray-700 mb-3 text-sm flex items-center gap-2">
                <Users className="w-4 h-4" /> مرضى مكتملين اليوم ({completedToday.length})
              </h3>
              <input
                type="text"
                value={completedSearch}
                onChange={(e) => setCompletedSearch(e.target.value)}
                placeholder="بحث بالاسم..."
                className="w-full border rounded-lg p-2 text-sm mb-3"
              />
              <div className="max-h-64 overflow-y-auto space-y-2">
                {completedToday
                  .filter(q => q.patient_name?.toLowerCase().includes(completedSearch.toLowerCase()))
                  .map(q => (
                    <div key={q.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 text-sm">
                      <div>
                        <span className="font-bold text-gray-700">{q.patient_name}</span>
                        <span className="text-xs text-gray-400 mr-2">{q.clinic?.name}</span>
                      </div>
                      <button
                        onClick={() => setAddServiceForRow(q)}
                        className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        <PlusCircle className="w-3 h-3" /> ضم خدمة
                      </button>
                    </div>
                  ))}
                {completedToday.length === 0 && (
                  <div className="text-center text-sm text-gray-400 py-4">لا يوجد مرضى مكتملين اليوم بعد</div>
                )}
              </div>
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

      {showAddExistingModal && (
        <AddExistingPatientModal
          onClose={() => setShowAddExistingModal(false)}
          onAdded={(token, clinicId) => {
            setShowAddExistingModal(false);
            setSelectedClinicId(clinicId);
            setAddedToast(`تم إضافة المريض للنداء برقم دور: ${token}`);
            setTimeout(() => setAddedToast(null), 5000);
            fetchQueueOnly();
          }}
        />
      )}

      {showAddModal && (
        <AddPatientModal
          onClose={() => setShowAddModal(false)}
          onAdded={(token, clinicId) => {
            setShowAddModal(false);
            setSelectedClinicId(clinicId);
            setAddedToast(`تم إضافة المريض وتسجيله برقم دور: ${token}`);
            setTimeout(() => setAddedToast(null), 5000);
            fetchQueueOnly();
          }}
        />
      )}
    </div>
  );
}