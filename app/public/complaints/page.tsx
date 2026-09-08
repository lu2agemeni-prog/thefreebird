'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MessageSquare, CheckCircle2, Send, ShieldCheck, RefreshCw } from 'lucide-react';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { toComplaintType } from '@/lib/types';
import { InlineError } from '@/components/ui/error-state';

// ============================================================================
// app/public/complaints/page.tsx
// صندوق الشكاوى والاقتراحات العام — محمي من السبام على 3 طبقات:
//  1) Honeypot: حقل مخفي يجب أن يبقى فارغًا (البوتات تملؤه).
//  2) CAPTCHA حسابي بسيط: "كم 3 + 4؟" يتجدد مع كل إرسال.
//  3) Rate limiting على مستوى المتصفح (localStorage) يقرأ الحد اليومي
//     من قاعدة البيانات عبر get_complaint_limits() — الطبقة الحقيقية
//     موجودة أيضًا في القاعدة (ترIGGER on_complaint_rate_limit).
// ============================================================================

const STORAGE_KEY = 'freebird_complaints_sent';

/** سجل إرسالات هذا المتصفح: تواريخ ISO (نحتفظ بآخر 24 ساعة فقط) */
function getSentTimestamps(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function recordSubmission() {
  try {
    const list = getSentTimestamps().filter((t) => Date.now() - new Date(t).getTime() < 24 * 60 * 60 * 1000);
    list.push(new Date().toISOString());
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* localStorage معطّل — نتجاهل (الحد القاعدي سيحمي) */
  }
}

function todayCount(): number {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return getSentTimestamps().filter((t) => new Date(t).getTime() >= startOfDay.getTime()).length;
}

export default function PublicComplaintsPage() {
  const [type, setType] = useState<'complaint' | 'suggestion'>('complaint');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ——— طبقات مكافحة السبام ———
  const [honeypot, setHoneypot] = useState(''); // يجب أن يبقى فارغًا
  const [captchaA, setCaptchaA] = useState(0);
  const [captchaB, setCaptchaB] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  // ——— حدود الإرسال ———
  const [dailyLimit, setDailyLimit] = useState<number | null>(null); // حد الزائر اليومي
  const [sentToday, setSentToday] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [limitsError, setLimitsError] = useState(false);

  // توليد CAPTCHA جديد (أرقام صغيرة 2..9)
  const newCaptcha = () => {
    setCaptchaA(2 + Math.floor(Math.random() * 8));
    setCaptchaB(2 + Math.floor(Math.random() * 8));
    setCaptchaAnswer('');
    setCaptchaError(null);
  };

  // عند التحميل: اقرأ الحد من القاعدة (مع تحقق بديل محلي إن فشلت القراءة)
  useEffect(() => {
    setSentToday(todayCount());
    (async () => {
      const { data, error } = await supabase.rpc('get_complaint_limits');
      if (!error && data) {
        // الزائر مجهول: نعرض له الحد المجهول الموحد
        setDailyLimit(data?.anon_limit ?? 30);
      } else {
        setLimitsError(true);
        setDailyLimit(30); // قيمة متحفظة مطابقة للافتراضي في القاعدة
      }
    })();
    newCaptcha();
  }, []);

  const remainingToday = dailyLimit !== null ? Math.max(0, dailyLimit - sentToday) : null;
  const canSubmit = message.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1) Honeypot: إن امتلأ فهو بوت — نتجاهل بصمت (نظهر رسالة نجاح وهمية)
    if (honeypot.trim() !== '') {
      setSubmitted(true);
      return;
    }

    // 2) CAPTCHA
    if (Number(captchaAnswer) !== captchaA + captchaB) {
      setCaptchaError('إجابة التحقق غير صحيحة، برجاء المحاولة مرة أخرى');
      newCaptcha();
      return;
    }

    // 3) حد الإرسال اليومي (مستوى المتصفح — القاعدة لديها الحد الحقيقي)
    if (remainingToday !== null && remainingToday <= 0) {
      setErrorMsg(
        `بلغتَ الحد اليومي المسموح به من الرسائل (${dailyLimit}). برجاء المحاولة غدًا أو التواصل هاتفيًا.`
      );
      return;
    }

    if (!canSubmit) return;

    setLoading(true);

    // تنسيق الرسالة مع بيانات التواصل الاختيارية (user_id = null للزوار)
    const contactInfo: string[] = [];
    if (name.trim()) contactInfo.push(`الاسم: ${name}`);
    if (phone.trim()) contactInfo.push(`رقم الهاتف: ${phone}`);
    const finalMessage = contactInfo.length > 0 ? `${contactInfo.join(' | ')}\n\n${message}` : message;

    const { error } = await supabase.from('complaints').insert([
      {
        type: toComplaintType(type),
        message: finalMessage,
        status: 'open',
        user_id: null,
      },
    ]);

    setLoading(false);

    if (!error) {
      recordSubmission();
      setSentToday((c) => c + 1);
      setSubmitted(true);
      newCaptcha();
      setMessage('');
      setName('');
      setPhone('');
    } else {
      const friendly = getFriendlyErrorMessage(error);
      setErrorMsg(friendly);
      newCaptcha();
      // إن كان الخطأ حدًّا يوميًا من القاعدة، حدّث العداد المحلي ليتزامن
      if (friendly.includes('الحد اليومي') || friendly.includes('العدد الأقصى')) {
        setSentToday((c) => Math.max(c, dailyLimit ?? c));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="الطائر الحر" width={96} height={48} className="w-24 h-auto mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">صندوق الاقتراحات والشكاوى</h1>
          <p className="text-gray-500">نحن نهتم برأيك لتطوير خدماتنا</p>
        </div>

        {submitted ? (
          <Card className="border-emerald-100 shadow-lg text-center p-8 animate-in zoom-in-95 duration-500">
            <CardContent className="pt-6">
              <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">تم الإرسال بنجاح</h2>
              <p className="text-gray-600 mb-6">
                شكرًا لتواصلك معنا، تم استلام رسالتك وسيتم مراجعتها من قبل الإدارة بأقرب وقت.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  newCaptcha();
                }}
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
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    الرسالة <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full border rounded-xl p-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow h-32 resize-none bg-gray-50 focus:bg-white"
                    placeholder="اكتب تفاصيل رسالتك هنا (10 أحرف على الأقل)..."
                    required
                    minLength={10}
                  />
                </div>

                {/* ——— Honeypot: مخفي عن البشر، البوتات تملؤه ——— */}
                <div className="hidden" aria-hidden="true">
                  <label>
                    لا تملأ هذا الحقل
                    <input
                      type="text"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </label>
                </div>

                {/* ——— CAPTCHA حسابي ——— */}
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    التحقق البشري: كم يساوي {captchaA} + {captchaB}؟
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      className="w-24 border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-center"
                      placeholder="؟"
                      dir="ltr"
                      required
                    />
                    <button
                      type="button"
                      onClick={newCaptcha}
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      سؤال جديد
                    </button>
                  </div>
                  {captchaError && <InlineError message={captchaError} />}
                </div>

                <InlineError message={errorMsg} />

                {/* ——— عداد الرسائل اليومي ——— */}
                {dailyLimit !== null && (
                  <p className="text-xs text-gray-400 text-center">
                    {limitsError
                      ? `الحد اليومي للرسائل: ${dailyLimit}`
                      : `متاح لك اليوم ${remainingToday} من ${dailyLimit} رسالة`}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !canSubmit}
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
