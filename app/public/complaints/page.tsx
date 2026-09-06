'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, MessageSquare, CheckCircle2, Send } from 'lucide-react';

export default function PublicComplaintsPage() {
  const [type, setType] = useState('complaint');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setLoading(true);
    
    // Formatting the message to include name and phone if provided (since user_id is null for visitors)
    const contactInfo = [];
    if (name.trim()) contactInfo.push(`الاسم: ${name}`);
    if (phone.trim()) contactInfo.push(`رقم الهاتف: ${phone}`);
    
    const finalMessage = contactInfo.length > 0 
      ? `${contactInfo.join(' | ')}\n\n${message}`
      : message;

    const { error } = await supabase.from('complaints').insert([{
      type,
      message: finalMessage,
      status: 'open',
      user_id: null // Anonymous
    }]);

    setLoading(false);
    
    if (!error) {
      setSubmitted(true);
    } else {
      alert("حدث خطأ أثناء الإرسال، يرجى المحاولة مرة أخرى.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="الطائر الحر" className="w-24 h-auto mx-auto mb-4" onError={(e) => e.currentTarget.style.display = 'none'} />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">صندوق الاقتراحات والشكاوى</h1>
          <p className="text-gray-500">نحن نهتم برأيك لتطوير خدماتنا</p>
        </div>

        {submitted ? (
          <Card className="border-emerald-100 shadow-lg text-center p-8 animate-in zoom-in-95 duration-500">
            <CardContent className="pt-6">
              <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">تم الإرسال بنجاح</h2>
              <p className="text-gray-600 mb-6">شكراً لتواصلك معنا، تم استلام رسالتك وسيتم مراجعتها من قبل الإدارة بأقرب وقت.</p>
              <button 
                onClick={() => { setSubmitted(false); setMessage(''); setName(''); setPhone(''); }}
                className="text-emerald-600 font-bold hover:underline"
              >
                إرسال رسالة أخرى
              </button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg border-gray-100">
            <CardHeader className="bg-white border-b border-gray-100 rounded-t-xl">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                نموذج التواصل
              </CardTitle>
              <CardDescription>جميع البيانات الشخصية اختيارية</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                
                <div className="flex gap-4 p-1 bg-gray-100 rounded-xl">
                  <button 
                    type="button"
                    onClick={() => setType('complaint')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'complaint' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    تقديم شكوى
                  </button>
                  <button 
                    type="button"
                    onClick={() => setType('suggestion')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'suggestion' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    تقديم مقترح
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">الاسم (اختياري)</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow bg-gray-50 focus:bg-white"
                      placeholder="الاسم الثلاثي"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">رقم الهاتف (اختياري)</label>
                    <input 
                      type="tel" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow bg-gray-50 focus:bg-white"
                      placeholder="01xxxxxxxxx"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">الرسالة <span className="text-red-500">*</span></label>
                  <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full border rounded-xl p-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow h-32 resize-none bg-gray-50 focus:bg-white"
                    placeholder="اكتب تفاصيل رسالتك هنا..."
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading || !message.trim()}
                  className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  إرسال الرسالة
                </button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
