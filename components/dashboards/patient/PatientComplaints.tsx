'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Send, Loader2, MessageSquare, CheckCircle2, Reply } from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  toComplaintStatus,
  toComplaintType,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_COLORS,
  COMPLAINT_TYPE_LABELS,
  type ComplaintType,
} from '@/lib/types';
import { Pagination } from '@/components/ui/pagination';

export function PatientComplaints() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 6;

  const [type, setType] = useState<ComplaintType>('complaint');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchComplaints();
  }, [user]);

  const fetchComplaints = async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل سجل الشكاوى السابق.'));
    } else if (data) {
      setComplaints(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (message.trim().length < 10) {
      setSubmitError('يرجى كتابة 10 أحرف على الأقل حتى نتمكن من فهم طلبك جيدًا.');
      return;
    }

    setSending(true);
    setSubmitError(null);
    setSuccessMsg(null);
    const { error } = await supabase.from('complaints').insert([{
      user_id: user?.id,
      type: type,
      message: message.trim(),
      status: 'open'
    }]);

    setSending(false);
    if (!error) {
      setSuccessMsg(`تم إرسال ${type === 'complaint' ? 'الشكوى' : 'المقترح'} بنجاح وسيتواصل معك فريق الإدارة قريبًا.`);
      setMessage('');
      fetchComplaints();
    } else {
      setSubmitError(getFriendlyErrorMessage(error, 'حدث خطأ أثناء الإرسال. برجاء المحاولة مرة أخرى.'));
    }
  };

  const filtered = useMemo(() => complaints, [complaints]);
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">الشكاوى والمقترحات</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-gray-700">تقديم شكوى أو اقتراح جديد</CardTitle>
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
            {submitError && <InlineError message={submitError} />}
            {successMsg && (
              <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}
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
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={fetchComplaints} />
        ) : complaints.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center flex flex-col items-center border border-gray-100">
            <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-bold">لا يوجد سجل للشكاوى أو المقترحات.</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE).map(c => {
              const cType = toComplaintType(c.type);
              const cStatus = toComplaintStatus(c.status);
              return (
                <div key={c.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                  <div className="flex justify-between items-center mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      cType === 'complaint' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {COMPLAINT_TYPE_LABELS[cType]}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${COMPLAINT_STATUS_COLORS[cStatus]}`}>
                      {COMPLAINT_STATUS_LABELS[cStatus]}
                    </span>
                  </div>
                  <p className="text-gray-700 leading-relaxed text-sm flex-1">{c.message}</p>

                  {c.admin_reply && (
                    <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs mb-1.5">
                        <Reply className="w-3.5 h-3.5" />
                        رد الإدارة
                      </div>
                      <p className="text-emerald-900 text-sm leading-relaxed">{c.admin_reply}</p>
                    </div>
                  )}

                  <div className="mt-4 text-left text-xs text-gray-400" dir="ltr">
                    {new Date(c.created_at).toLocaleDateString('ar-EG')}
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} isLoading={loading} />
          </>
        )}
      </div>
    </div>
  );
}
