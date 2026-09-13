'use client';

// ============================================================================
// components/dashboards/manager/tabs/DoctorReportsPanel.tsx
// "تقارير الأطباء" داخل التقارير الشاملة — يومي/أسبوعي/شهري، عدد الكشوفات
// والمبلغ المحصّل من call_queue الفعلية، تسديد الحساب (بنسبة % أو مبلغ
// محدد — الطبيب مش بياخد المبلغ المحصّل كامل)، مع إشعار تلقائي للطبيب،
// وطباعة.
// ============================================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Printer, CheckCircle2, Clock, Loader2, User, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getFriendlyErrorMessage } from '@/lib/errors';

type PeriodType = 'daily' | 'weekly' | 'monthly';

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getPeriodBounds(dateStr: string, type: PeriodType) {
  const date = new Date(`${dateStr}T00:00:00`);
  if (type === 'daily') {
    return { start: date, end: date };
  }
  if (type === 'weekly') {
    // الأسبوع من السبت للجمعة
    const day = date.getDay();
    const diffToSaturday = (day + 1) % 7;
    const start = new Date(date);
    start.setDate(date.getDate() - diffToSaturday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

const PERIOD_LABELS: Record<PeriodType, string> = { daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري' };

function SettlementModal({
  totalAmount, checkupsCount, defaultPercent, onClose, onConfirm, saving, error,
}: {
  totalAmount: number;
  checkupsCount: number;
  defaultPercent: number;
  onClose: () => void;
  onConfirm: (payload: { sharePercent: number | null; doctorShareAmount: number }) => void;
  saving: boolean;
  error: string | null;
}) {
  const [mode, setMode] = useState<'percent' | 'fixed'>('percent');
  const [percent, setPercent] = useState(String(defaultPercent));
  const [fixedAmount, setFixedAmount] = useState(String(totalAmount));

  const computedAmount = mode === 'percent'
    ? Math.round((totalAmount * (Number(percent) || 0) / 100) * 100) / 100
    : Number(fixedAmount) || 0;

  const handleConfirm = () => {
    onConfirm({
      sharePercent: mode === 'percent' ? (Number(percent) || 0) : null,
      doctorShareAmount: computedAmount,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-xl font-bold text-gray-800">تحديد مستحقات الطبيب</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">
            إجمالي المحصّل من المرضى: <span className="font-bold text-gray-800" dir="ltr">{totalAmount.toLocaleString()} ج.م</span> ({checkupsCount} كشف)
          </p>

          <div className="flex gap-2 bg-gray-100 rounded-lg p-1 w-fit">
            <button onClick={() => setMode('percent')} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${mode === 'percent' ? 'bg-white shadow text-emerald-700' : 'text-gray-500'}`}>نسبة %</button>
            <button onClick={() => setMode('fixed')} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${mode === 'fixed' ? 'bg-white shadow text-emerald-700' : 'text-gray-500'}`}>مبلغ محدد</button>
          </div>

          {mode === 'percent' ? (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">نسبة الطبيب %</label>
              <input type="number" min="0" max="100" step="0.01" value={percent} onChange={(e) => setPercent(e.target.value)} className="w-full border rounded-lg p-2.5" autoFocus />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ المحدد (ج.م)</label>
              <input type="number" min="0" step="0.01" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} className="w-full border rounded-lg p-2.5" autoFocus />
            </div>
          )}

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <p className="text-xs text-emerald-700 mb-1">المبلغ المستحق للطبيب</p>
            <p className="text-2xl font-black text-emerald-700" dir="ltr">{computedAmount.toLocaleString()} ج.م</p>
          </div>

          {error && <InlineError message={error} />}

          <div className="flex gap-2">
            <button onClick={handleConfirm} disabled={saving} className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              تأكيد التسديد
            </button>
            <button onClick={onClose} disabled={saving} className="px-5 border border-gray-200 text-gray-600 font-bold rounded-lg hover:bg-gray-50">إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DoctorReportsPanel() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<{ id: string; name: string; defaultPercent: number }[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [periodType, setPeriodType] = useState<PeriodType>('daily');
  const [dateStr, setDateStr] = useState(() => toDateInputValue(new Date()));

  const [checkups, setCheckups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  const { start, end } = useMemo(() => getPeriodBounds(dateStr, periodType), [dateStr, periodType]);
  const startStr = toDateInputValue(start);
  const endStr = toDateInputValue(end);

  useEffect(() => {
    supabase.from('profiles').select('id, first_name, last_name, doctor:doctors(default_share_percent)').eq('role', 'doctor').then(({ data }) => {
      const list = (data || []).map((d: any) => ({
        id: d.id,
        name: `د. ${d.first_name} ${d.last_name}`,
        defaultPercent: Number(d.doctor?.default_share_percent ?? 50),
      }));
      setDoctors(list);
      if (list.length > 0) setDoctorId(prev => prev || list[0].id);
    });
  }, []);

  const fetchReport = useCallback(async () => {
    if (!doctorId) return;
    setLoading(true);
    setError(null);
    setSettleError(null);

    const [queueRes, settlementRes] = await Promise.all([
      supabase.from('call_queue')
        .select('id, patient_name, paid_amount, status, created_at')
        .eq('doctor_id', doctorId)
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`)
        .order('created_at', { ascending: true }),
      supabase.from('doctor_settlements')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('period_type', periodType)
        .eq('period_start', startStr)
        .maybeSingle(),
    ]);

    if (queueRes.error) setError(getFriendlyErrorMessage(queueRes.error, 'تعذر تحميل تقرير الطبيب.'));
    else setCheckups(queueRes.data || []);

    setSettlement(settlementRes.data || null);
    setLoading(false);
  }, [doctorId, startStr, endStr, periodType]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const totalAmount = checkups.reduce((sum, c) => sum + Number(c.paid_amount || 0), 0);
  const currentDoctor = doctors.find(d => d.id === doctorId);

  const handleConfirmSettle = async ({ sharePercent, doctorShareAmount }: { sharePercent: number | null; doctorShareAmount: number }) => {
    if (!doctorId) return;
    setSettling(true);
    setSettleError(null);
    const { data, error } = await supabase.from('doctor_settlements').insert([{
      doctor_id: doctorId,
      period_type: periodType,
      period_start: startStr,
      period_end: endStr,
      checkups_count: checkups.length,
      total_amount: totalAmount,
      share_percent: sharePercent,
      doctor_share_amount: doctorShareAmount,
      settled_by: user?.id || null,
    }]).select().single();
    setSettling(false);
    if (error) {
      setSettleError(getFriendlyErrorMessage(error, 'تعذر تسجيل التسديد.'));
      return;
    }
    setSettlement(data);
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <Card className="print:hidden">
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="border rounded-lg p-2.5 text-sm bg-white">
            {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['daily', 'weekly', 'monthly'] as PeriodType[]).map(t => (
              <button
                key={t}
                onClick={() => setPeriodType(t)}
                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${periodType === t ? 'bg-white shadow text-emerald-700' : 'text-gray-500'}`}
              >
                {PERIOD_LABELS[t]}
              </button>
            ))}
          </div>
          <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="border rounded-lg p-2.5 text-sm" />
          <button onClick={() => window.print()} className="md:mr-auto flex items-center gap-2 bg-white border text-gray-700 font-bold px-4 py-2.5 rounded-xl hover:bg-gray-50 text-sm">
            <Printer className="w-4 h-4" /> طباعة
          </button>
        </CardContent>
      </Card>

      {error && <ErrorState message={error} onRetry={fetchReport} />}

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6 pb-4 border-b">
            <div>
              <div className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <User className="w-5 h-5 text-emerald-600" /> {currentDoctor?.name}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                تقرير {PERIOD_LABELS[periodType]} — من {startStr} إلى {endStr}
              </p>
            </div>
            {loading ? null : settlement ? (
              <span className="flex flex-col items-end gap-1">
                <span className="flex items-center gap-2 bg-emerald-100 text-emerald-700 font-bold px-4 py-2 rounded-full text-sm">
                  <CheckCircle2 className="w-4 h-4" /> تم التسديد بتاريخ {new Date(settlement.settled_at).toLocaleDateString('ar-EG')}
                </span>
                <span className="text-xs text-gray-500">
                  المبلغ المدفوع: <b dir="ltr">{settlement.doctor_share_amount} ج.م</b>
                  {settlement.share_percent !== null && ` (نسبة ${settlement.share_percent}%)`}
                </span>
              </span>
            ) : (
              <div className="flex flex-col items-end gap-2 print:hidden">
                <button
                  onClick={() => setShowModal(true)}
                  disabled={checkups.length === 0}
                  className="flex items-center gap-2 bg-amber-500 text-white font-bold px-4 py-2 rounded-full text-sm hover:bg-amber-600 disabled:opacity-50"
                >
                  <Clock className="w-4 h-4" />
                  تسديد الحساب
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">عدد الكشوفات</p>
              <p className="text-2xl font-black text-gray-900">{checkups.length}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">إجمالي المحصّل من المرضى</p>
              <p className="text-2xl font-black text-emerald-600" dir="ltr">{totalAmount.toLocaleString()} ج.م</p>
            </div>
          </div>

          {loading ? (
            <p className="text-gray-500 py-4 text-center">جاري التحميل...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-3 font-semibold text-gray-600">التاريخ والوقت</th>
                    <th className="p-3 font-semibold text-gray-600">المريض</th>
                    <th className="p-3 font-semibold text-gray-600">الحالة</th>
                    <th className="p-3 font-semibold text-gray-600 text-left">المبلغ المحصّل</th>
                  </tr>
                </thead>
                <tbody>
                  {checkups.map(c => (
                    <tr key={c.id} className="border-b">
                      <td className="p-3 text-gray-500">{new Date(c.created_at).toLocaleString('ar-EG')}</td>
                      <td className="p-3 font-bold text-gray-800">{c.patient_name}</td>
                      <td className="p-3">{c.status}</td>
                      <td className="p-3 text-left font-bold" dir="ltr">{c.paid_amount || 0} ج.م</td>
                    </tr>
                  ))}
                  {checkups.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-500">لا توجد كشوفات لهذا الطبيب في الفترة المحددة</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showModal && currentDoctor && (
        <SettlementModal
          totalAmount={totalAmount}
          checkupsCount={checkups.length}
          defaultPercent={currentDoctor.defaultPercent}
          onClose={() => setShowModal(false)}
          onConfirm={handleConfirmSettle}
          saving={settling}
          error={settleError}
        />
      )}
    </div>
  );
}
