'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, CheckCircle2, Clock, Send, Loader2, Calendar } from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { toConsultationStatus, CONSULTATION_STATUS_LABELS, CONSULTATION_STATUS_COLORS } from '@/lib/types';

const PAGE_SIZE = 10;

export function DoctorConsultations() {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | 'answered' | 'pending'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [repliedOk, setRepliedOk] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchConsultations();
    }
  }, [user]);

  async function fetchConsultations() {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('consultations')
      .select('*, patient:patient_id(first_name, last_name, patient_code)')
      .eq('doctor_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل الاستشارات الموجهة إليك.'));
    } else if (data) {
      setConsultations(data);
    }
    setLoading(false);
  };

  const handleReply = async (id: string) => {
    if (!replyMessage.trim()) return;

    setSending(true);
    setReplyError(null);
    const { error } = await supabase
      .from('consultations')
      .update({
        reply: replyMessage.trim(),
        status: 'answered'
      })
      .eq('id', id);

    setSending(false);
    if (!error) {
      setRepliedOk(id);
      setReplyingTo(null);
      setReplyMessage('');
      setConsultations(prev => prev.map(c => (c.id === id ? { ...c, reply: replyMessage.trim(), status: 'answered' } : c)));
    } else {
      setReplyError(getFriendlyErrorMessage(error, 'حدث خطأ أثناء إرسال الرد.'));
    }
  };

  const filteredConsultations = useMemo(() => {
    return consultations.filter(c => {
      const cStatus = toConsultationStatus(c.status);
      if (statusFilter === 'answered' && cStatus !== 'answered') return false;
      if (statusFilter === 'pending' && cStatus === 'answered') return false;
      const dateStr = new Date(c.created_at).toISOString().slice(0, 10);
      if (dateFrom && dateStr < dateFrom) return false;
      if (dateTo && dateStr > dateTo) return false;
      return true;
    });
  }, [consultations, statusFilter, dateFrom, dateTo]);

  useEffect(() => { const t = setTimeout(() => setPage(0), 0); return () => clearTimeout(t); }, [statusFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredConsultations.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filteredConsultations.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">استشارات المرضى</h2>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="border rounded-lg p-2.5 text-sm bg-white">
            <option value="all">كل الحالات</option>
            <option value="answered">تم الرد عليها</option>
            <option value="pending">لم يتم الرد بعد</option>
          </select>
          <div className="flex items-center gap-2 text-gray-500 text-sm font-bold">
            <Calendar className="w-4 h-4" /> من
          </div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border rounded-lg p-2 text-sm" />
          <span className="text-gray-400 text-sm">إلى</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border rounded-lg p-2 text-sm" />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={fetchConsultations} />
        ) : filteredConsultations.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center flex flex-col items-center border border-gray-100">
            <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-xl text-gray-500 font-bold mb-2">
              {consultations.length === 0 ? 'لا توجد استشارات موجهة إليك حالياً.' : 'لا توجد استشارات مطابقة للفلتر المحدد.'}
            </p>
          </div>
        ) : (
          pageItems.map(c => {
            const cStatus = toConsultationStatus(c.status);
            return (
              <Card key={c.id} className="overflow-hidden">
                <div className="bg-gray-50 p-4 border-b flex justify-between items-center flex-wrap gap-2">
                  <div className="font-bold text-gray-800 flex items-center gap-2">
                    من المريض: {c.patient?.first_name} {c.patient?.last_name}
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-mono">{c.patient?.patient_code}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500" dir="ltr">{new Date(c.created_at).toLocaleDateString('ar-EG')}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${CONSULTATION_STATUS_COLORS[cStatus]}`}>
                      {cStatus === 'pending' ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      {CONSULTATION_STATUS_LABELS[cStatus]}
                    </span>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-gray-500 mb-2">السؤال/الاستفسار:</h4>
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 rounded-xl border border-gray-100">
                      {c.message}
                    </p>
                  </div>

                  {cStatus === 'answered' && c.reply ? (
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
                          {replyError && <InlineError message={replyError} />}
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
                              onClick={() => { setReplyingTo(null); setReplyMessage(''); setReplyError(null); }}
                              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-200"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {repliedOk === c.id && (
                            <div className="flex items-center gap-1.5 text-emerald-700 text-sm font-bold">
                              <CheckCircle2 className="w-4 h-4" /> تم إرسال الرد بنجاح.
                            </div>
                          )}
                          <button
                            onClick={() => { setReplyingTo(c.id); setReplyError(null); }}
                            className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-lg font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2"
                          >
                            <Send className="w-4 h-4" /> إضافة رد طبي
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      {!loading && filteredConsultations.length > 0 && (
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={filteredConsultations.length} onPageChange={setPage} />
      )}
    </div>
  );
}
