'use client';

// ============================================================================
// components/dashboards/manager/tabs/ReportsTab.tsx
// تبويب "التقارير الشاملة" — مستخرج من ManagerDashboard.tsx بنفس السلوك.
// كل تقرير فرعي (عيادات/ماليات/شكاوى/استشارات) بيجيب بياناته لوحده عند
// اختياره، بدل الاعتماد على حالة مشتركة مع تبويبات تانية.
// ============================================================================
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Download, Send, MessageSquare, X, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  toAppointmentStatus, APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_COLORS,
  toComplaintStatus, COMPLAINT_STATUS_LABELS, COMPLAINT_STATUS_COLORS,
  toComplaintType, COMPLAINT_TYPE_LABELS,
  toTransactionType, TRANSACTION_TYPE_LABELS,
} from '@/lib/types';

const FETCH_CAP = 2000;
const PAGE_SIZE = 10;

function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert('لا توجد بيانات لتصديرها');
    return;
  }
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row =>
    Object.values(row).map(val => {
      if (val === null || val === undefined) return '""';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  );
  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + headers + '\n' + rows.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename + '.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function ReportsTab() {
  const [reportTab, setReportTab] = useState('clinics');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.from('appointments').select('*, patient:patient_id(first_name, last_name), doctor:doctor_id(profiles(first_name, last_name)), clinics(name)').order('created_at', { ascending: false }).limit(FETCH_CAP);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل المواعيد.'));
    else setAppointments(data || []);
    setLoading(false);
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.from('transactions').select('*, profiles(first_name, last_name)').order('created_at', { ascending: false }).limit(FETCH_CAP);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل المعاملات المالية.'));
    else setTransactions(data || []);
    setLoading(false);
  }, []);

  const fetchComplaints = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.from('complaints').select('*, profiles(first_name, last_name)').order('created_at', { ascending: false }).limit(FETCH_CAP);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل الشكاوى.'));
    else setComplaints(data || []);
    setLoading(false);
  }, []);

  const fetchConsultations = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.from('consultations').select('*, patient:patient_id(first_name, last_name), doctor:doctor_id(profiles(first_name, last_name))').order('created_at', { ascending: false }).limit(FETCH_CAP);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل الاستشارات.'));
    else setConsultations(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (reportTab === 'clinics') fetchAppointments();
    if (reportTab === 'financials') fetchTransactions();
    if (reportTab === 'complaints') fetchComplaints();
    if (reportTab === 'consultations') fetchConsultations();
  }, [reportTab, fetchAppointments, fetchTransactions, fetchComplaints, fetchConsultations]);

  useEffect(() => { setPage(0); }, [search, reportTab]);

  const filteredAppointments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter(a => {
      const patient = a.patient ? `${a.patient.first_name} ${a.patient.last_name}`.toLowerCase() : '';
      const doctor = a.doctor?.profiles ? `${a.doctor.profiles.first_name} ${a.doctor.profiles.last_name}`.toLowerCase() : '';
      const clinic = (a.clinics?.name || '').toLowerCase();
      return patient.includes(q) || doctor.includes(q) || clinic.includes(q) || (a.status || '').toLowerCase().includes(q);
    });
  }, [appointments, search]);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(t => {
      const byUser = t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}`.toLowerCase() : '';
      return (t.description || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q) || (t.type || '').toLowerCase().includes(q) || byUser.includes(q);
    });
  }, [transactions, search]);

  const filteredComplaints = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return complaints;
    return complaints.filter(c => {
      const byUser = c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}`.toLowerCase() : '';
      return (c.message || '').toLowerCase().includes(q) || (c.status || '').toLowerCase().includes(q) || (c.type || '').toLowerCase().includes(q) || (c.admin_reply || '').toLowerCase().includes(q) || byUser.includes(q);
    });
  }, [complaints, search]);

  const filteredConsultations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return consultations;
    return consultations.filter(c => {
      const patient = c.patient ? `${c.patient.first_name} ${c.patient.last_name}`.toLowerCase() : '';
      const doctor = c.doctor?.profiles ? `${c.doctor.profiles.first_name} ${c.doctor.profiles.last_name}`.toLowerCase() : '';
      return (c.message || '').toLowerCase().includes(q) || (c.reply || '').toLowerCase().includes(q) || patient.includes(q) || doctor.includes(q);
    });
  }, [consultations, search]);

  const currentTotal =
    reportTab === 'clinics' ? filteredAppointments.length :
    reportTab === 'financials' ? filteredTransactions.length :
    reportTab === 'complaints' ? filteredComplaints.length :
    filteredConsultations.length;
  const safePage = Math.min(page, Math.max(0, Math.ceil(currentTotal / PAGE_SIZE) - 1));

  // ==== الرد على الشكاوى ====
  const [replyComplaintId, setReplyComplaintId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const openReplyForm = (id: string) => {
    setReplyComplaintId(id);
    setReplyText('');
    setReplyError(null);
  };

  const submitReply = async () => {
    if (!replyComplaintId) return;
    if (!replyText.trim() || replyText.trim().length < 5) {
      setReplyError('يرجى كتابة رد لا يقل عن 5 أحرف.');
      return;
    }
    setReplySaving(true);
    setReplyError(null);
    const { error } = await supabase
      .from('complaints')
      .update({ admin_reply: replyText.trim(), status: 'resolved' })
      .eq('id', replyComplaintId);
    setReplySaving(false);
    if (error) {
      setReplyError(getFriendlyErrorMessage(error, 'تعذر حفظ الرد.'));
    } else {
      setReplyText('');
      setReplyComplaintId(null);
      fetchComplaints();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setReportTab('clinics')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${reportTab === 'clinics' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>العيادات والكشوفات</button>
        <button onClick={() => setReportTab('financials')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${reportTab === 'financials' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>الحسابات والماليات</button>
        <button onClick={() => setReportTab('complaints')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${reportTab === 'complaints' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>الشكاوى والمقترحات</button>
        <button onClick={() => setReportTab('consultations')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${reportTab === 'consultations' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>الاستشارات الطبية</button>
      </div>

      <div className="max-w-md mb-2">
        <SearchInput value={search} onValueChange={setSearch} placeholder="ابحث داخل نتائج التقرير..." />
      </div>

      {reportTab === 'clinics' && (
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <div>
              <CardTitle>تقارير العيادات والكشوفات الطبية</CardTitle>
              <CardDescription>إحصائيات المواعيد والكشوفات لجميع العيادات والأطباء</CardDescription>
            </div>
            <button onClick={() => exportToCSV(appointments, 'تقرير_الكشوفات')} className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-200">
              <Download className="w-4 h-4" /> تصدير Excel
            </button>
          </CardHeader>
          <CardContent>
            {error && <ErrorState message={error} onRetry={fetchAppointments} compact />}
            {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-4 font-semibold text-gray-600">التاريخ</th>
                      <th className="p-4 font-semibold text-gray-600">المريض</th>
                      <th className="p-4 font-semibold text-gray-600">العيادة</th>
                      <th className="p-4 font-semibold text-gray-600">الطبيب</th>
                      <th className="p-4 font-semibold text-gray-600">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE).map((a) => (
                      <tr key={a.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-sm">{new Date(a.appointment_date).toLocaleString('ar-EG')}</td>
                        <td className="p-4 font-medium">{a.patient ? `${a.patient.first_name} ${a.patient.last_name}` : 'غير محدد'}</td>
                        <td className="p-4">{a.clinics?.name}</td>
                        <td className="p-4 text-gray-600">{a.doctor?.profiles ? `د. ${a.doctor.profiles.first_name} ${a.doctor.profiles.last_name}` : 'غير محدد'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${APPOINTMENT_STATUS_COLORS[toAppointmentStatus(a.status)]}`}>
                            {APPOINTMENT_STATUS_LABELS[toAppointmentStatus(a.status)]}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredAppointments.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا توجد حجوزات أو كشوفات مسجلة</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && <Pagination page={safePage} pageSize={PAGE_SIZE} total={filteredAppointments.length} onPageChange={setPage} isLoading={loading} />}
          </CardContent>
        </Card>
      )}

      {reportTab === 'financials' && (
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <div>
              <CardTitle>تقارير الحسابات والماليات الشاملة</CardTitle>
              <CardDescription>الإيرادات والمصروفات مفصلة لكل طبيب وعامل</CardDescription>
            </div>
            <button onClick={() => exportToCSV(transactions, 'التقرير_المالي')} className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-200">
              <Download className="w-4 h-4" /> تصدير Excel
            </button>
          </CardHeader>
          <CardContent>
            {error && <ErrorState message={error} onRetry={fetchTransactions} compact />}
            {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-4 font-semibold text-gray-600">التاريخ</th>
                      <th className="p-4 font-semibold text-gray-600">النوع</th>
                      <th className="p-4 font-semibold text-gray-600">بواسطة / الطبيب</th>
                      <th className="p-4 font-semibold text-gray-600">المبلغ</th>
                      <th className="p-4 font-semibold text-gray-600">البيان</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE).map((t) => (
                      <tr key={t.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {TRANSACTION_TYPE_LABELS[toTransactionType(t.type)]}
                          </span>
                        </td>
                        <td className="p-4 font-medium">{t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}` : 'غير محدد'}</td>
                        <td className="p-4 font-bold" dir="ltr">{t.amount} EGP</td>
                        <td className="p-4 text-gray-600">{t.description}</td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا توجد حركات مالية</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && <Pagination page={safePage} pageSize={PAGE_SIZE} total={filteredTransactions.length} onPageChange={setPage} isLoading={loading} />}
          </CardContent>
        </Card>
      )}

      {reportTab === 'complaints' && (
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <div>
              <CardTitle>الشكاوى والمقترحات</CardTitle>
              <CardDescription>اطلع على شكاوى ومقترحات المرضى وقم بالرد عليها</CardDescription>
            </div>
            <button onClick={() => exportToCSV(complaints, 'تقرير_الشكاوى')} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200">
              <Download className="w-4 h-4" /> تصدير Excel
            </button>
          </CardHeader>
          <CardContent>
            {error && <ErrorState message={error} onRetry={fetchComplaints} compact />}
            {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
              <div className="grid gap-4">
                {filteredComplaints.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE).map((c) => (
                  <div key={c.id} className="border rounded-xl p-4 bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${toComplaintType(c.type) === 'complaint' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {COMPLAINT_TYPE_LABELS[toComplaintType(c.type)]}
                        </span>
                        <span className="font-bold text-gray-900">{c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : 'زائر غير مسجل'}</span>
                        <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('ar-EG')}</span>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs ${COMPLAINT_STATUS_COLORS[toComplaintStatus(c.status)]}`}>
                        {COMPLAINT_STATUS_LABELS[toComplaintStatus(c.status)]}
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 mb-3">{c.message}</p>
                    {c.admin_reply && (
                      <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                        <p className="font-bold text-emerald-700 mb-1">رد الإدارة:</p>
                        {c.admin_reply}
                      </div>
                    )}
                    {toComplaintStatus(c.status) !== 'resolved' && (
                      replyComplaintId === c.id ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={3}
                            className="w-full border rounded-lg p-2 text-sm bg-white"
                            placeholder="اكتب رد الإدارة هنا (سيصل المريض كإشعار)..."
                          />
                          {replyError && <InlineError message={replyError} />}
                          <div className="flex gap-2">
                            <button onClick={submitReply} disabled={replySaving} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50">
                              {replySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              حفظ الرد وإغلاق الشكوى
                            </button>
                            <button onClick={() => setReplyComplaintId(null)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                              <X className="w-4 h-4" /> إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => openReplyForm(c.id)} className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:text-emerald-700">
                          <MessageSquare className="w-4 h-4" /> إضافة رد وإغلاق
                        </button>
                      )
                    )}
                  </div>
                ))}
                {filteredComplaints.length === 0 && (
                  <p className="text-gray-500 text-center py-8">لا توجد شكاوى أو مقترحات حتى الآن</p>
                )}
              </div>
            )}
            {!loading && <Pagination page={safePage} pageSize={PAGE_SIZE} total={filteredComplaints.length} onPageChange={setPage} isLoading={loading} />}
          </CardContent>
        </Card>
      )}

      {reportTab === 'consultations' && (
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <div>
              <CardTitle>الاستشارات الطبية</CardTitle>
              <CardDescription>الاطلاع على جميع الاستشارات الطبية بين المرضى والأطباء</CardDescription>
            </div>
            <button onClick={() => exportToCSV(consultations, 'تقرير_الاستشارات')} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200">
              <Download className="w-4 h-4" /> تصدير Excel
            </button>
          </CardHeader>
          <CardContent>
            {error && <ErrorState message={error} onRetry={fetchConsultations} compact />}
            {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
              <div className="grid gap-4">
                {filteredConsultations.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE).map((c) => (
                  <div key={c.id} className="border rounded-xl p-4 bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-sm">
                        <span className="font-bold text-gray-900">المريض: {c.patient ? `${c.patient.first_name} ${c.patient.last_name}` : 'غير محدد'}</span>
                        <span className="mx-2 text-gray-300">|</span>
                        <span className="text-emerald-700 font-bold">للطبيب: {c.doctor?.profiles ? `د. ${c.doctor.profiles.first_name} ${c.doctor.profiles.last_name}` : 'غير محدد'}</span>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-700 mb-2">
                      <p className="font-bold text-xs text-gray-500 mb-1">السؤال:</p>
                      {c.message}
                    </div>
                    {c.reply ? (
                      <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-sm text-emerald-800">
                        <p className="font-bold text-xs text-emerald-600 mb-1">الرد الطبي:</p>
                        {c.reply}
                      </div>
                    ) : (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">في انتظار الرد</span>
                    )}
                  </div>
                ))}
                {filteredConsultations.length === 0 && (
                  <p className="text-gray-500 text-center py-8">لا توجد استشارات طبية حتى الآن</p>
                )}
              </div>
            )}
            {!loading && <Pagination page={safePage} pageSize={PAGE_SIZE} total={filteredConsultations.length} onPageChange={setPage} isLoading={loading} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
