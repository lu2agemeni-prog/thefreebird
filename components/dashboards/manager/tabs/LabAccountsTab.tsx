'use client';

// ============================================================================
// components/dashboards/manager/tabs/LabAccountsTab.tsx
// تبويب "حسابات المعمل" — منفصل عن "الماليات والأرباح" العامة. فيه جزئين:
//  1) إعدادات أسعار التحاليل ونسب توزيعها (المركز/الطبيب/صاحب المعمل).
//  2) تقرير حسابات المعمل: كل نتيجة اتحصّلت فلوسها + الإجماليات + تصدير إكسيل.
// (لقطة السعر والنسب بتتاخد وقت إدخال النتيجة نفسها — التعديل هنا بيأثر
//  بس على النتائج الجديدة، مش القديمة، عشان التقارير التاريخية تفضل دقيقة).
// ============================================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { FlaskConical, Save, Loader2, Download, Calendar } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { exportRowsToExcel } from '@/lib/export-excel';

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function PricingSettings() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { price: string; clinic: string; doctor: string; owner: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('lab_test_catalog').select('*').order('display_order', { ascending: true });
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل قائمة التحاليل.'));
    else {
      setCatalog(data || []);
      const initial: typeof editing = {};
      (data || []).forEach((t: any) => {
        initial[t.id] = {
          price: String(t.price ?? 0),
          clinic: String(t.clinic_share_percent ?? 0),
          doctor: String(t.doctor_share_percent ?? 0),
          owner: String(t.lab_owner_share_percent ?? 0),
        };
      });
      setEditing(initial);
    }
    setLoading(false);
  }, []);

  useEffect(() => { const t = setTimeout(fetchCatalog, 0); return () => clearTimeout(t); }, [fetchCatalog]);

  const handleSave = async (id: string) => {
    const row = editing[id];
    setSaveError(null);
    const price = Number(row.price);
    const clinic = Number(row.clinic);
    const doctor = Number(row.doctor);
    const owner = Number(row.owner);
    if ([price, clinic, doctor, owner].some(n => isNaN(n) || n < 0)) {
      setSaveError('كل القيم يجب أن تكون أرقامًا موجبة.');
      return;
    }
    setSavingId(id);
    const { error } = await supabase.from('lab_test_catalog').update({
      price, clinic_share_percent: clinic, doctor_share_percent: doctor, lab_owner_share_percent: owner,
    }).eq('id', id);
    setSavingId(null);
    if (error) setSaveError(getFriendlyErrorMessage(error, 'تعذر حفظ التعديلات.'));
    else fetchCatalog();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>أسعار التحاليل ونسب التوزيع</CardTitle>
        <CardDescription>حدد سعر كل تحليل ونسبة كل طرف (المركز/الطبيب/صاحب المعمل) — يجب أن يكون مجموع النسب 100% لكل تحليل.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && <ErrorState message={error} onRetry={fetchCatalog} compact />}
        {saveError && <div className="mb-3"><InlineError message={saveError} /></div>}
        {loading ? <p className="text-gray-500 py-4">جاري التحميل...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-3 font-semibold text-gray-600">التحليل</th>
                  <th className="p-3 font-semibold text-gray-600">السعر (ج.م)</th>
                  <th className="p-3 font-semibold text-gray-600">نسبة المركز %</th>
                  <th className="p-3 font-semibold text-gray-600">نسبة الطبيب %</th>
                  <th className="p-3 font-semibold text-gray-600">نسبة صاحب المعمل %</th>
                  <th className="p-3 font-semibold text-gray-600">الإجمالي</th>
                  <th className="p-3 font-semibold text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {catalog.map(t => {
                  const row = editing[t.id] || { price: '0', clinic: '0', doctor: '0', owner: '0' };
                  const sum = (Number(row.clinic) || 0) + (Number(row.doctor) || 0) + (Number(row.owner) || 0);
                  return (
                    <tr key={t.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-bold text-gray-800">{t.name}</td>
                      <td className="p-2"><input type="number" min="0" step="0.01" value={row.price} onChange={(e) => setEditing(p => ({ ...p, [t.id]: { ...p[t.id], price: e.target.value } }))} className="w-24 border rounded-lg p-1.5" /></td>
                      <td className="p-2"><input type="number" min="0" step="0.01" value={row.clinic} onChange={(e) => setEditing(p => ({ ...p, [t.id]: { ...p[t.id], clinic: e.target.value } }))} className="w-20 border rounded-lg p-1.5" /></td>
                      <td className="p-2"><input type="number" min="0" step="0.01" value={row.doctor} onChange={(e) => setEditing(p => ({ ...p, [t.id]: { ...p[t.id], doctor: e.target.value } }))} className="w-20 border rounded-lg p-1.5" /></td>
                      <td className="p-2"><input type="number" min="0" step="0.01" value={row.owner} onChange={(e) => setEditing(p => ({ ...p, [t.id]: { ...p[t.id], owner: e.target.value } }))} className="w-20 border rounded-lg p-1.5" /></td>
                      <td className="p-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${sum === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{sum}%</span>
                      </td>
                      <td className="p-2">
                        <button onClick={() => handleSave(t.id)} disabled={savingId === t.id} className="text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1 disabled:opacity-50">
                          {savingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LabReport() {
  const [rows, setRows] = useState<any[]>([]);
  const [visitRows, setVisitRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toDateInputValue(d);
  });
  const [dateTo, setDateTo] = useState(() => toDateInputValue(new Date()));

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 1) نتائج التحاليل المدخلة من تبويب "المعمل" (lab_results) — فيها تفصيل
    //    نسب التوزيع (المركز/الطبيب/صاحب المعمل).
    const resultsPromise = supabase
      .from('lab_results')
      .select('id, value, price, clinic_share, doctor_share, lab_owner_share, created_at, test:test_id(name, unit), patient:patient_id(first_name, last_name), doctor:doctor_id(first_name, last_name)')
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`)
      .order('created_at', { ascending: false });

    // 2) زيارات المعمل المسجّلة من شاشة "الزيارات" العادية (سكرتارية/مدير) —
    //    أي زيارة مربوطة بعيادة اسمها فيه "معمل". دي كانت بتفوت من التقرير
    //    القديم لأنه كان بيقرأ من lab_results بس، فكانت مبالغ محصّلة من
    //    زيارات المعمل مش بتظهر هنا رغم إنها فلوس معمل فعليًا.
    const clinicsPromise = supabase.from('clinics').select('id, name').ilike('name', '%معمل%');

    const [resultsRes, clinicsRes] = await Promise.all([resultsPromise, clinicsPromise]);

    if (resultsRes.error) {
      setError(getFriendlyErrorMessage(resultsRes.error, 'تعذر تحميل تقرير حسابات المعمل.'));
      setLoading(false);
      return;
    }
    setRows(resultsRes.data || []);

    const labClinicIds = (clinicsRes.data || []).map((c: any) => c.id);
    if (labClinicIds.length > 0) {
      const { data: visitsData, error: visitsError } = await supabase
        .from('patient_visits')
        .select('id, patient_name, service_name, paid_amount, visit_date, clinic_id, doctor_id, doctor:doctor_id(first_name, last_name)')
        .in('clinic_id', labClinicIds)
        .gte('visit_date', dateFrom)
        .lte('visit_date', dateTo)
        .order('visit_date', { ascending: false });
      if (!visitsError) setVisitRows(visitsData || []);
      else setVisitRows([]);
    } else {
      setVisitRows([]);
    }

    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { const t = setTimeout(fetchReport, 0); return () => clearTimeout(t); }, [fetchReport]);

  const totals = useMemo(() => {
    const fromResults = rows.reduce((acc, r) => ({
      price: acc.price + Number(r.price || 0),
      clinic: acc.clinic + Number(r.clinic_share || 0),
      doctor: acc.doctor + Number(r.doctor_share || 0),
      owner: acc.owner + Number(r.lab_owner_share || 0),
    }), { price: 0, clinic: 0, doctor: 0, owner: 0 });
    const visitsTotal = visitRows.reduce((s, v) => s + Number(v.paid_amount || 0), 0);
    return {
      price: fromResults.price + visitsTotal,
      clinic: fromResults.clinic,
      doctor: fromResults.doctor,
      owner: fromResults.owner,
      visitsTotal,
    };
  }, [rows, visitRows]);

  const handleExport = () => {
    const resultRows = rows.map(r => ({
      'المصدر': 'نتيجة تحليل',
      'التاريخ': new Date(r.created_at).toLocaleDateString('ar-EG'),
      'المريض': r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : '',
      'التحليل / الخدمة': r.test?.name || '',
      'السعر': r.price,
      'نصيب المركز': r.clinic_share,
      'نصيب الطبيب': r.doctor_share,
      'الطبيب المحوِّل': r.doctor ? `د. ${r.doctor.first_name} ${r.doctor.last_name}` : '',
      'نصيب صاحب المعمل': r.lab_owner_share,
    }));
    const visitExportRows = visitRows.map(v => ({
      'المصدر': 'زيارة معمل',
      'التاريخ': new Date(v.visit_date).toLocaleDateString('ar-EG'),
      'المريض': v.patient_name || '',
      'التحليل / الخدمة': v.service_name || '',
      'السعر': v.paid_amount,
      'نصيب المركز': '',
      'نصيب الطبيب': '',
      'الطبيب المحوِّل': v.doctor ? `د. ${v.doctor.first_name} ${v.doctor.last_name}` : '',
      'نصيب صاحب المعمل': '',
    }));
    exportRowsToExcel([...resultRows, ...visitExportRows], 'حسابات المعمل', `تقرير_حسابات_المعمل_${dateFrom}_${dateTo}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-bold">
            <Calendar className="w-4 h-4" /> من
          </div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border rounded-lg p-2 text-sm" />
          <span className="text-gray-400 text-sm">إلى</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border rounded-lg p-2 text-sm" />
          <button onClick={handleExport} className="md:mr-auto flex items-center gap-2 bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm">
            <Download className="w-4 h-4" /> تحميل إكسيل
          </button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500 mb-1">إجمالي التحصيل (نتائج + زيارات)</p><p className="text-xl font-black text-gray-800" dir="ltr">{totals.price.toLocaleString()} ج.م</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500 mb-1">نصيب المركز</p><p className="text-xl font-black text-blue-600" dir="ltr">{totals.clinic.toLocaleString()} ج.م</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500 mb-1">نصيب الأطباء</p><p className="text-xl font-black text-purple-600" dir="ltr">{totals.doctor.toLocaleString()} ج.م</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500 mb-1">نصيب صاحب المعمل</p><p className="text-xl font-black text-emerald-600" dir="ltr">{totals.owner.toLocaleString()} ج.م</p></CardContent></Card>
      </div>

      {visitRows.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-bold">
          تحصيل زيارات المعمل (المسجّلة من شاشة الزيارات وليس شاشة إدخال النتائج): {totals.visitsTotal.toLocaleString()} ج.م — دي مبالغ متضمنة في «إجمالي التحصيل» فوق، لكنها ملهاش نسب موزّعة (مركز/طبيب/صاحب معمل) زي نتائج التحاليل، عشان ملهاش سعر ونسب محفوظة في كتالوج التحاليل وقت التسجيل.
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {error && <div className="p-4"><ErrorState message={error} onRetry={fetchReport} compact /></div>}
          {loading ? <p className="text-gray-500 p-6">جاري التحميل...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-3 font-semibold text-gray-600">المصدر</th>
                    <th className="p-3 font-semibold text-gray-600">التاريخ</th>
                    <th className="p-3 font-semibold text-gray-600">المريض</th>
                    <th className="p-3 font-semibold text-gray-600">التحليل / الخدمة</th>
                    <th className="p-3 font-semibold text-gray-600">السعر</th>
                    <th className="p-3 font-semibold text-gray-600">المركز</th>
                    <th className="p-3 font-semibold text-gray-600">الطبيب</th>
                    <th className="p-3 font-semibold text-gray-600">صاحب المعمل</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={`result-${r.id}`} className="border-b hover:bg-gray-50">
                      <td className="p-3"><span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded">نتيجة تحليل</span></td>
                      <td className="p-3 text-gray-500">{new Date(r.created_at).toLocaleDateString('ar-EG')}</td>
                      <td className="p-3 font-bold">{r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : '---'}</td>
                      <td className="p-3">{r.test?.name}</td>
                      <td className="p-3" dir="ltr">{r.price}</td>
                      <td className="p-3" dir="ltr">{r.clinic_share}</td>
                      <td className="p-3" dir="ltr">{r.doctor_share}</td>
                      <td className="p-3" dir="ltr">{r.lab_owner_share}</td>
                    </tr>
                  ))}
                  {visitRows.map(v => (
                    <tr key={`visit-${v.id}`} className="border-b hover:bg-gray-50 bg-amber-50/30">
                      <td className="p-3"><span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded">زيارة معمل</span></td>
                      <td className="p-3 text-gray-500">{new Date(v.visit_date).toLocaleDateString('ar-EG')}</td>
                      <td className="p-3 font-bold">{v.patient_name || '---'}</td>
                      <td className="p-3">{v.service_name || '---'}</td>
                      <td className="p-3" dir="ltr">{v.paid_amount}</td>
                      <td className="p-3 text-gray-400">—</td>
                      <td className="p-3 text-gray-400">{v.doctor ? `د. ${v.doctor.first_name} ${v.doctor.last_name}` : '—'}</td>
                      <td className="p-3 text-gray-400">—</td>
                    </tr>
                  ))}
                  {rows.length === 0 && visitRows.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-gray-500">لا توجد بيانات ضمن النطاق الزمني المحدد</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function LabAccountsTab() {
  const [view, setView] = useState<'pricing' | 'report'>('report');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="w-5 h-5 text-emerald-600" />
        <div className="flex gap-2">
          <button onClick={() => setView('report')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${view === 'report' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>تقرير حسابات المعمل</button>
          <button onClick={() => setView('pricing')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${view === 'pricing' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>إعدادات الأسعار والنسب</button>
        </div>
      </div>
      {view === 'report' ? <LabReport /> : <PricingSettings />}
    </div>
  );
}
