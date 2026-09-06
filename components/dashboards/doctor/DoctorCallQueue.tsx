'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, Volume2, Users, Loader2 } from 'lucide-react';

export function DoctorCallQueue() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctorClinicId, setDoctorClinicId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchDoctorClinic();
    }
  }, [user]);

  useEffect(() => {
    if (doctorClinicId) {
      fetchQueue();
      // Setup realtime subscription
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

  const fetchDoctorClinic = async () => {
    const { data } = await supabase.from('doctors').select('clinic_id').eq('profile_id', user?.id).single();
    if (data) setDoctorClinicId(data.clinic_id);
    setLoading(false);
  };

  const fetchQueue = async () => {
    const { data } = await supabase
      .from('call_queue')
      .select('*')
      .eq('clinic_id', doctorClinicId)
      .in('status', ['waiting', 'calling'])
      .order('token_number', { ascending: true });
    
    if (data) setQueue(data);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from('call_queue').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
  };

  const callPatient = (id: string) => {
    updateStatus(id, 'calling');
  };

  const completePatient = (id: string) => {
    updateStatus(id, 'completed');
  };

  if (!doctorClinicId && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-8 h-8 text-emerald-600" />
          <h2 className="text-3xl font-bold text-gray-800">النداء الآلي</h2>
        </div>
        <div className="p-8 text-center text-gray-500 font-bold bg-white rounded-xl border border-gray-200">أنت غير مسجل في أي عيادة حالياً. يرجى مراجعة الإدارة لربط حسابك بعيادة.</div>
      </div>
    );
  }

  if (loading && queue.length === 0) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  const calling = queue.filter(q => q.status === 'calling');
  const waiting = queue.filter(q => q.status === 'waiting');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">النداء الآلي</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-blue-100 shadow-md">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-blue-600" />
              قيد النداء حالياً
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
                    </div>
                    <button 
                      onClick={() => completePatient(p.id)}
                      className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-sm"
                    >
                      إنهاء المقابلة
                    </button>
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
                  <div key={p.id} className="bg-white border border-gray-200 p-4 rounded-xl flex items-center justify-between hover:border-orange-200 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="bg-orange-100 text-orange-800 w-12 h-12 rounded-full flex items-center justify-center font-black text-xl">
                        {p.token_number}
                      </div>
                      <div className="font-bold text-gray-800">{p.patient_name}</div>
                    </div>
                    <button 
                      onClick={() => callPatient(p.id)}
                      className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg font-bold hover:bg-orange-200"
                    >
                      نداء المريض
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
