'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  Printer,
  Search,
  TrendingUp,
  TrendingDown,
  Building2,
  User,
  ArrowUpDown,
  Filter,
  Calendar,
} from 'lucide-react';
import { exportRowsToExcel } from '@/lib/export-excel';
import { PrintableReportModal } from '@/components/ui/printable-report-modal';

export interface DrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  dateRange: { from: string; to: string };
  type: 'income' | 'expense' | 'clinic' | 'doctor' | 'all';
  transactions: any[];
  extraMeta?: { clinicName?: string; doctorName?: string };
}

const EXPENSE_CATEGORIES_MAP: Record<string, string> = {
  rent_utilities: 'المصروفات العامة والإيجار',
  consumables: 'المستهلكات والمستلزمات',
  wages: 'الأجور والرواتب',
  equipment_maintenance: 'الأجهزة والصيانة والانتقالات',
  misc: 'نثريات ومصروفات أخرى',
};

export function FinancialDrilldownModal({
  isOpen,
  onClose,
  title,
  subtitle,
  dateRange,
  type,
  transactions,
  extraMeta,
}: DrilldownModalProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [clinicFilter, setClinicFilter] = useState('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // استخراج قائمة العيادات والتصنيفات الفريدة من الحركات المعروضة
  const availableClinics = useMemo(() => {
    const set = new Map<string, string>();
    transactions.forEach((t) => {
      if (t.clinic_id && t.clinics?.name) {
        set.set(t.clinic_id, t.clinics.name);
      }
    });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [transactions]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [transactions]);

  // تصفية الحركات
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (clinicFilter && t.clinic_id !== clinicFilter) return false;
      if (!q) return true;

      const desc = (t.description || '').toLowerCase();
      const cat = (t.category || '').toLowerCase();
      const catLabel = (EXPENSE_CATEGORIES_MAP[t.category] || '').toLowerCase();
      const clinic = (t.clinics?.name || '').toLowerCase();
      const user = t.profiles
        ? `${t.profiles.first_name || ''} ${t.profiles.last_name || ''}`.toLowerCase()
        : '';
      const beneficiary = t.beneficiary
        ? `${t.beneficiary.first_name || ''} ${t.beneficiary.last_name || ''}`.toLowerCase()
        : '';

      return (
        desc.includes(q) ||
        cat.includes(q) ||
        catLabel.includes(q) ||
        clinic.includes(q) ||
        user.includes(q) ||
        beneficiary.includes(q) ||
        String(t.amount || '').includes(q)
      );
    });
  }, [transactions, search, categoryFilter, clinicFilter]);

  // إحصائيات سريعة
  const totalAmount = useMemo(() => {
    return filtered.reduce((s, t) => s + Number(t.amount || 0), 0);
  }, [filtered]);

  const avgAmount = useMemo(() => {
    return filtered.length > 0 ? Math.round(totalAmount / filtered.length) : 0;
  }, [totalAmount, filtered.length]);

  if (!isOpen) return null;

  // تصدير إكسيل
  const handleExportExcel = () => {
    const rows = filtered.map((t, idx) => ({
      'م': idx + 1,
      'التاريخ': new Date(t.created_at).toLocaleDateString('ar-EG'),
      'الوقت': new Date(t.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      'النوع': t.type === 'income' ? 'إيراد' : t.type === 'salary' ? 'راتب/مستحق' : 'مصروف',
      'التصنيف': EXPENSE_CATEGORIES_MAP[t.category] || t.category || 'عام',
      'المبلغ (ج.م)': Number(t.amount || 0),
      'البيان': t.description || '—',
      'العيادة': t.clinics?.name || 'غير محدد',
      'بواسطة': t.profiles ? `${t.profiles.first_name || ''} ${t.profiles.last_name || ''}`.trim() : 'النظام',
      'المستفيد': t.beneficiary ? `${t.beneficiary.first_name || ''} ${t.beneficiary.last_name || ''}`.trim() : '—',
    }));

    exportRowsToExcel(
      rows,
      'تفاصيل الحركات',
      `كشف_تفصيلي_${title.replace(/[\s/\\:]+/g, '_')}_${dateRange.from}_${dateRange.to}`
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-start p-2 sm:p-4 md:p-6 print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-4 flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        {/* هيدر المودال */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                type === 'income'
                  ? 'bg-emerald-100 text-emerald-700'
                  : type === 'expense'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {type === 'income' ? (
                <TrendingUp className="w-5 h-5" />
              ) : type === 'expense' ? (
                <TrendingDown className="w-5 h-5" />
              ) : (
                <Building2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span className="font-mono bg-white px-2 py-0.5 rounded border">
                  الفترة: {dateRange.from} إلى {dateRange.to}
                </span>
                {subtitle && <span>• {subtitle}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
              title="تصدير جدول الحركات إلى إكسيل"
            >
              <Download className="w-4 h-4" />
              <span>إكسيل</span>
            </button>
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-1.5 bg-white hover:bg-gray-100 text-gray-700 border font-bold px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
              title="معاينة الطباعة وحفظ كـ PDF"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-xl transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* كروت الإحصاءات السريعة في المودال */}
        <div className="p-6 pb-2 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gradient-to-b from-gray-50/40 to-white">
          <div className="bg-white border rounded-xl p-3.5 shadow-2xs">
            <p className="text-xs text-gray-500 font-medium">إجمالي المبالغ</p>
            <p
              className={`text-2xl font-black mt-1 ${
                type === 'income' ? 'text-emerald-600' : 'text-red-600'
              }`}
              dir="ltr"
            >
              {type === 'income' ? '+' : '-'}
              {totalAmount.toLocaleString('ar-EG')} <span className="text-xs font-normal">ج.م</span>
            </p>
          </div>
          <div className="bg-white border rounded-xl p-3.5 shadow-2xs">
            <p className="text-xs text-gray-500 font-medium">عدد الحركات المطابقة</p>
            <p className="text-2xl font-black text-gray-800 mt-1" dir="ltr">
              {filtered.length}{' '}
              <span className="text-xs text-gray-400 font-normal">من إجمالي {transactions.length}</span>
            </p>
          </div>
          <div className="bg-white border rounded-xl p-3.5 shadow-2xs">
            <p className="text-xs text-gray-500 font-medium">متوسط الحركة الواحدة</p>
            <p className="text-2xl font-black text-gray-700 mt-1" dir="ltr">
              {avgAmount.toLocaleString('ar-EG')} <span className="text-xs font-normal">ج.م</span>
            </p>
          </div>
        </div>

        {/* شريط الفلاتر والبحث داخل المودال */}
        <div className="px-6 py-3 border-y border-gray-100 bg-gray-50/50 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في البيان، المستفيد، العيادة، المبلغ..."
              className="w-full pr-9 pl-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {availableCategories.length > 1 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white text-gray-700"
            >
              <option value="">كل التصنيفات ({availableCategories.length})</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_CATEGORIES_MAP[c] || c}
                </option>
              ))}
            </select>
          )}

          {availableClinics.length > 1 && (
            <select
              value={clinicFilter}
              onChange={(e) => setClinicFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white text-gray-700"
            >
              <option value="">كل العيادات ({availableClinics.length})</option>
              {availableClinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {(search || categoryFilter || clinicFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setCategoryFilter('');
                setClinicFilter('');
              }}
              className="text-xs font-bold text-emerald-700 hover:underline px-2"
            >
              إعادة تعيين الفلاتر
            </button>
          )}
        </div>

        {/* جدول الحركات التفصيلي */}
        <div className="p-6 overflow-y-auto max-h-[55vh]">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ArrowUpDown className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="font-bold text-sm text-gray-600">لا توجد حركات مالية مطابقة للفلاتر المحددة</p>
              <p className="text-xs mt-1">جرّب تغيير كلمات البحث أو إلغاء فلاتر التصنيف</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100/90 text-gray-700 border-b border-gray-200">
                    <th className="p-3 font-bold w-12 text-center">#</th>
                    <th className="p-3 font-bold">التاريخ والوقت</th>
                    <th className="p-3 font-bold">النوع والتصنيف</th>
                    <th className="p-3 font-bold">المبلغ</th>
                    <th className="p-3 font-bold">البيان / الوصف</th>
                    <th className="p-3 font-bold">العيادة</th>
                    <th className="p-3 font-bold">المستفيد / الطبيب</th>
                    <th className="p-3 font-bold">المستخدم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((t, idx) => (
                    <tr
                      key={t.id || idx}
                      className="hover:bg-emerald-50/30 transition-colors"
                    >
                      <td className="p-3 text-center text-gray-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-3 whitespace-nowrap">
                        <p className="font-bold text-gray-800">
                          {new Date(t.created_at).toLocaleDateString('ar-EG')}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          {new Date(t.created_at).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            t.type === 'income'
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.type === 'salary'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {t.type === 'income' ? 'إيراد' : t.type === 'salary' ? 'أجور/مستحقات' : 'مصروف'}
                        </span>
                        <p className="text-[11px] text-gray-500 mt-1 font-medium truncate max-w-[130px]">
                          {EXPENSE_CATEGORIES_MAP[t.category] || t.category || 'عام'}
                        </p>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`font-black text-sm ${
                            t.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                          }`}
                          dir="ltr"
                        >
                          {t.type === 'income' ? '+' : '-'}
                          {Number(t.amount || 0).toLocaleString('ar-EG')} ج.م
                        </span>
                      </td>
                      <td className="p-3 text-gray-700 min-w-[180px]">
                        <p className="font-medium line-clamp-2">{t.description || '—'}</p>
                      </td>
                      <td className="p-3 whitespace-nowrap text-gray-600">
                        {t.clinics?.name ? (
                          <span className="bg-gray-100 px-2 py-0.5 rounded-md text-[11px]">
                            {t.clinics.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">عام (المركز)</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap text-gray-600">
                        {t.beneficiary ? (
                          <span className="font-bold text-amber-800">
                            {t.beneficiary.first_name} {t.beneficiary.last_name}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap text-gray-500 text-[11px]">
                        {t.profiles
                          ? `${t.profiles.first_name || ''} ${t.profiles.last_name || ''}`.trim()
                          : 'النظام'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* فوتر المودال */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>إجمالي السجلات: {filtered.length} حركة</span>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* مودال الطباعة والتصدير كـ PDF الخاص بهذا الكشف التفصيلي */}
      <PrintableReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={title}
        subtitle={subtitle}
        dateRange={dateRange}
        metaItems={[
          { label: 'عدد الحركات', value: `${filtered.length} حركة` },
          { label: 'إجمالي المبالغ', value: `${totalAmount.toLocaleString('ar-EG')} ج.م` },
          { label: 'المتوسط', value: `${avgAmount.toLocaleString('ar-EG')} ج.م` },
        ]}
        sections={[
          {
            title: 'كشف الحركات التفصيلية',
            columns: [
              {
                header: 'التاريخ والوقت',
                render: (r) => (
                  <span>
                    {new Date(r.created_at).toLocaleDateString('ar-EG')} {new Date(r.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ),
              },
              {
                header: 'التصنيف',
                render: (r) => EXPENSE_CATEGORIES_MAP[r.category] || r.category || 'عام',
              },
              {
                header: 'المبلغ',
                align: 'left',
                render: (r) => (
                  <span dir="ltr" className="font-bold">
                    {Number(r.amount || 0).toLocaleString('ar-EG')} ج.م
                  </span>
                ),
              },
              {
                header: 'البيان',
                key: 'description',
              },
              {
                header: 'العيادة',
                render: (r) => r.clinics?.name || 'عام',
              },
              {
                header: 'المستفيد',
                render: (r) =>
                  r.beneficiary
                    ? `${r.beneficiary.first_name || ''} ${r.beneficiary.last_name || ''}`.trim()
                    : '—',
              },
            ],
            data: filtered,
          },
        ]}
      />
    </div>
  );
}
