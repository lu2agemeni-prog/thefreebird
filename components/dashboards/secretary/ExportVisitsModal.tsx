'use client';

// ============================================================================
// components/dashboards/secretary/ExportVisitsModal.tsx
// نافذة تصدير متقدمة لسجل الزيارات الطبية:
// - فلاتر التاريخ (اليوم، أمس، الشهر المالي الحالي/السابق، مخصص)
// - فلترة حسب العيادة والطبيب
// - اختيار نمط التصدير (مجمّع حسب جلسة الزيارة أو مفصّل لكل خدمة)
// - خيارات التصدير: ملف إكسيل (.xlsx)، ملف CSV (مع دعم UTF-8 للعربية)، أو طباعة التقرير
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Building,
  Stethoscope,
  Loader2,
  FileText,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { exportRowsToExcel } from '@/lib/export-excel';
import {
  getFinancialMonthBounds,
  getPreviousFinancialMonthBounds,
  getTodayDateStr,
} from '@/lib/financialMonth';

interface ExportVisitsModalProps {
  initialDateFrom?: string;
  initialDateTo?: string;
  initialClinicId?: string;
  initialDoctorId?: string;
  onClose: () => void;
}

interface VisitRecord {
  id: string;
  visit_date: string;
  created_at: string;
  patient_name: string;
  service_name: string | null;
  paid_amount: number;
  clinic_id: string | null;
  doctor_id: string | null;
  visit_group_id: string | null;
  clinics?: { name: string } | null;
  doctor?: { first_name: string; last_name: string } | null;
}

export function ExportVisitsModal({
  initialDateFrom,
  initialDateTo,
  initialClinicId,
  initialDoctorId,
  onClose,
}: ExportVisitsModalProps) {
  const today = getTodayDateStr();

  const [dateFrom, setDateFrom] = useState(initialDateFrom || today);
  const [dateTo, setDateTo] = useState(initialDateTo || today);
  const [clinicId, setClinicId] = useState(initialClinicId || '');
  const [doctorId, setDoctorId] = useState(initialDoctorId || '');
  const [exportMode, setExportMode] = useState<'grouped' | 'detailed'>('grouped');

  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [fetched, setFetched] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // تحميل قوائم العيادات والأطباء
  useEffect(() => {
    async function loadFilters() {
      const [clinicsRes, docsRes] = await Promise.all([
        supabase.from('clinics').select('id, name').order('name'),
        supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .eq('role', 'doctor')
          .order('first_name'),
      ]);
      if (clinicsRes.data) setClinics(clinicsRes.data);
      if (docsRes.data) {
        setDoctors(
          docsRes.data.map((d: any) => ({
            id: d.id,
            name: `د. ${d.first_name || ''} ${d.last_name || ''}`.trim(),
          }))
        );
      }
    }
    loadFilters();
  }, []);

  // اختصارات التاريخ
  const applyDatePreset = (preset: 'today' | 'yesterday' | 'curMonth' | 'prevMonth' | 'all') => {
    if (preset === 'today') {
      setDateFrom(today);
      setDateTo(today);
    } else if (preset === 'yesterday') {
      const d = new Date(`${today}T00:00:00`);
      d.setDate(d.getDate() - 1);
      const yStr = d.toISOString().slice(0, 10);
      setDateFrom(yStr);
      setDateTo(yStr);
    } else if (preset === 'curMonth') {
      const b = getFinancialMonthBounds();
      setDateFrom(b.startStr);
      setDateTo(b.endStr);
    } else if (preset === 'prevMonth') {
      const b = getPreviousFinancialMonthBounds();
      setDateFrom(b.startStr);
      setDateTo(b.endStr);
    } else if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  };

  // جلب البيانات بناءً على الفلاتر
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setExportSuccess(null);

    let query = supabase
      .from('patient_visits')
      .select('*, clinics(name), doctor:doctor_id(first_name, last_name)')
      .order('visit_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (dateFrom) {
      query = query.gte('visit_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('visit_date', dateTo);
    }
    if (clinicId) {
      query = query.eq('clinic_id', clinicId);
    }
    if (doctorId) {
      query = query.eq('doctor_id', doctorId);
    }

    const { data, error } = await query;
    if (!error && data) {
      setRecords(data as any);
    } else {
      setRecords([]);
    }
    setFetched(true);
    setLoading(false);
  }, [dateFrom, dateTo, clinicId, doctorId]);

  // تحديث البيانات تلقائياً عند تغيير الفلاتر
  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // إحصائيات سريعة
  const summary = useMemo(() => {
    const totalAmount = records.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const uniqueVisits = new Set(records.map((r) => r.visit_group_id || r.id)).size;
    return {
      serviceCount: records.length,
      visitCount: uniqueVisits,
      totalAmount,
    };
  }, [records]);

  // تجهيز صفوف التصدير
  const preparedRows: Record<string, any>[] = useMemo(() => {
    if (exportMode === 'detailed') {
      return records.map((r, idx) => {
        const doc = r.doctor;
        const doctorName = doc
          ? `د. ${doc.first_name || ''} ${doc.last_name || ''}`.trim()
          : 'غير محدد';
        return {
          'م': idx + 1,
          'تاريخ الزيارة': (r.visit_date || '').slice(0, 10),
          'اسم المريض': r.patient_name || 'بدون اسم',
          'العيادة': r.clinics?.name || 'غير محددة',
          'الطبيب المعالج': doctorName,
          'الخدمة الطبية': r.service_name || 'خدمة كشف',
          'المبلغ المحصل (ج.م)': Number(r.paid_amount || 0),
          'كود الزيارة': r.visit_group_id || r.id,
        };
      });
    }

    // تجميع حسب visit_group_id
    const map = new Map<string, VisitRecord[]>();
    records.forEach((r) => {
      const key = r.visit_group_id || r.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });

    let index = 1;
    const rows: Record<string, any>[] = [];
    map.forEach((groupRows, groupId) => {
      const first = groupRows[0];
      const doc = first.doctor;
      const doctorName = doc
        ? `د. ${doc.first_name || ''} ${doc.last_name || ''}`.trim()
        : 'غير محدد';
      const totalPaid = groupRows.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
      const services = groupRows.map((r) => r.service_name || 'خدمة').join(' + ');

      rows.push({
        'م': index++,
        'تاريخ الزيارة': (first.visit_date || '').slice(0, 10),
        'اسم المريض': first.patient_name || 'بدون اسم',
        'العيادة': first.clinics?.name || 'غير محددة',
        'الطبيب المعالج': doctorName,
        'الخدمات الطبية': services,
        'عدد الخدمات': groupRows.length,
        'المبلغ الإجمالي (ج.م)': totalPaid,
        'كود الزيارة': groupId,
      });
    });

    return rows;
  }, [records, exportMode]);

  // تصدير كـ Excel
  const handleExportExcel = () => {
    if (preparedRows.length === 0) return;
    const dateLabel = `${dateFrom || 'البداية'}_إلى_${dateTo || 'النهاية'}`;
    const modeLabel = exportMode === 'detailed' ? 'مفصل' : 'مجمع';
    const fileName = `سجل_الزيارات_${modeLabel}_${dateLabel}`;
    const ok = exportRowsToExcel(preparedRows, 'سجل الزيارات', fileName);
    if (ok) {
      setExportSuccess('تم تصدير ملف الإكسيل بنجاح.');
      setTimeout(() => setExportSuccess(null), 4000);
    }
  };

  // تصدير كـ CSV (مع UTF-8 BOM لدعم اللغة العربية في إكسيل)
  const handleExportCSV = () => {
    if (preparedRows.length === 0) return;
    const headers = Object.keys(preparedRows[0]);
    const escapeCsv = (val: any) => {
      const s = String(val === null || val === undefined ? '' : val);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const lines = [
      headers.map(escapeCsv).join(','),
      ...preparedRows.map((row) => headers.map((h) => escapeCsv(row[h])).join(',')),
    ];

    // UTF-8 BOM (\uFEFF)
    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateLabel = `${dateFrom || 'البداية'}_إلى_${dateTo || 'النهاية'}`;
    link.download = `سجل_الزيارات_${exportMode}_${dateLabel}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setExportSuccess('تم تصدير ملف CSV بنجاح.');
    setTimeout(() => setExportSuccess(null), 4000);
  };

  // طباعة التقرير
  const handlePrint = () => {
    if (preparedRows.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير.');
      return;
    }

    const headers = Object.keys(preparedRows[0]);
    const dateLabel =
      dateFrom && dateTo ? `الفترة من ${dateFrom} إلى ${dateTo}` : dateFrom ? `من ${dateFrom}` : 'كافة الفترات';

    const selectedClinicName = clinics.find((c) => c.id === clinicId)?.name || 'كل العيادات';
    const selectedDoctorName = doctors.find((d) => d.id === doctorId)?.name || 'كل الأطباء';

    const rowsHtml = preparedRows
      .map(
        (r) =>
          `<tr>${headers.map((h) => `<td style="padding: 6px 8px; border: 1px solid #ddd; text-align: right;">${r[h]}</td>`).join('')}</tr>`
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>تقرير سجل الزيارات</title>
        <style>
          body { font-family: Cairo, Arial, sans-serif; direction: rtl; margin: 20px; font-size: 12px; color: #333; }
          .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 16px; }
          h2 { margin: 0 0 6px 0; color: #065f46; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 11px; background: #f0fdf4; padding: 8px 12px; border-radius: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #059669; color: white; padding: 8px; border: 1px solid #047857; text-align: right; }
          .total-box { margin-top: 16px; padding: 10px 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; font-weight: bold; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>تقرير سجل الزيارات الطبية</h2>
          <div>${dateLabel} • ${selectedClinicName} • ${selectedDoctorName}</div>
        </div>
        <div class="meta">
          <div>إجمالي الزيارات: <strong>${summary.visitCount}</strong> | الخدمات: <strong>${summary.serviceCount}</strong></div>
          <div>المبلغ الإجمالي المحصل: <strong>${summary.totalAmount.toLocaleString()} ج.م</strong></div>
        </div>
        <table>
          <thead>
            <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="total-box">
          إجمالي الإيرادات المحصلة: ${summary.totalAmount.toLocaleString()} جنيه مصري
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* رأس النافذة */}
        <div className="bg-emerald-700 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">تصدير سجل الزيارات الطبية</h2>
              <p className="text-xs text-emerald-100">
                تحديد فترة مخصصة وتصدير السجل إلى Excel أو CSV أو طباعة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* محتوى الإعدادات */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-gray-700">
          {/* اختصارات الفترة */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2">فترات سريعة:</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyDatePreset('today')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-emerald-100 hover:text-emerald-800 text-gray-700 transition-colors"
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('yesterday')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-emerald-100 hover:text-emerald-800 text-gray-700 transition-colors"
              >
                أمس
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('curMonth')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                الشهر المالي الحالي (21 إلى 20)
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('prevMonth')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-emerald-100 hover:text-emerald-800 text-gray-700 transition-colors"
              >
                الشهر المالي السابق
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('all')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                الكل بدون تحديد
              </button>
            </div>
          </div>

          {/* تحديد التاريخ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" /> من تاريخ:
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" /> إلى تاريخ:
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* فلاتر العيادة والطبيب */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-emerald-600" /> العيادة:
              </label>
              <select
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value="">كافة العيادات</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-emerald-600" /> الطبيب:
              </label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value="">كافة الأطباء</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* نمط التجميع */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-emerald-600" /> طريقة عرض وتجميع البيانات:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  exportMode === 'grouped'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="exportMode"
                  value="grouped"
                  checked={exportMode === 'grouped'}
                  onChange={() => setExportMode('grouped')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-bold text-xs">مجمّع لكل زيارة (الموصى به)</div>
                  <div className="text-2xs text-gray-500">
                    صف واحد لكل زيارة يضم كافة خدماتها ومجموع المبلغ المسدد
                  </div>
                </div>
              </label>
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  exportMode === 'detailed'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="exportMode"
                  value="detailed"
                  checked={exportMode === 'detailed'}
                  onChange={() => setExportMode('detailed')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-bold text-xs">مفصّل لكل خدمة مفردة</div>
                  <div className="text-2xs text-gray-500">
                    كل خدمة تم تقديمها في سطر منفصل مع قيمتها المستقلة
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* بطاقة المعاينة والإحصائيات */}
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {loading ? (
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
              <span className="text-xs font-bold text-gray-700">
                {loading
                  ? 'جاري احتساب البيانات...'
                  : `البيانات المطابقة: ${summary.visitCount} زيارة (${summary.serviceCount} خدمة)`}
              </span>
            </div>
            {!loading && (
              <div className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
                الإجمالي: {summary.totalAmount.toLocaleString()} ج.م
              </div>
            )}
          </div>

          {/* إشعار النجاح */}
          {exportSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{exportSuccess}</span>
            </div>
          )}
        </div>

        {/* أزرار الإجراءات والتصدير */}
        <div className="bg-gray-50 border-t border-gray-200 px-5 py-3.5 flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 transition-colors"
          >
            إلغاء
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || preparedRows.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 transition-colors disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-gray-600" />
              <span>طباعة</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={loading || preparedRows.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 transition-colors disabled:opacity-50"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={loading || preparedRows.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>تصدير Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
