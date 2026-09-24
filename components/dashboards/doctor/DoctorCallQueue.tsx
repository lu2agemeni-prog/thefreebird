'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, Volume2, Users, Loader2, Hash, Lock, BellRing, CheckCircle2, Clock, ListChecks } from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { playQueueAnnouncement } from '@/lib/queueAudio';

export function DoctorCallQueue() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<any[]>([]);
  const [clinic, setClinic] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [doctorClinicId, setDoctorClinicId] = useState<string | null>(null);
  const [isPresent, setIsPresent] = useState(false);
  const [clinicLoadError, setClinicLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [queueLoadError, setQueueLoadError] = useState<string | null>(null);
  const [callInProgress, setCallInProgress] = useState(false);
  const [specificToken, setSpecificToken] = useState('');
  const [secretaryCallSent, setSecretaryCallSent] = useState(false);
  const [completedToday, setCompletedToday] = useState<any[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchCompletedToday = async () => {
    if (!doctorClinicId) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('call_queue')
      .select('*')
      .eq('clinic_id', doctorClinicId)
      .eq('status', 'completed')
      .gte('updated_at', todayStart.toISOString())
      .order('updated_at', { ascending: false });
    if (data) setCompletedToday(data);
  };

  const fetchQueue = async () => {
    setQueueLoadError(null);
    const { data, error } = await supabase
      .from('call_queue')
      .select('*')
      .eq('clinic_id', doctorClinicId)
      .in('status', ['waiting', 'calling'])
      .order('token_number', { ascending: true });
    if (error) {
      setQueueLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل قائمة النداء.'));
    } else {
      setQueue(data || []);
    }
    fetchCompletedToday();
  };

  const fetchDoctorClinic = async () => {
    setClinicLoadError(null);
    const { data, error } = await supabase.from('doctors').select('clinic_id, is_present').eq('profile_id', user?.id).single();
    if (error) {
      if (error.code === 'PGRST116') {
        setDoctorClinicId(null);
      } else {
        setClinicLoadError(getFriendlyErrorMessage(error, 'تعذر جلب بيانات العيادة.'));
      }
    } else if (data) {
      setDoctorClinicId(data.clinic_id);
      setIsPresent(data.is_present || false);
      if (data.clinic_id) {
        const { data: clinicData } = await supabase.from('clinics').select('name, audio_number').eq('id', data.clinic_id).single();
        if (clinicData) setClinic(clinicData);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user?.id) fetchDoctorClinic();
  }, [user]);

  useEffect(() => {
    if (doctorClinicId) {
      fetchQueue();
      const channel = supabase
        .channel('call_queue_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'call_queue', filter: `clinic_id=eq.${doctorClinicId}` }, () => {
          fetchQueue();
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [doctorClinicId]);

  const handleCallSpecific = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = parseInt(specificToken, 10);
    if (!doctorClinicId || !token) return;
    setCallInProgress(true);
    setActionError(null);
    const { data, error } = await supabase.rpc('call_specific_in_queue', {
      p_clinic_id: doctorClinicId,
      p_token: token,
    });
    setCallInProgress(false);
    if (error) {
      setActionError(getFriendlyErrorMessage(error, 'تعذر نداء هذا الرقم.'));
      return;
    }
    if (!data) {
      setActionError(`لا يوجد مريض برقم الدور ${token} في قائمة انتظار اليوم.`);
      return;
    }
    setSpecificToken('');
    fetchQueue();
    if (clinic) playQueueAnnouncement(data.token_number, clinic.name, clinic.audio_number).catch(() => {});
  };

  const updateStatus = async (id: string, newStatus: string) => {
    setActionError(null);
    const { error } = await supabase.from('call_queue').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      setActionError(getFriendlyErrorMessage(error, 'تعذر تحديث حالة النداء.'));
    } else {
      fetchQueue();
    }
  };

  const completePatient = (id: string) => {
    updateStatus(id, 'completed');
  };

  const handleCallNext = async () => {
    if (!doctorClinicId) return;
    setCallInProgress(true);
    setActionError(null);
    const { data, error } = await supabase.rpc('call_next_in_queue', { p_clinic_id: doctorClinicId });
    setCallInProgress(false);
    if (error) {
      setActionError(getFriendlyErrorMessage(error, 'تعذر نداء المريض التالي.'));
      return;
    }
    if (!data) {
      setActionError('لا يوجد مرضى في قائمة الانتظار.');
      return;
    }
    fetchQueue();
    if (clinic) playQueueAnnouncement(data.token_number, clinic.name, clinic.audio_number).catch(() => {});
  };

  const handleCallPrevious = async () => {
    if (!doctorClinicId) return;
    setCallInProgress(true);
    setActionError(null);
    const { data, error } = await supabase.rpc('call_previous_in_queue', { p_clinic_id: doctorClinicId });
    setCallInProgress(false);
    if (error) {
      setActionError(getFriendlyErrorMessage(error, 'تعذر استدعاء المريض السابق.'));
      return;
    }
    if (!data) {
      setActionError('لا يوجد نداء سابق يمكن الرجوع إليه.');
      return;
    }
    fetchQueue();
    if (clinic) playQueueAnnouncement(data.token_number, clinic.name, clinic.audio_number).catch(() => {});
  };

  const handleCallSecretary = async () => {
    // نداء فوري (Broadcast) بدون تخزين في قاعدة البيانات — بس تنبيه لحظي
    // للسكرتارية اللي فاتحة شاشة الطابور، بصوت ding.mp3 ونص على شاشتها.
    const channel = supabase.channel('secretary-calls');
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: 'call_secretary',
      payload: { clinicName: clinic?.name || 'العيادة' },
    });
    supabase.removeChannel(channel);

    setSecretaryCallSent(true);
    setTimeout(() => setSecretaryCallSent(false), 4000);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }
  if (clinicLoadError) {
    return <ErrorState message={clinicLoadError} onRetry={fetchDoctorClinic} />;
  }

  if (!doctorClinicId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-8 h-8 text-emerald-600" />
          <h2 className="text-3xl font-bold text-gray-800">النداء الآلي</h2>
        </div>
        <div className="p-8 text-center text-gray-500 font-bold bg-white rounded-xl border border-gray-200">أنت غير مسجل في أي عيادة حاليًا. يرجى مراجعة الإدارة لربط حسابك بعيادة.</div>
      </div>
    );
  }

  if (!isPresent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-8 h-8 text-emerald-600" />
          <h2 className="text-3xl font-bold text-gray-800">النداء الآلي</h2>
        </div>
        <div className="p-10 text-center bg-white rounded-2xl border border-amber-200 flex flex-col items-center gap-4">
          <div className="p-4 bg-amber-100 text-amber-600 rounded-full">
            <Lock className="w-8 h-8" />
          </div>
          <p className="text-xl font-bold text-gray-800">النداء الآلي غير مفعّل حاليًا</p>
          <p className="text-gray-500 max-w-md">
            لتفعيل النداء يجب التواجد بالمركز والتفعيل من خلال السكرتارية — بمجرد ما تسجّل السكرتارية حضورك، هتقدر تستخدم شاشة النداء فورًا.
          </p>
        </div>
      </div>
    );
  }

  const calling = queue.filter(q => q.status === 'calling');
  const waiting = queue.filter(q => q.status === 'waiting');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">النداء الآلي</h2>
      </div>

      {(queueLoadError || actionError) && (
        <InlineError message={queueLoadError || actionError} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={handleCallNext}
          disabled={callInProgress}
          className="bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 disabled:opacity-50"
        >
          العميل التالي
        </button>
        <button
          onClick={handleCallPrevious}
          disabled={callInProgress}
          className="bg-gray-100 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-200 disabled:opacity-50"
        >
          العميل السابق
        </button>
      </div>

      <button
        onClick={handleCallSecretary}
        className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl transition-colors ${
          secretaryCallSent ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-500 text-white hover:bg-amber-600'
        }`}
      >
        {secretaryCallSent ? <CheckCircle2 className="w-5 h-5" /> : <BellRing className="w-5 h-5" />}
        {secretaryCallSent ? 'تم إرسال النداء للسكرتارية' : 'نداء السكرتارية'}
      </button>

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
          disabled={callInProgress || !specificToken}
          className="bg-blue-600 text-white font-bold px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          نداء
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-blue-100 shadow-md">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-blue-600" />
              قيد النداء حاليًا
            </h3>
            {calling.length === 0 ? (
              <p className="text-gray-500 bg-gray-50 p-4 rounded-xl text-center">لا يوجد مريض تحت النداء</p>
            ) : (
              <div className="space-y-4">
                {calling.map(p => (
                  <div key={p.id} className="bg-blue-50 border border-blue-200 p-6 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-blue-600 mb-1">رقم الدور</div>
                      <div className="text-4xl font-black text-blue-900">{p.token_number}</div>
                      <div className="font-bold text-lg text-blue-800 mt-2">{p.patient_name}</div>
                          <div className="text-xs text-blue-500 mt-1" dir="ltr">
                            {p.created_at ? new Date(p.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => completePatient(p.id)}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-sm text-sm flex items-center justify-center gap-1.5 transition-all"
                        title="تسجيل انتهاء المقابلة وخروج المريض"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>انتهت المقابلة (اكتمال)</span>
                      </button>
                      <button
                        onClick={() => updateStatus(p.id, 'waiting')}
                        className="bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all"
                        title="إعادة المريض لقيد الانتظار"
                      >
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>إعادة لقيد الانتظار</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-orange-100 shadow-md">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-orange-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              قائمة الانتظار ({waiting.length})
            </h3>
            {waiting.length === 0 ? (
              <p className="text-gray-500 bg-gray-50 p-4 rounded-xl text-center">لا يوجد مرضى في الانتظار</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {waiting.map(p => (
                  <div key={p.id} className="bg-white border border-gray-200 p-4 rounded-xl flex items-center justify-between hover:border-orange-200 transition-colors gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-orange-100 text-orange-800 w-11 h-11 rounded-full flex items-center justify-center font-black text-lg shrink-0">
                        {p.token_number}
                      </div>
                      <div className="font-bold text-gray-800 truncate">{p.patient_name}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={async () => {
                          if (!doctorClinicId) return;
                          setCallInProgress(true);
                          setActionError(null);
                          const { data, error } = await supabase.rpc('call_specific_in_queue', {
                            p_clinic_id: doctorClinicId,
                            p_token: p.token_number,
                          });
                          setCallInProgress(false);
                          if (error) {
                            setActionError(getFriendlyErrorMessage(error, 'تعذر نداء هذا المريض.'));
                            return;
                          }
                          fetchQueue();
                          if (clinic && data) playQueueAnnouncement(data.token_number, clinic.name, clinic.audio_number).catch(() => {});
                        }}
                        disabled={callInProgress}
                        className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg font-bold hover:bg-orange-200 disabled:opacity-50 text-xs flex items-center gap-1"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        نداء
                      </button>
                      <button
                        onClick={() => completePatient(p.id)}
                        className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-bold hover:bg-emerald-100 text-xs flex items-center gap-1"
                        title="تسجيل انتهاء المقابلة مباشرة إذا كشف المريض بالفعل"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        انتهت المقابلة
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* قسم الزيارات المكتملة اليوم بالعيادة مع إمكانية استعادة الدور للانتظار */}
      <Card className="border-gray-200 shadow-xs">
        <CardContent className="p-4">
          <button
            onClick={() => setShowCompleted(s => !s)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-emerald-600" />
              مكتملون اليوم بالعيادة
              <span className="text-xs bg-emerald-100 text-emerald-700 font-black px-2 py-0.5 rounded-full" dir="ltr">
                {completedToday.length}
              </span>
            </h3>
            <span className="text-xs text-gray-400 font-bold">{showCompleted ? 'إخفاء' : 'عرض'}</span>
          </button>

          {showCompleted && (
            <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pt-2 border-t border-gray-100">
              {completedToday.map(p => (
                <div key={p.id} className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-black bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded" dir="ltr">
                      #{p.token_number}
                    </span>
                    <span className="font-bold text-gray-800 text-sm">{p.patient_name}</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      انتهت الزيارة
                    </span>
                  </div>
                  <button
                    onClick={() => updateStatus(p.id, 'waiting')}
                    className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    title="إعادة المريض لقائمة الانتظار في حال العودة للاستشارة أو الكشف"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    إعادة لقيد الانتظار
                  </button>
                </div>
              ))}
              {completedToday.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">لا توجد زيارات مكتملة بعد اليوم</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}