'use client';

// ============================================================================
// components/dashboards/patient/PatientLabResults.tsx
// سجل التحاليل الخاص بالمريض — كل نتيجة معروضة كتقرير مصغّر: القيمة،
// المعدل الطبيعي، الحالة (منخفض/طبيعي/مرتفع)، ومعنى النتيجة المبدئي —
// مع تنويه واضح إن ده مش تشخيص نهائي ولازم استشارة الطبيب.
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { FlaskConical, Loader2, Info, AlertTriangle, TrendingDown, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getFriendlyErrorMessage } from '@/lib/errors';

interface LabResultRow {
  id: string;
  value: number;
  notes: string | null;
  created_at: string;
  test: {
    name: string;
    category: string;
    unit: string | null;
    normal_min: number | null;
    normal_max: number | null;
    description: string | null;
    low_meaning: string | null;
    high_meaning: string | null;
  } | null;
}

function getStatus(row: LabResultRow): 'low' | 'normal' | 'high' | null {
  const test = row.test;
  if (!test || test.normal_min === null || test.normal_max === null) return null;
  if (row.value < test.normal_min) return 'low';
  if (row.value > test.normal_max) return 'high';
  return 'normal';
}

export function PatientLabResults() {
  const { user } = useAuth();
  const [results, setResults] = useState<LabResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('lab_results')
      .select('id, value, notes, created_at, test:test_id(name, category, unit, normal_min, normal_max, description, low_meaning, high_meaning)')
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false });

    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل سجل التحاليل.'));
    else setResults((data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <FlaskConical className="w-6 h-6 text-emerald-600" /> سجل التحاليل الطبية
          </CardTitle>
          <CardDescription>نتائج تحاليلك المعملية كما رفعها فريق المركز</CardDescription>
        </CardHeader>
      </Card>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 leading-relaxed">
          المعلومات الموضحة تحت كل نتيجة (المعنى المبدئي والأسباب المحتملة) هي معلومات تعليمية عامة فقط، ولا تُعتبر تشخيصًا طبيًا نهائيًا.
          يجب دائمًا مراجعة الطبيب المختص لتفسير النتيجة بدقة وربطها بحالتك الصحية الكاملة قبل اتخاذ أي قرار علاجي.
        </p>
      </div>

      {error && <ErrorState message={error} onRetry={fetchResults} />}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
      ) : results.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-gray-500">لا توجد نتائج تحاليل مسجلة حتى الآن.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {results.map((row) => {
            const status = getStatus(row);
            const meaning = status === 'low' ? row.test?.low_meaning : status === 'high' ? row.test?.high_meaning : null;
            return (
              <Card key={row.id} className={`border-r-4 ${
                status === 'high' ? 'border-r-red-400' : status === 'low' ? 'border-r-orange-400' : 'border-r-emerald-400'
              }`}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{row.test?.name}</h3>
                      <p className="text-xs text-gray-400" dir="ltr">{new Date(row.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {status === 'high' && <span className="flex items-center gap-1 text-sm font-bold bg-red-100 text-red-700 px-3 py-1.5 rounded-full"><TrendingUp className="w-4 h-4" /> مرتفع</span>}
                      {status === 'low' && <span className="flex items-center gap-1 text-sm font-bold bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full"><TrendingDown className="w-4 h-4" /> منخفض</span>}
                      {status === 'normal' && <span className="flex items-center gap-1 text-sm font-bold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full"><CheckCircle2 className="w-4 h-4" /> طبيعي</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-4 bg-gray-50 rounded-xl p-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">النتيجة</p>
                      <p className="text-2xl font-black text-gray-900" dir="ltr">{row.value} <span className="text-sm font-normal text-gray-500">{row.test?.unit}</span></p>
                    </div>
                    {row.test?.normal_min !== null && row.test?.normal_max !== null && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">المعدل الطبيعي</p>
                        <p className="text-sm font-bold text-gray-600" dir="ltr">{row.test?.normal_min} - {row.test?.normal_max} {row.test?.unit}</p>
                      </div>
                    )}
                  </div>

                  {row.test?.description && (
                    <p className="text-sm text-gray-500 mb-3">{row.test.description}</p>
                  )}

                  {meaning && (
                    <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>{meaning}</p>
                    </div>
                  )}

                  {row.notes && (
                    <p className="text-sm text-gray-500 mt-3"><span className="font-bold">ملاحظات: </span>{row.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
