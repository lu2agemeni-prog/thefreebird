'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, CheckCircle2, Clock, Send, Loader2 } from 'lucide-react';

export function DoctorConsultations() {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user) {
      fetchConsultations();
    }
  }, [user]);

  const fetchConsultations = async () => {
    const { data } = await supabase
      .from('consultations')
      .select('*, patient:patient_id(first_name, last_name, patient_code)')
      .eq('doctor_id', user?.id)
      .order('created_at', { ascending: false });
    
    if (data) setConsultations(data);
    setLoading(false);
  };

  const handleReply = async (id: string) => {
    if (!replyMessage.trim()) return;
    
    setSending(true);
    const { error } = await supabase
      .from('consultations')
      .update({
        reply: replyMessage,
        status: 'answered'
      })
      .eq('id', id);

    setSending(false);
    if (!error) {
      alert("تم إرسال الرد بنجاح.");
      setReplyingTo(null);
      setReplyMessage('');
      fetchConsultations();
    } else {
      alert("حدث خطأ أثناء الإرسال.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">استشارات المرضى</h2>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : consultations.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center flex flex-col items-center border border-gray-100">
            <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-xl text-gray-500 font-bold mb-2">لا توجد استشارات موجهة إليك حالياً.</p>
          </div>
        ) : (
          consultations.map(c => (
            <Card key={c.id} className="overflow-hidden">
              <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                <div className="font-bold text-gray-800 flex items-center gap-2">
                  من المريض: {c.patient?.first_name} {c.patient?.last_name}
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-mono">{c.patient?.patient_code}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500" dir="ltr">{new Date(c.created_at).toLocaleDateString('ar-EG')}</span>
                  {c.status === 'pending' ? (
                    <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Clock className="w-4 h-4"/> بانتظار ردك</span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> تم الرد</span>
                  )}
                </div>
              </div>
              <CardContent className="p-6">
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-500 mb-2">السؤال/الاستفسار:</h4>
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {c.message}
                  </p>
                </div>
                
                {c.status === 'answered' && c.reply ? (
                  <div>
                    <h4 className="text-sm font-bold text-emerald-700 mb-2">ردك:</h4>
                    <p className="text-emerald-900 leading-relaxed whitespace-pre-wrap bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      {c.reply}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 border-t pt-4">
                    {replyingTo === c.id ? (
                      <div className="space-y-3">
                        <textarea 
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          className="w-full border border-emerald-200 rounded-lg p-3 min-h-[100px] focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="اكتب ردك الطبي هنا..."
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleReply(c.id)}
                            disabled={sending || !replyMessage.trim()}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
                          >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            إرسال الرد
                          </button>
                          <button 
                            onClick={() => { setReplyingTo(null); setReplyMessage(''); }}
                            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-200"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setReplyingTo(c.id)}
                        className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-lg font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" /> إضافة رد طبي
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
