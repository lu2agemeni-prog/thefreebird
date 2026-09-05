'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Send, Loader2, MessageSquare } from 'lucide-react';

export function PatientComplaints() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [type, setType] = useState('complaint');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user) fetchComplaints();
  }, [user]);

  const fetchComplaints = async () => {
    const { data } = await supabase
      .from('complaints')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    
    if (data) setComplaints(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message) return;
    
    setSending(true);
    const { error } = await supabase.from('complaints').insert([{
      user_id: user?.id,
      type: type,
      message: message,
      status: 'open'
    }]);

    setSending(false);
    if (!error) {
      alert(`تم إرسال ${type === 'complaint' ? 'الشكوى' : 'المقترح'} بنجاح وسيتواصل معك فريق الإدارة قريباً.`);
      setMessage('');
      fetchComplaints();
    } else {
      alert("حدث خطأ أثناء الإرسال.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">الشكاوى والمقترحات</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-gray-700">تقديم شكوى أو مقترح جديد</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={type === 'complaint'} 
                  onChange={() => setType('complaint')} 
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" 
                />
                <span className="font-bold text-gray-700">شكوى</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={type === 'suggestion'} 
                  onChange={() => setType('suggestion')} 
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" 
                />
                <span className="font-bold text-gray-700">مقترح للتحسين</span>
              </label>
            </div>
            <div>
              <textarea 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
                className="w-full border rounded-lg p-3 h-32 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                placeholder={type === 'complaint' ? "نعتذر لسماع ذلك، يرجى كتابة تفاصيل الشكوى ليتم حلها بأسرع وقت..." : "يسعدنا سماع أفكارك لتحسين خدمات المركز..."}
                required
              />
            </div>
            <div>
              <button 
                type="submit" 
                disabled={sending || !message.trim()}
                className="bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                إرسال للإدارة
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4 mt-8">
        <h3 className="font-bold text-xl text-gray-800 mb-4">السجل السابق</h3>
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : complaints.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center flex flex-col items-center border border-gray-100">
            <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-bold">لا يوجد سجل للشكاوى أو المقترحات.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complaints.map(c => (
              <div key={c.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    c.type === 'complaint' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {c.type === 'complaint' ? 'شكوى' : 'مقترح'}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    c.status === 'open' ? 'text-orange-600 bg-orange-50' : 'text-emerald-600 bg-emerald-50'
                  }`}>
                    {c.status === 'open' ? 'قيد المراجعة' : 'تم الرد/الحل'}
                  </span>
                </div>
                <p className="text-gray-700 leading-relaxed text-sm flex-1">{c.message}</p>
                <div className="mt-4 text-left text-xs text-gray-400" dir="ltr">
                  {new Date(c.created_at).toLocaleDateString('ar-EG')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
