'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Monitor, User, Building2 } from 'lucide-react';

export default function QueueDisplay() {
  const [queue, setQueue] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Clock
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // Initial fetch
    fetchQueue();
    
    // Realtime subscription
    const sub = supabase.channel('queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_queue' }, fetchQueue)
      .subscribe();
      
    return () => { 
      clearInterval(timer);
      supabase.removeChannel(sub); 
    };
  }, []);

  const fetchQueue = async () => {
    const { data } = await supabase
      .from('call_queue')
      .select('*, clinics(name)')
      .in('status', ['waiting', 'calling'])
      .order('updated_at', { ascending: false });
    if (data) setQueue(data);
  };

  const currentCall = queue.find(q => q.status === 'calling');
  const waitingList = queue.filter(q => q.status === 'waiting').slice(0, 8); // Show up to 8 waiting

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col font-sans overflow-hidden" dir="rtl">
      {/* Top Header */}
      <header className="bg-slate-800 px-8 py-5 flex justify-between items-center shadow-xl border-b border-slate-700">
        <div className="flex items-center gap-4">
          <Monitor className="w-10 h-10 text-emerald-500" />
          <div>
            <h1 className="text-3xl font-bold text-white">مركز الطائر الحر الطبي</h1>
            <p className="text-emerald-400 text-sm mt-1">شاشة النداء الآلي</p>
          </div>
        </div>
        <div className="text-3xl font-bold font-mono tracking-wider text-slate-300" dir="ltr">
          {currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex bg-slate-900">
        
        {/* Right Side: Current Call (Takes 2/3 of screen) */}
        <div className="flex-[2] flex flex-col items-center justify-center p-12 border-l border-slate-800 relative overflow-hidden">
          {currentCall ? (
            <div className="text-center z-10 w-full animate-in fade-in zoom-in duration-500">
              <div className="inline-block bg-red-600 text-white px-8 py-2 rounded-full text-2xl font-bold mb-10 animate-pulse shadow-[0_0_30px_rgba(220,38,38,0.6)]">
                النداء الحالي
              </div>
              
              <div className="text-[12rem] leading-none font-black text-emerald-400 mb-8 drop-shadow-2xl font-mono">
                {currentCall.token_number}
              </div>
              
              <div className="text-6xl font-bold text-white mb-8 bg-slate-800 py-6 rounded-2xl mx-12 shadow-xl flex items-center justify-center gap-4">
                <User className="w-12 h-12 text-slate-400" />
                {currentCall.patient_name}
              </div>
              
              <div className="text-5xl text-slate-300 flex items-center justify-center gap-4">
                تفضل بالدخول إلى: 
                <span className="text-emerald-400 font-bold bg-emerald-950/50 px-6 py-3 rounded-xl border border-emerald-800">
                  <Building2 className="w-10 h-10 inline-block ml-3" />
                  {currentCall.clinics?.name}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 text-4xl flex flex-col items-center">
              <Monitor className="w-32 h-32 text-slate-800 mb-6" />
              في انتظار النداء القادم...
            </div>
          )}
          
          {/* Subtle background decoration */}
          {currentCall && (
            <div className="absolute inset-0 bg-emerald-900/10 pointer-events-none"></div>
          )}
        </div>

        {/* Left Side: Waiting List (Takes 1/3 of screen) */}
        <div className="flex-1 bg-slate-900 flex flex-col">
          <div className="bg-slate-800 p-6 shadow-md border-b border-slate-700">
            <h3 className="text-2xl font-bold text-slate-300 flex items-center gap-3">
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
                <div key={q.id} className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex justify-between items-center shadow-lg transform transition-all duration-300 hover:scale-[1.02]">
                  <div className="flex items-center gap-4">
                    <span className="bg-slate-700 text-slate-400 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </span>
                    <span className="text-slate-200 text-2xl font-medium">{q.patient_name}</span>
                  </div>
                  <span className="font-bold text-orange-400 text-4xl font-mono">{q.token_number}</span>
                </div>
              ))}
              
              {waitingList.length === 0 && (
                <div className="h-full flex items-center justify-center text-slate-600 text-xl">
                  لا يوجد مرضى في طابور الانتظار
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
