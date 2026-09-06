'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Volume2, Monitor } from 'lucide-react';

export default function PublicCallQueuePage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [currentCalling, setCurrentCalling] = useState<any | null>(null);

  useEffect(() => {
    fetchQueue();

    const channel = supabase
      .channel('public_queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_queue' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new.status === 'calling') {
          playAudioAlert();
          setCurrentCalling(payload.new);
          
          // Clear current calling highlight after 10 seconds
          setTimeout(() => {
            setCurrentCalling((curr: any) => curr?.id === payload.new.id ? null : curr);
          }, 10000);
        }
        fetchQueue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchQueue = async () => {
    const { data } = await supabase
      .from('call_queue')
      .select('*, clinic:clinic_id(name)')
      .in('status', ['waiting', 'calling'])
      .order('updated_at', { ascending: false });
    
    if (data) {
      setQueue(data);
      // Auto-set current calling if there's any actively calling right now
      const callingNow = data.find(q => q.status === 'calling');
      if (callingNow && !currentCalling) {
        setCurrentCalling(callingNow);
      }
    }
  };

  const playAudioAlert = () => {
    try {
      // Trying to play a generic bell sound, requires user interaction first usually, 
      // but on some TV screens auto-play policies are relaxed.
      const audio = new Audio('/bell.mp3'); 
      audio.play().catch(e => console.log('Audio autoplay blocked', e));
    } catch (error) {
      console.log('Audio play error', error);
    }
  };

  // Group queue by clinic
  const groupedQueue = queue.reduce((acc, curr) => {
    const clinicName = curr.clinic?.name || 'عام';
    if (!acc[clinicName]) acc[clinicName] = [];
    acc[clinicName].push(curr);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col p-6 overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <Monitor className="w-10 h-10 text-emerald-500" />
          <div>
            <h1 className="text-4xl font-black tracking-tight">النداء الآلي للعيادات</h1>
            <p className="text-gray-400 mt-1">مركز الطائر الحر الطبي</p>
          </div>
        </div>
        <img src="/logo.png" alt="Logo" className="h-16 w-auto bg-white rounded-xl p-2" onError={(e) => e.currentTarget.style.display = 'none'} />
      </div>

      {/* Currently Calling Banner */}
      {currentCalling && (
        <div className="mb-8 animate-in slide-in-from-top-10 zoom-in-95 duration-500 fade-in">
          <div className="bg-emerald-600 rounded-3xl p-8 shadow-[0_0_50px_rgba(16,185,129,0.4)] flex justify-between items-center border-4 border-emerald-400">
            <div>
              <div className="flex items-center gap-3 mb-2 opacity-90">
                <Volume2 className="w-8 h-8 animate-pulse" />
                <span className="text-2xl font-bold uppercase tracking-widest">تفضل بالدخول</span>
              </div>
              <h2 className="text-6xl font-black mb-2">{currentCalling.patient_name}</h2>
              <p className="text-3xl font-bold text-emerald-100">الى {currentCalling.clinic?.name}</p>
            </div>
            <div className="text-[12rem] font-black leading-none text-white drop-shadow-2xl font-mono">
              {currentCalling.token_number}
            </div>
          </div>
        </div>
      )}

      {/* Waiting Lists Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start">
        {Object.entries(groupedQueue as Record<string, any[]>).map(([clinicName, patients]) => (
          <div key={clinicName} className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 shadow-xl">
            <div className="bg-gray-950 p-4 border-b border-gray-700">
              <h3 className="text-2xl font-bold text-center text-emerald-400">{clinicName}</h3>
            </div>
            <div className="p-2">
              <table className="w-full text-right">
                <thead>
                  <tr className="text-gray-500 text-sm border-b border-gray-700/50">
                    <th className="pb-2 font-medium">الرقم</th>
                    <th className="pb-2 font-medium">اسم المريض</th>
                    <th className="pb-2 font-medium text-left">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                  {patients.slice(0, 10).map((p) => (
                    <tr key={p.id} className={`transition-colors ${p.status === 'calling' ? 'bg-emerald-900/40 text-emerald-200' : 'text-gray-300'}`}>
                      <td className="py-3 font-mono font-bold text-xl">{p.token_number}</td>
                      <td className="py-3 font-bold truncate max-w-[150px]">{p.patient_name}</td>
                      <td className="py-3 text-left">
                        {p.status === 'calling' ? (
                          <span className="bg-emerald-500 text-white text-xs px-2 py-1 rounded font-bold animate-pulse">
                            بالداخل
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">
                            انتظار
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {patients.length > 10 && (
                <div className="text-center p-2 text-gray-500 text-sm bg-gray-900/50 rounded-b-xl mt-2">
                  + {patients.length - 10} في الانتظار
                </div>
              )}
              {patients.length === 0 && (
                 <div className="text-center p-8 text-gray-600 font-bold">
                   لا يوجد مرضى في الانتظار
                 </div>
              )}
            </div>
          </div>
        ))}
        {Object.keys(groupedQueue).length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-32 opacity-50">
            <Monitor className="w-24 h-24 mb-4 text-gray-700" />
            <p className="text-2xl font-bold text-gray-600">شاشة النداء جاهزة - لا يوجد مرضى في الانتظار حالياً</p>
          </div>
        )}
      </div>

    </div>
  );
}
