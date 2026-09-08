'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Plus, Loader2, Users, Volume2, CheckCircle2 } from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { toCallQueueStatus } from '@/lib/types';

export function SecretaryCallQueue() {
  const [queues, setQueues] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addedToken, setAddedToken] = useState<number | null>(null);

  // Add Patient to Queue State
  const [selectedClinic, setSelectedClinic] = useState('');
  const [patientName, setPatientName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('secretary_queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_queue' }, () => {
        fetchQueueOnly();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setLoadError(null);
    setLoading(true);
    const { data: clinicsData, error: clinicsError } = await supabase.from('clinics').select('*');
    if (clinicsError) {
      setLoadError(getFriendlyErrorMessage(clinicsError, 'تعذر تحميل قائمة العيادات.'));
    } else if (clinicsData) {
      setClinics(clinicsData);
    }
    await fetchQueueOnly();
    setLoading(false);
  };

  const fetchQueueOnly = async () => {
    const { data, error } = await supabase
      .from('call_queue')
      .select('*, clinic:clinic_id(name)')
      .in('status', ['waiting', 'calling'])
      .order('token_number', { ascending: true });
    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل حالة النداء الآلي.'));
    } else if (data) {
      setQueues(data);
    }
  };

  const handleAddToQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinic || !patientName.trim()) return;

    setAdding(true);
    setAddError(null);
    setAddedToken(null);

    // استدعاء RPC ذري (advisory lock) لمنع سباق تكرار الأرقام — بديل عن
    // قراءة آخر رقم ثم الإضافة (كان يسبب تكرار الرقم عند النداء المتزامن).
    const { data: token, error: rpcError } = await supabase.rpc('get_next_queue_number', {
      p_clinic_id: selectedClinic,
    });

    if (rpcError || token === null || token === undefined) {
      setAdding(false);
      setAddError(getFriendlyErrorMessage(rpcError, 'حدث خطأ أثناء إضافة المريض للنداء الآلي.'));
      return;
    }

    const { error } = await supabase.from('call_queue').insert([{
      clinic_id: selectedClinic,
      patient_name: patientName.trim(),
      token_number: token,
      status: 'waiting'
    }]);

    setAdding(false);
    if (!error) {
      setAddedToken(token as number);
      setPatientName('');
      fetchQueueOnly();
    } else {
      setAddError(getFriendlyErrorMessage(error, 'حدث خطأ أثناء إضافة المريض للنداء الآلي.'));
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">إدارة النداء الآلي</h2>
      </div>

      {loadError ? (
        <ErrorState message={loadError} onRetry={fetchData} />
      ) : (
        <>
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="bg-emerald-50 rounded-t-xl border-b border-emerald-100">
              <CardTitle className="text-emerald-800 text-lg">إضافة مريض للانتظار</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleAddToQueue} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-1/3">
                  <label className="block text-sm font-bold text-gray-700 mb-1">العيادة</label>
                  <select
                    value={selectedClinic}
                    onChange={(e) => setSelectedClinic(e.target.value)}
                    className="w-full border rounded-lg p-3 bg-white"
                    required
                  >
                    <option value="">-- اختر العيادة --</option>
                    {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="w-full md:w-1/3">
                  <label className="block text-sm font-bold text-gray-700 mb-1">اسم المريض</label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full border rounded-lg p-3"
                    placeholder="الاسم الثلاثي..."
                    required
                  />
                </div>
                <div className="w-full md:w-1/3">
                  <button
                    type="submit"
                    disabled={adding || !selectedClinic || !patientName.trim()}
                    className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    إضافة للنداء
                  </button>
                </div>
              </form>

              {addError && <div className="mt-4"><InlineError message={addError} /></div>}
              {addedToken !== null && (
                <div className="mt-4 flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>تم إضافة المريض برقم دور: {addedToken}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6">
            {clinics.map(clinic => {
              const clinicQueue = queues.filter(q => q.clinic_id === clinic.id);
              if (clinicQueue.length === 0) return null;

              return (
                <Card key={clinic.id} className="overflow-hidden">
                  <div className="bg-gray-100 p-4 border-b flex items-center gap-2 font-bold text-gray-800 text-lg">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    {clinic.name}
                  </div>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50">
                      {clinicQueue.map(q => {
                        const qStatus = toCallQueueStatus(q.status);
                        return (
                          <div key={q.id} className={`p-4 rounded-xl border ${qStatus === 'calling' ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-200'}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div className={`text-2xl font-black ${qStatus === 'calling' ? 'text-blue-700' : 'text-gray-700'}`}>
                                #{q.token_number}
                              </div>
                              {qStatus === 'calling' ? (
                                <span className="flex items-center gap-1 text-xs font-bold bg-blue-200 text-blue-800 px-2 py-1 rounded animate-pulse">
                                  <Volume2 className="w-3 h-3" /> بالداخل
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs font-bold bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                  <Users className="w-3 h-3" /> انتظار
                                </span>
                              )}
                            </div>
                            <div className="font-bold text-gray-900 truncate" title={q.patient_name}>{q.patient_name}</div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {queues.length === 0 && (
              <div className="p-12 text-center text-gray-500 font-bold bg-white rounded-xl border">لا يوجد مرضى في شاشات النداء الآلي حالياً</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
