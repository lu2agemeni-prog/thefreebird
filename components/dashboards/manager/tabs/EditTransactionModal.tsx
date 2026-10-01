'use client';

// ============================================================================
// components/dashboards/manager/tabs/EditTransactionModal.tsx
// مودال تعديل المعاملة المالية بواسطة المدير:
// يتيح تعديل: المبلغ، نوع القيد (إيراد/مصروف/راتب)، التصنيف، العيادة،
// التاريخ والوقت، والبيان/الوصف مع الحفظ المباشر في قاعدة البيانات.
// ============================================================================
import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Calendar, Clock, Building2, Tag, FileText, Wallet, AlertCircle } from 'lucide-react';
import { authFetchJson } from '@/lib/api-client';
import { toDateInputValue } from '@/lib/financialMonth';

interface EditTransactionModalProps {
  transaction: any | null;
  clinics: Array<{ id: string; name: string }>;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedTx: any) => void;
}

const COMMON_CATEGORIES = [
  { value: 'كشف وعيادات', label: 'كشف واستشارات وخدمات عيادات (إيراد)' },
  { value: 'rent_utilities', label: 'المصروفات العامة والإيجار والمرافق' },
  { value: 'consumables', label: 'المستهلكات والمستلزمات الطبية' },
  { value: 'wages', label: 'الأجور والرواتب والمكافآت' },
  { value: 'equipment_maintenance', label: 'الأجهزة والصيانة والانتقالات' },
  { value: 'misc', label: 'نثريات ومصروفات أخرى' },
  { value: 'معمل وتحاليل', label: 'تحاليل وخدمات معمل' },
  { value: 'أدوية وصيدلية', label: 'أدوية وصيدلية' },
];

export function EditTransactionModal({
  transaction,
  clinics,
  isOpen,
  onClose,
  onSaved,
}: EditTransactionModalProps) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'salary'>('income');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (transaction) {
      setAmount(String(transaction.amount || ''));
      setType(transaction.type || 'income');
      const cat = transaction.category || '';
      const matched = COMMON_CATEGORIES.some((c) => c.value === cat);
      if (matched) {
        setCategory(cat);
        setCustomCategory('');
      } else {
        setCategory('__custom__');
        setCustomCategory(cat);
      }
      setClinicId(transaction.clinic_id || '');
      const txDate = transaction.created_at ? new Date(transaction.created_at) : new Date();
      setDate(toDateInputValue(txDate));
      const hours = String(txDate.getHours()).padStart(2, '0');
      const mins = String(txDate.getMinutes()).padStart(2, '0');
      setTime(`${hours}:${mins}`);
      setDescription(transaction.description || '');
      setError(null);
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(amount);
    if (isNaN(parsedAmt) || parsedAmt < 0) {
      setError('يرجى كتابة مبلغ صحيح أكبر من أو يساوي الصفر.');
      return;
    }

    const finalCategory = category === '__custom__' ? customCategory.trim() || 'عام' : category;
    if (!finalCategory) {
      setError('يرجى تحديد أو كتابة تصنيف الحركة.');
      return;
    }

    if (!date) {
      setError('يرجى تحديد تاريخ الحركة.');
      return;
    }

    setSaving(true);
    setError(null);

    // دمج التاريخ والوقت
    const combinedIso = new Date(`${date}T${time || '00:00'}:00`).toISOString();

    const { data, error: apiErr } = await authFetchJson('/api/manager/transactions', {
      method: 'PUT',
      body: JSON.stringify({
        id: transaction.id,
        amount: parsedAmt,
        type,
        category: finalCategory,
        description: description.trim(),
        clinic_id: clinicId || null,
        created_at: combinedIso,
      }),
    });

    setSaving(false);
    if (apiErr || !data?.success) {
      setError(apiErr || 'تعذر حفظ تعديلات المعاملة.');
    } else {
      onSaved(data.transaction || { ...transaction, amount: parsedAmt, type, category: finalCategory, description, clinic_id: clinicId, created_at: combinedIso });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <Save className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">تعديل المعاملة المالية</h3>
              <p className="text-xs text-gray-500 font-mono">
                رقم الحركة: #{transaction.id ? transaction.id.slice(0, 8) : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* نوع الحركة والمبلغ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" /> نوع القيد المالي
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold"
              >
                <option value="income">إيراد (+) مقبوضات</option>
                <option value="expense">مصروف (-) مدفوعات</option>
                <option value="salary">راتب / مستحقات أطباء (-)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                المبلغ (بالجنيه المصري) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm font-black text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 pr-3 pl-12"
                  placeholder="0.00"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                  ج.م
                </span>
              </div>
            </div>
          </div>

          {/* التصنيف */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-gray-500" /> تصنيف المعاملة
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-2.5 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              {COMMON_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
              <option value="__custom__">تصنيف مخصص آخر...</option>
            </select>

            {category === '__custom__' && (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="اكتب اسم التصنيف المخصص..."
                className="w-full mt-2 border border-gray-300 rounded-xl p-2.5 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                required
              />
            )}
          </div>

          {/* العيادة التابعة */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-gray-500" /> العيادة المرتبطة
            </label>
            <select
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-2.5 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">المركز العام (غير مخصص لعيادة معينة)</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* التاريخ والوقت */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-500" /> تاريخ الحركة
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gray-500" /> التوقيت
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* البيان والوصف */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-gray-500" /> البيان / الملاحظات
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب بيان أو تفاصيل الحركة المالية..."
              className="w-full border border-gray-300 rounded-xl p-2.5 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed"
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  حفظ التعديلات
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
