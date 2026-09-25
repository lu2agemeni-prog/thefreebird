'use client';

// ============================================================================
// components/dashboards/manager/tabs/AdditionalAccountsTab.tsx
// تبويب "الحسابات الإضافية" — 5 أقسام (مصروفات/مستهلكات/أجور/أجهزة وصيانة
// وانتقالات/نثريات)، كلهم مبنيين على مكون واحد قابل لإعادة الاستخدام
// (ExpenseGroupPanel) ومخزّنين في جدول transactions نفسه (بعمود
// expense_group الجديد) — نفس مصدر البيانات المستخدم في "الماليات والأرباح"،
// فأي قيد هنا بيظهر تلقائيًا في التقارير المالية العامة كمان.
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { Wallet, Package, Users, Wrench, Receipt, Plus, Pencil, Trash2, X, CheckCircle2, Loader2, Download, HandCoins, Stethoscope, User } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { exportRowsToExcel } from '@/lib/export-excel';
import { getFinancialMonthBounds, getPreviousFinancialMonthBounds } from '@/lib/financialMonth';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

interface GroupConfig {
  key: string;
  title: string;
  description: string;
  categories: string[];
  needsClinic?: boolean;
  needsBeneficiaryName?: boolean;
  transactionType: 'expense' | 'salary';
}

const GROUPS: GroupConfig[] = [
  {
    key: 'rent_utilities',
    title: 'المصروفات',
    description: 'مشروبات، مستلزمات نظافة، لاب تو لاب، مناديل، إيجار، مياه، كهرباء، إنترنت، مستلزمات...',
    categories: ['مشروبات', 'مستلزمات نظافة', 'لاب تو لاب', 'مناديل', 'إيجار', 'مياه', 'كهرباء', 'إنترنت', 'مستلزمات', 'أخرى'],
    transactionType: 'expense',
  },
  {
    key: 'consumables',
    title: 'المستهلكات',
    description: 'المستلزمات الطبية والمكتبية ومواد النظافة الخاصة بكل عيادة',
    categories: ['مستلزمات طبية', 'أدوات مكتبية', 'مطهرات ونظافة', 'أخرى'],
    needsClinic: true,
    transactionType: 'expense',
  },
  {
    key: 'wages',
    title: 'الأجور',
    description: 'أجور السكرتارية والأطباء والعمال وغيرهم',
    categories: ['سكرتارية', 'طبيب', 'عامل', 'أخرى'],
    needsBeneficiaryName: true,
    transactionType: 'salary',
  },
  {
    key: 'equipment_maintenance',
    title: 'الأجهزة والصيانة والانتقالات',
    description: 'شراء أجهزة، أعمال صيانة، ومصروفات الانتقالات والمواصلات',
    categories: ['شراء جهاز', 'صيانة', 'انتقالات ومواصلات', 'أخرى'],
    transactionType: 'expense',
  },
  {
    key: 'misc',
    title: 'نثريات أخرى',
    description: 'أي مصروفات متفرقة لا تندرج تحت الأقسام السابقة',
    categories: ['نثريات عامة'],
    transactionType: 'expense',
  },
];

// ============================================================================
// مودال "سلفة / مدفوعات": اختيار طبيب أو عامل (من بيانات المستخدمين الفعلية،
// مش اسم بالكتابة اليدوية زي حقل "المستفيد" العادي)، وتسجيل سلفة أو مدفوع
// من حسابه. بيتسجّل في نفس جدول transactions (expense_group='wages') مع
// beneficiary_id يربطه بالشخص فعليًا، عشان يتخصم من مستحقاته في تقرير
// الطبيب (وبيظهر تلقائيًا في تقارير الأجور والأرباح العامة زي أي قيد تاني).
// ============================================================================
interface PersonOption { id: string; name: string; }

function AdvancePaymentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [beneficiaryType, setBeneficiaryType] = useState<'doctor' | 'worker'>('doctor');
  const [doctors, setDoctors] = useState<PersonOption[]>([]);
  const [workers, setWorkers] = useState<PersonOption[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [personId, setPersonId] = useState('');
  const [kind, setKind] = useState<'سلفة' | 'مدفوعات'>('سلفة');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingPeople(true);
    supabase.from('profiles').select('id, first_name, last_name, role').in('role', ['doctor', 'secretary', 'accountant', 'manager']).then(({ data }) => {
      const rows = data || [];
      setDoctors(rows.filter((p: any) => p.role === 'doctor').map((p: any) => ({ id: p.id, name: `د. ${p.first_name || ''} ${p.last_name || ''}`.trim() })));
      setWorkers(rows.filter((p: any) => p.role !== 'doctor').map((p: any) => ({ id: p.id, name: `${p.first_name || ''} ${p.last_name || ''}`.trim() })));
      setLoadingPeople(false);
    });
  }, []);

  const people = beneficiaryType === 'doctor' ? doctors : workers;
  const selectedPerson = people.find(p => p.id === personId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numAmount = Number(amount);
    if (!personId) { setError('يرجى اختيار الطبيب أو العامل.'); return; }
    if (isNaN(numAmount) || numAmount <= 0) { setError('يرجى إدخال مبلغ صحيح أكبر من صفر.'); return; }

    setSaving(true);
    const { error } = await supabase.from('transactions').insert([{
      type: 'salary',
      expense_group: 'wages',
      category: kind,
      amount: numAmount,
      description: `${selectedPerson?.name || ''}${notes.trim() ? ' - ' + notes.trim() : ''}`,
      beneficiary_id: personId,
      clinic_id: null,
      user_id: user?.id || null,
      created_at: `${date}T12:00:00`,
    }]);
    setSaving(false);
    if (error) {
      setError(getFriendlyErrorMessage(error, 'تعذر تسجيل السلفة/المدفوع.'));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-amber-600" /> سلفة / مدفوعات
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">نوع المستفيد</label>
            <div className="flex gap-2 bg-gray-100 rounded-lg p-1 w-fit">
              <button type="button" onClick={() => { setBeneficiaryType('doctor'); setPersonId(''); }} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors flex items-center gap-1.5 ${beneficiaryType === 'doctor' ? 'bg-white shadow text-emerald-700' : 'text-gray-500'}`}>
                <Stethoscope className="w-4 h-4" /> طبيب
              </button>
              <button type="button" onClick={() => { setBeneficiaryType('worker'); setPersonId(''); }} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors flex items-center gap-1.5 ${beneficiaryType === 'worker' ? 'bg-white shadow text-emerald-700' : 'text-gray-500'}`}>
                <User className="w-4 h-4" /> عامل / موظف
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">{beneficiaryType === 'doctor' ? 'الطبيب' : 'العامل/الموظف'}</label>
            <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="w-full border rounded-lg p-2.5" required disabled={loadingPeople}>
              <option value="">{loadingPeople ? 'جاري التحميل...' : '-- اختر --'}</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {!loadingPeople && people.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">لا يوجد {beneficiaryType === 'doctor' ? 'أطباء' : 'عمال/موظفين'} مسجلين بالنظام.</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">النوع</label>
              <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
                <button type="button" onClick={() => setKind('سلفة')} className={`flex-1 px-3 py-2 rounded-md text-sm font-bold transition-colors ${kind === 'سلفة' ? 'bg-white shadow text-amber-700' : 'text-gray-500'}`}>سلفة</button>
                <button type="button" onClick={() => setKind('مدفوعات')} className={`flex-1 px-3 py-2 rounded-md text-sm font-bold transition-colors ${kind === 'مدفوعات' ? 'bg-white shadow text-amber-700' : 'text-gray-500'}`}>مدفوعات</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">التاريخ</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border rounded-lg p-2.5" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">المبلغ (ج.م)</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border rounded-lg p-2.5" required />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات (اختياري)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded-lg p-2.5" />
          </div>

          <p className="text-xs text-gray-400">
            المبلغ هيتخصم تلقائيًا من مستحقات {beneficiaryType === 'doctor' ? 'الطبيب في تقرير الأطباء' : 'العامل'}، ويظهر كمان ضمن قيود «الأجور» والتقارير المالية العامة.
          </p>

          {error && <InlineError message={error} />}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-amber-600 text-white font-bold py-3 rounded-lg hover:bg-amber-700 flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              حفظ
            </button>
            <button type="button" onClick={onClose} disabled={saving} className="px-5 border border-gray-200 text-gray-600 font-bold rounded-lg hover:bg-gray-50">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExpenseGroupPanel({ group }: { group: GroupConfig }) {
  const [rows, setRows] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // فلترة حسب الشهر المالي (21 إلى 20)
  const [dateFrom, setDateFrom] = useState(() => getFinancialMonthBounds().startStr);
  const [dateTo, setDateTo] = useState(() => getFinancialMonthBounds().endStr);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(todayStr());
  const [formCategory, setFormCategory] = useState(group.categories[0]);
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formBeneficiary, setFormBeneficiary] = useState('');
  const [formClinicId, setFormClinicId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase
      .from('transactions')
      .select('*, clinics(name)')
      .eq('expense_group', group.key)
      .order('created_at', { ascending: false });

    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);

    const { data, error } = await query.limit(1000);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل البيانات.'));
    else setRows(data || []);
    setLoading(false);
  }, [group.key, dateFrom, dateTo]);

  useEffect(() => {
    setTimeout(fetchRows, 0);
    if (group.needsClinic) {
      supabase.from('clinics').select('id, name').then(({ data }) => setClinics(data || []));
    }
  }, [fetchRows, group.needsClinic]);

  const resetForm = () => {
    setEditingId(null);
    setFormDate(todayStr());
    setFormCategory(group.categories[0]);
    setFormCustomCategory('');
    setFormAmount('');
    setFormBeneficiary('');
    setFormClinicId('');
    setFormNotes('');
    setFormError(null);
  };

  const startEdit = (row: any) => {
    setEditingId(row.id);
    setShowForm(true);
    setFormDate(new Date(row.created_at).toISOString().slice(0, 10));
    const isPreset = group.categories.includes(row.category);
    setFormCategory(isPreset ? row.category : 'أخرى');
    setFormCustomCategory(isPreset ? '' : row.category);
    setFormAmount(String(row.amount));
    setFormBeneficiary(row.description || '');
    setFormClinicId(row.clinic_id || '');
    setFormNotes(group.needsBeneficiaryName ? '' : (row.description || ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amount = Number(formAmount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('يرجى إدخال مبلغ صحيح أكبر من صفر.');
      return;
    }
    const finalCategory = formCategory === 'أخرى' && formCustomCategory.trim() ? formCustomCategory.trim() : formCategory;
    if (group.needsClinic && !formClinicId) {
      setFormError('يرجى اختيار العيادة.');
      return;
    }

    setSaving(true);
    const payload: any = {
      type: group.transactionType,
      expense_group: group.key,
      category: finalCategory,
      amount,
      description: group.needsBeneficiaryName ? formBeneficiary.trim() : formNotes.trim(),
      clinic_id: group.needsClinic ? formClinicId : null,
      created_at: `${formDate}T12:00:00`,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('transactions').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('transactions').insert([payload]));
    }
    setSaving(false);

    if (error) {
      setFormError(getFriendlyErrorMessage(error, 'تعذر حفظ القيد.'));
      return;
    }
    setShowForm(false);
    resetForm();
    setTimeout(fetchRows, 0);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا القيد؟')) return;
    await supabase.from('transactions').delete().eq('id', id);
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const handleExport = () => {
    exportRowsToExcel(rows.map(r => ({
      'التاريخ': new Date(r.created_at).toLocaleDateString('ar-EG'),
      'الصنف': r.category,
      'المبلغ': r.amount,
      ...(group.needsClinic ? { 'العيادة': r.clinics?.name || '' } : {}),
      ...(group.needsBeneficiaryName ? { 'المستفيد': r.description || '' } : { 'ملاحظات': r.description || '' }),
    })), group.title, `${group.title}_${todayStr()}`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle>{group.title}</CardTitle>
            <CardDescription>{group.description}</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleExport} className="flex items-center gap-2 bg-white border text-gray-700 font-bold px-4 py-2.5 rounded-xl hover:bg-gray-50 text-sm">
              <Download className="w-4 h-4" /> تصدير إكسيل
            </button>
            {group.key === 'wages' && (
              <button onClick={() => setShowAdvanceModal(true)} className="flex items-center gap-2 bg-amber-500 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-amber-600 text-sm">
                <HandCoins className="w-4 h-4" /> سلفة / مدفوعات
              </button>
            )}
            <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-emerald-700 text-sm">
              <Plus className="w-4 h-4" /> إضافة قيد
            </button>
          </div>
        </div>

        {/* شريط فلترة الشهر المالي */}
        <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-gray-100">
          <span className="text-xs font-bold text-gray-500">الفترة المالية:</span>
          <button
            type="button"
            onClick={() => {
              const fin = getFinancialMonthBounds();
              setDateFrom(fin.startStr);
              setDateTo(fin.endStr);
            }}
            className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          >
            الشهر الحالي (21 - 20)
          </button>
          <button
            type="button"
            onClick={() => {
              const prev = getPreviousFinancialMonthBounds();
              setDateFrom(prev.startStr);
              setDateTo(prev.endStr);
            }}
            className="px-2.5 py-1 text-xs font-bold rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            الشهر السابق (21 - 20)
          </button>
          <button
            type="button"
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
            className="px-2.5 py-1 text-xs font-bold rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            كل الفترات
          </button>
          <div className="flex items-center gap-1.5 md:mr-auto text-xs text-gray-500">
            <span>من:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded-md px-2 py-1 text-xs bg-white"
            />
            <span>إلى:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded-md px-2 py-1 text-xs bg-white"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && <ErrorState message={error} onRetry={fetchRows} compact />}

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 bg-gray-50 border rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">التاريخ</label>
                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full border rounded-lg p-2.5" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">الصنف</label>
                <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full border rounded-lg p-2.5">
                  {group.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">المبلغ (ج.م)</label>
                <input type="number" min="0" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="w-full border rounded-lg p-2.5" required />
              </div>
            </div>

            {formCategory === 'أخرى' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">اسم الصنف المخصص</label>
                <input type="text" value={formCustomCategory} onChange={(e) => setFormCustomCategory(e.target.value)} className="w-full md:w-1/2 border rounded-lg p-2.5" placeholder="اكتب اسم الصنف..." />
              </div>
            )}

            {group.needsClinic && (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">العيادة</label>
                <select value={formClinicId} onChange={(e) => setFormClinicId(e.target.value)} className="w-full md:w-1/2 border rounded-lg p-2.5" required>
                  <option value="">-- اختر العيادة --</option>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {group.needsBeneficiaryName ? (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">اسم المستفيد</label>
                <input type="text" value={formBeneficiary} onChange={(e) => setFormBeneficiary(e.target.value)} className="w-full border rounded-lg p-2.5" placeholder="اسم السكرتيرة/الطبيب/العامل..." required />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات (اختياري)</label>
                <input type="text" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="w-full border rounded-lg p-2.5" />
              </div>
            )}

            {formError && <InlineError message={formError} />}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="bg-emerald-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {editingId ? 'حفظ التعديلات' : 'إضافة'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="border border-gray-200 text-gray-600 font-bold px-6 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <X className="w-5 h-5" /> إلغاء
              </button>
            </div>
          </form>
        )}

        <div className="mb-3 text-sm font-bold text-gray-600">
          الإجمالي: <span className="text-emerald-700" dir="ltr">{total.toLocaleString()} ج.م</span> ({rows.length} قيد)
        </div>

        {loading ? <p className="text-gray-500 py-4">جاري التحميل...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-3 font-semibold text-gray-600">التاريخ</th>
                  <th className="p-3 font-semibold text-gray-600">الصنف</th>
                  {group.needsClinic && <th className="p-3 font-semibold text-gray-600">العيادة</th>}
                  {group.needsBeneficiaryName && <th className="p-3 font-semibold text-gray-600">المستفيد</th>}
                  <th className="p-3 font-semibold text-gray-600">المبلغ</th>
                  {!group.needsBeneficiaryName && <th className="p-3 font-semibold text-gray-600">ملاحظات</th>}
                  <th className="p-3 font-semibold text-gray-600">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-gray-500">{new Date(r.created_at).toLocaleDateString('ar-EG')}</td>
                    <td className="p-3 font-bold text-gray-800">{r.category}</td>
                    {group.needsClinic && <td className="p-3">{r.clinics?.name || '---'}</td>}
                    {group.needsBeneficiaryName && <td className="p-3">{r.description || '---'}</td>}
                    <td className="p-3 font-bold" dir="ltr">{r.amount} ج.م</td>
                    {!group.needsBeneficiaryName && <td className="p-3 text-gray-500">{r.description || '---'}</td>}
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => startEdit(r)} className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                          <Pencil className="w-4 h-4" /> تعديل
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700 font-bold flex items-center gap-1">
                          <Trash2 className="w-4 h-4" /> حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">لا توجد قيود مسجلة بعد</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {showAdvanceModal && (
        <AdvancePaymentModal
          onClose={() => setShowAdvanceModal(false)}
          onSaved={fetchRows}
        />
      )}
    </Card>
  );
}

const GROUP_ICONS: Record<string, any> = {
  rent_utilities: Wallet,
  consumables: Package,
  wages: Users,
  equipment_maintenance: Wrench,
  misc: Receipt,
};

export function AdditionalAccountsTab() {
  const [activeGroup, setActiveGroup] = useState(GROUPS[0].key);
  const group = GROUPS.find(g => g.key === activeGroup)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {GROUPS.map(g => {
          const Icon = GROUP_ICONS[g.key];
          return (
            <button
              key={g.key}
              onClick={() => setActiveGroup(g.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                activeGroup === g.key ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" /> {g.title}
            </button>
          );
        })}
      </div>
      <ExpenseGroupPanel key={group.key} group={group} />
    </div>
  );
}
