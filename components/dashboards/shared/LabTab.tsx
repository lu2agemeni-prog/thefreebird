'use client';

// ============================================================================
// components/dashboards/shared/LabTab.tsx
// تبويب "المعمل" — مشترك بين السكرتارية والمدير. البحث عن مريض مسجّل
// بحساب (التحاليل مرتبطة بحساب المريض عشان يقدر يشوفها ويوصله إشعار —
// زي الاستشارات والروشتات بالظبط)، اختيار تحليل من القائمة المرجعية،
// إدخال القيمة، والإرسال. المريض بياخد إشعار تلقائي (trigger في القاعدة).
// ============================================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { FlaskConical, Search, X, Loader2, CheckCircle2, Trash2, User } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getFriendlyErrorMessage } from '@/lib/errors';

const FETCH_CAP = 300;

interface FoundPatient {
  id: string;
  name: string;
  phone: string | null;
}

interface CatalogTest {
  id: string;
  name: string;
  category: string;
  unit: string | null;
  normal_min: number | null;
  normal_max: number | null;
}

function computeStatus(value: number, range: { normal_min: number | null; normal_max: number | null } | undefined): 'low' | 'normal' | 'high' | null {
  if (!range || range.normal_min === null || range.normal_max === null) return null;
  if (value < range.normal_min) return 'low';
  if (value > range.normal_max) return 'high';
  return 'normal';
}

export function LabTab() {
  const { user } = useAuth();

  // البحث عن مريض
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FoundPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<FoundPatient | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // الكتالوج
  const [catalog, setCatalog] = useState<CatalogTest[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // نموذج إضافة نتيجة
  const [testId, setTestId] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sessionResults, setSessionResults] = useState<any[]>([]);

  // سجل النتائج الأخيرة (كل المرضى)
  const [recent, setRecent] = useState<any[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('lab_test_catalog').select('*').order('display_order', { ascending: true }).then(({ data, error }) => {
      if (error) setCatalogError(getFriendlyErrorMessage(error, 'تعذر تحميل قائمة التحاليل.'));
      else setCatalog(data || []);
    });
  }, []);

  const fetchRecent = useCallback(async () => {
    setRecentLoading(true);
    setRecentError(null);
    const { data, error } = await supabase
      .from('lab_results')
      .select('*, patient:patient_id(first_name, last_name), test:test_id(name, unit)')
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP);
    if (error) setRecentError(getFriendlyErrorMessage(error, 'تعذر تحميل سجل التحاليل الأخيرة.'));
    else setRecent(data || []);
    setRecentLoading(false);
  }, []);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = search.trim();
    if (!q) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone')
        .eq('role', 'patient')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,patient_code.ilike.%${q}%`)
        .limit(8);
      setResults((data || []).map(p => ({ id: p.id, name: `${p.first_name || ''} ${p.last_name || ''}`.trim(), phone: p.phone })));
      setSearching(false);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const selectedTest = catalog.find(t => t.id === testId);
  const catalogByCategory = catalog.reduce<Record<string, CatalogTest[]>>((acc, t) => {
    (acc[t.category] ||= []).push(t);
    return acc;
  }, {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!selectedPatient || !testId || value === '') {
      setSubmitError('يرجى اختيار المريض والتحليل وإدخال القيمة.');
      return;
    }
    const numValue = Number(value);
    if (isNaN(numValue)) {
      setSubmitError('القيمة يجب أن تكون رقمًا.');
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.from('lab_results').insert([{
      patient_id: selectedPatient.id,
      test_id: testId,
      value: numValue,
      notes: notes.trim() || null,
      entered_by: user?.id || null,
    }]).select('*, test:test_id(name, unit, normal_min, normal_max)').single();

    setSubmitting(false);
    if (error) {
      setSubmitError(getFriendlyErrorMessage(error, 'تعذر حفظ نتيجة التحليل.'));
      return;
    }

    setSessionResults(prev => [data, ...prev]);
    setTestId('');
    setValue('');
    setNotes('');
    fetchRecent();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف نتيجة التحليل هذه؟')) return;
    await supabase.from('lab_results').delete().eq('id', id);
    setRecent(prev => prev.filter(r => r.id !== id));
  };

  const statusLabel = (status: 'low' | 'normal' | 'high' | null) => {
    if (status === 'low') return <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded">منخفض</span>;
    if (status === 'high') return <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded">مرتفع</span>;
    if (status === 'normal') return <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">طبيعي</span>;
    return null;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-emerald-600" />
            إضافة نتيجة تحليل
          </CardTitle>
          <CardDescription>ابحث عن مريض له حساب مسجّل (التحاليل تظهر له تلقائيًا في حسابه ويصله إشعار فور الإضافة)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!selectedPatient ? (
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو رقم الهاتف أو الكود الطبي..."
                className="w-full pr-9 pl-3 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searching && <Loader2 className="w-4 h-4 absolute left-3 top-3.5 animate-spin text-gray-400" />}
              {results.length > 0 && (
                <div className="mt-2 border rounded-xl divide-y overflow-hidden">
                  {results.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPatient(p); setSearch(''); setResults([]); setSessionResults([]); }}
                      className="w-full text-right p-3 hover:bg-emerald-50 transition-colors flex items-center justify-between"
                    >
                      <span className="font-bold text-gray-800">{p.name}</span>
                      <span className="text-sm text-gray-500" dir="ltr">{p.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {search.trim() && !searching && results.length === 0 && (
                <p className="text-sm text-gray-400 mt-2">لا يوجد مريض له حساب مسجّل بهذا الاسم/الرقم.</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-gray-800">{selectedPatient.name}</p>
                  <p className="text-sm text-gray-500" dir="ltr">{selectedPatient.phone}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedPatient(null); setSessionResults([]); }}
                className="text-sm text-gray-500 hover:text-red-600 font-bold flex items-center gap-1"
              >
                <X className="w-4 h-4" /> تغيير المريض
              </button>
            </div>
          )}

          {selectedPatient && (
            <form onSubmit={handleSubmit} className="space-y-4 border-t pt-5">
              {catalogError && <ErrorState message={catalogError} compact />}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">التحليل</label>
                  <select value={testId} onChange={(e) => setTestId(e.target.value)} className="w-full border rounded-lg p-2.5" required>
                    <option value="">-- اختر التحليل --</option>
                    {Object.entries(catalogByCategory).map(([category, tests]) => (
                      <optgroup key={category} label={category}>
                        {tests.map(t => (
                          <option key={t.id} value={t.id}>{t.name} {t.unit ? `(${t.unit})` : ''}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    القيمة {selectedTest?.unit && <span className="text-gray-400 font-normal">({selectedTest.unit})</span>}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full border rounded-lg p-2.5"
                    placeholder={selectedTest?.normal_min != null ? `المعدل الطبيعي: ${selectedTest.normal_min} - ${selectedTest.normal_max}` : ''}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات (اختياري)</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded-lg p-2.5" placeholder="أي ملاحظات إضافية عن العينة أو الفحص..." />
              </div>
              {submitError && <InlineError message={submitError} />}
              <button type="submit" disabled={submitting} className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                حفظ النتيجة وإرسال إشعار للمريض
              </button>
            </form>
          )}

          {sessionResults.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-sm font-bold text-gray-600 mb-2">تمت إضافتها الآن لهذا المريض:</p>
              <div className="space-y-2">
                {sessionResults.map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 text-sm">
                    <span className="font-bold text-gray-700">{r.test?.name}</span>
                    <div className="flex items-center gap-2">
                      <span dir="ltr" className="font-mono">{r.value} {r.test?.unit}</span>
                      {statusLabel(computeStatus(r.value, r.test))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>آخر النتائج المضافة (كل المرضى)</CardTitle>
        </CardHeader>
        <CardContent>
          {recentError && <ErrorState message={recentError} onRetry={fetchRecent} compact />}
          {recentLoading ? (
            <p className="text-gray-500 py-4">جاري التحميل...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-3 font-semibold text-gray-600">المريض</th>
                    <th className="p-3 font-semibold text-gray-600">التحليل</th>
                    <th className="p-3 font-semibold text-gray-600">القيمة</th>
                    <th className="p-3 font-semibold text-gray-600">التاريخ</th>
                    <th className="p-3 font-semibold text-gray-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-bold text-gray-800">{r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : '---'}</td>
                      <td className="p-3 text-gray-600">{r.test?.name}</td>
                      <td className="p-3 font-mono" dir="ltr">{r.value} {r.test?.unit}</td>
                      <td className="p-3 text-sm text-gray-500">{new Date(r.created_at).toLocaleDateString('ar-EG')}</td>
                      <td className="p-3">
                        <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-1">
                          <Trash2 className="w-4 h-4" /> حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                  {recent.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا توجد نتائج تحاليل مضافة بعد</td></tr>
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
