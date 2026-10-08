'use client';

// ============================================================================
// components/dashboards/secretary/ExportVisitsModal.tsx
// مودال متكامل لتصدير سجل الزيارات خلال فترة زمنية معينة:
// - تحديد نطاق التاريخ (من - إلى) مع فترات سريعة (اليوم، الأسبوع، الشهر المالي الحالي 21-20، الشهر السابق، آخر 30 يوم، الكل).
// - فلترة اختيارية حسب العيادة، الطبيب، أو اسم المريض.
// - إحصائيات فورية حية (عدد الزيارات، إجمالي الخدمات، إجمالي المبالغ المحصلة).
// - خيارات التصدير:
//    1. تصدير ملف إكسيل (.xlsx) منسق بالكامل باللغة العربية مع RTL.
//    2. تصدير ملف CSV مع ترميز UTF-8 BOM لفتح سليم في إكسيل.
//    3. معاينة وطباعة تقرير رسمي A4.
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Calendar,
  Building,
  Stethoscope,
  Search,
  CheckCircle2,
  Loader2,
  CalendarDays,
  CalendarRange,
  Users,
  Coins,
  Activity,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  getFinancialMonthBounds,
  getPreviousFinancialMonthBounds,
  toDateInputValue,
  getTodayDateStr,
} from '@/lib/financialMonth';
import { exportRowsToExcel } from '@/lib/export-excel';
import { PrintableReportModal } from '@/components/ui/printable-report-modal';

interface ExportVisitsModalProps {
  initialDateFrom?: string;
  initialDateTo?: string;
  initialClinicId?: string;
  initialDoctorId?: string;
  onClose: () => void;
}

interface FetchedVisitRow {
  id: string;
  patient_id: string | null;
  walk_in_patient_id: string | null;
  patient_name: string;
  visit_date: string;
  service_id: string | null;
  service_name: string | null;
  clinic_id: string | null;
  doctor_id: string | null;
  paid_amount: number;
  visit_group_id: string;
  created_at: string;
  clinics?: { name: string } | null;
  doctor?: { first_name: string; last_name: string } | null;
}

export function ExportVisitsModal({
  initialDateFrom,
  initialDateTo,
  initialClinicId = '',
  initialDoctorId = '',
  onClose,
}: ExportVisitsModalProps) {
  // فترات التاريخ
  const [dateFrom, setDateFrom] = useState(() => initialDateFrom || getFinancialMonthBounds().startStr);
  const [dateTo, setDateTo] = useState(() => initialDateTo || getFinancialMonthBounds().endStr);
  const [clinicId, setClinicId] = useState(initialClinicId);
  const [doctorId, setDoctorId] = useState(initialDoctorId);
  const [patientSearch, setPatientSearch] = useState('');

  // القوائم للفلترة
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);

  // حالة جلب البيانات والمعاينة
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visits, setVisits] = useState<FetchedVisitRow[]>([]);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // مودال الطباعة
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // تحميل خيارات العيادات والأطباء
  useEffect(() => {
    Promise.all([
      supabase.from('clinics').select('id, name').order('name'),
      supabase.from('profiles').select('id, first_name, last_name').eq('role', 'doctor').order('first_name'),
    ]).then(([clinicsRes, docsRes]) => {
      if (clinicsRes.data) setClinics(clinicsRes.data);
      if (docsRes.data) {
        setDoctors(
          docsRes.data.map((d: any) => ({
            id: d.id,
            name: `د. ${d.first_name || ''} ${d.last_name || ''}`.trim(),
          }))
        );
      }
    });
  }, []);

  // الفترات السريعة
  const handleQuickPreset = (preset: 'today' | 'yesterday' | 'week' | 'current_fin' | 'prev_fin' | 'last30' | 'all') => {
    const today = getTodayDateStr();
    if (preset === 'today') {
      setDateFrom(today);
      setDateTo(today);
    } else if (preset === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yStr = toDateInputValue(d);
      setDateFrom(yStr);
      setDateTo(yStr);
    } else if (preset === 'week') {
      const now = new Date();
      const first = new Date(now.setDate(now.getDate() - now.getDay()));
      const last = new Date(now.setDate(now.getDate() - now.getDay() + 6));
      setDateFrom(toDateInputValue(first));
      setDateTo(toDateInputValue(last));
    } else if (preset === 'current_fin') {
      const fin = getFinancialMonthBounds();
      setDateFrom(fin.startStr);
      setDateTo(fin.endStr);
    } else if (preset === 'prev_fin') {
      const prev = getPreviousFinancialMonthBounds();
      setDateFrom(prev.startStr);
      setDateTo(prev.endStr);
    } else if (preset === 'last30') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      setDateFrom(toDateInputValue(d));
      setDateTo(today);
    } else if (preset === 'all') {
      setDateFrom('2024-01-01');
      setDateTo(today);
    }
  };

  // جلب الزيارات للفترة المحددة
  const fetchVisitsForExport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('patient_visits')
        .select('*, clinics(name), doctor:doctor_id(first_name, last_name)')
        .order('visit_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10000);

      if (dateFrom) query = query.gte('visit_date', dateFrom);
      if (dateTo) query = query.lte('visit_date', dateTo);
      if (clinicId) query = query.eq('clinic_id', clinicId);
      if (doctorId) query = query.eq('doctor_id', doctorId);

      const { data, error: fetchErr } = await query;
      if (fetchErr) {
        setError(getFriendlyErrorMessage(fetchErr, 'تعذر جلب سجل الزيارات للتصدير.'));
      } else {
        setVisits((data as any) || []);
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء تحميل سجل الزيارات.'));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, clinicId, doctorId]);

  useEffect(() => {
    fetchVisitsForExport();
  }, [fetchVisitsForExport]);

  // تطبيق فلتر البحث باسم المريض وتجميع الجلسات
  const filteredVisits = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return visits;
    return visits.filter((v) => (v.patient_name || '').toLowerCase().includes(q));
  }, [visits, patientSearch]);

  // تجميع الزيارات حسب visit_group_id
  const groupedVisits = useMemo(() => {
    const map = new Map<string, FetchedVisitRow[]>();
    filteredVisits.forEach((v) => {
      const key = v.visit_group_id || v.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    });
    return Array.from(map.entries()).map(([groupId, rows]) => {
      const first = rows[0];
      const totalAmount = rows.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
      const servicesList = rows
        .map((r) => r.service_name || 'خدمة كشف')
        .filter(Boolean)
        .join(' + ');
      return {
        groupId,
        rows,
        first,
        totalAmount,
        servicesList: servicesList || 'كشف عيادة',
        serviceCount: rows.length,
      };
    });
  }, [filteredVisits]);

  // الإحصائيات
  const stats = useMemo(() => {
    const totalSessions = groupedVisits.length;
    const totalServices = filteredVisits.length;
    const totalRevenue = groupedVisits.reduce((s, g) => s + g.totalAmount, 0);
    return { totalSessions, totalServices, totalRevenue };
  }, [groupedVisits, filteredVisits]);

  // اسم الملف المناسب للفترة
  const exportFileName = useMemo(() => {
    const fromStr = dateFrom || 'الكل';
    const toStr = dateTo || 'الكل';
    const clinicName = clinicId ? clinics.find((c) => c.id === clinicId)?.name : '';
    const docName = doctorId ? doctors.find((d) => d.id === doctorId)?.name?.replace('د. ', '') : '';
    const parts = ['سجل_الزيارات', fromStr !== toStr ? `من_${fromStr}_إلى_${toStr}` : `يوم_${fromStr}`];
    if (clinicName) parts.push(`عيادة_${clinicName}`);
    if (docName) parts.push(`الطبيب_${docName}`);
    return parts.join('_').replace(/[\s/\\?%*:|"<>]/g, '_');
  }, [dateFrom, dateTo, clinicId, doctorId, clinics, doctors]);

  // 1) تصدير إلى Excel
  const handleExportExcel = () => {
    if (groupedVisits.length === 0) {
      alert('لا توجد بيانات مطابقة لتصديرها.');
      return;
    }
    setIsExportingExcel(true);
    try {
      const rowsForExcel = groupedVisits.map((g, index) => {
        const doc = g.first.doctor;
        const doctorName = doc ? `د. ${doc.first_name || ''} ${doc.last_name || ''}`.trim() : 'غير محدد';
        const clinicName = g.first.clinics?.name || 'غير محددة';
        const formattedDate = (g.first.visit_date || '').slice(0, 10);
        const timePart = g.first.created_at ? new Date(g.first.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';

        return {
          'م': index + 1,
          'تاريخ الزيارة': formattedDate,
          'وقت التسجيل': timePart,
          'اسم المريض': g.first.patient_name || 'بدون اسم',
          'العيادة': clinicName,
          'الطبيب المعالج': doctorName,
          'الخدمات الطبية': g.servicesList,
          'عدد الخدمات': g.serviceCount,
          'المبلغ المحصل (ج.م)': g.totalAmount,
          'كود جلسة الزيارة': g.groupId,
        };
      });

      // إضافة صف إجمالي في نهاية الجدول
      rowsForExcel.push({
        'م': 'الإجمالي العام' as any,
        'تاريخ الزيارة': `الفترة: ${dateFrom || '—'} إلى ${dateTo || '—'}`,
        'وقت التسجيل': '',
        'اسم المريض': `${stats.totalSessions} زيارة مريض`,
        'العيادة': '',
        'الطبيب المعالج': '',
        'الخدمات الطبية': `${stats.totalServices} خدمة طبية`,
        'عدد الخدمات': stats.totalServices,
        'المبلغ المحصل (ج.م)': stats.totalRevenue,
        'كود جلسة الزيارة': '',
      });

      const success = exportRowsToExcel(
        rowsForExcel,
        'سجل الزيارات',
        exportFileName,
        {
          'م': 8,
          'تاريخ الزيارة': 15,
          'وقت التسجيل': 14,
          'اسم المريض': 26,
          'العيادة': 20,
          'الطبيب المعالج': 22,
          'الخدمات الطبية': 30,
          'عدد الخدمات': 12,
          'المبلغ المحصل (ج.م)': 18,
          'كود جلسة الزيارة': 22,
        }
      );

      if (success) {
        setSuccessToast(`تم تصدير ${stats.totalSessions} زيارة بنجاح إلى ملف إكسيل.`);
        setTimeout(() => setSuccessToast(null), 5000);
      }
    } catch (err: any) {
      alert(`حدث خطأ أثناء تصدير ملف الإكسيل: ${err?.message || err}`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // 2) تصدير إلى CSV
  const handleExportCsv = () => {
    if (groupedVisits.length === 0) {
      alert('لا توجد بيانات مطابقة لتصديرها.');
      return;
    }
    setIsExportingCsv(true);
    try {
      const headers = ['م', 'تاريخ الزيارة', 'وقت التسجيل', 'اسم المريض', 'العيادة', 'الطبيب المعالج', 'الخدمات الطبية', 'عدد الخدمات', 'المبلغ المحصل (ج.م)', 'كود الزيارة'];
      const csvRows = groupedVisits.map((g, index) => {
        const doc = g.first.doctor;
        const doctorName = doc ? `د. ${doc.first_name || ''} ${doc.last_name || ''}`.trim() : 'غير محدد';
        const clinicName = g.first.clinics?.name || 'غير محددة';
        const formattedDate = (g.first.visit_date || '').slice(0, 10);
        const timePart = g.first.created_at ? new Date(g.first.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';

        const escape = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

        return [
          index + 1,
          escape(formattedDate),
          escape(timePart),
          escape(g.first.patient_name),
          escape(clinicName),
          escape(doctorName),
          escape(g.servicesList),
          g.serviceCount,
          g.totalAmount,
          escape(g.groupId),
        ].join(',');
      });

      // إضافة صف الإجمالي
      csvRows.push([
        '"الإجمالي"',
        `"الفترة: ${dateFrom} إلى ${dateTo}"`,
        '""',
        `"${stats.totalSessions} زيارة"`,
        '""',
        '""',
        `"${stats.totalServices} خدمة"`,
        stats.totalServices,
        stats.totalRevenue,
        '""',
      ].join(','));

      const csvContent = '\uFEFF' + headers.join(',') + '\n' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${exportFileName}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccessToast(`تم تحميل ملف CSV يحتوي على ${stats.totalSessions} زيارة.`);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      alert(`حدث خطأ أثناء تصدير ملف CSV: ${err?.message || err}`);
    } finally {
      setIsExportingCsv(false);
    }
  };

  // تجهيز جدول الطباعة
  const printableTable = useMemo(() => {
    return {
      headers: ['م', 'تاريخ الزيارة', 'اسم المريض', 'العيادة', 'الطبيب المعالج', 'الخدمات المقدمة', 'المبلغ المحصل'],
      rows: groupedVisits.map((g, idx) => {
        const doc = g.first.doctor;
        const doctorName = doc ? `د. ${doc.first_name || ''} ${doc.last_name || ''}`.trim() : '—';
        return [
          idx + 1,
          (g.first.visit_date || '').slice(0, 10),
          g.first.patient_name || 'بدون اسم',
          g.first.clinics?.name || '—',
          doctorName,
          g.servicesList,
          `${g.totalAmount.toLocaleString('ar-EG')} ج.م`,
        ];
      }),
    };
  }, [groupedVisits]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* الهيدر */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-700 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">تصدير سجل الزيارات والكشوفات</h2>
              <p className="text-xs text-emerald-100">
                استخراج تقرير الزيارات لفترة زمنية محددة بصيغ متعددة (Excel / CSV / طباعة)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* جسم المودال القابل للتمرير */}
        <div className="p-6 overflow-y-auto space-y-5">
          {successToast && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-sm font-bold">
              {error}
            </div>
          )}

          {/* 1) خيارات تحديد الفترة الزمنية */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4.5 space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <CalendarRange className="w-4 h-4 text-emerald-600" /> تحديد الفترة الزمنية المطلوبة للتصدير:
              </label>
              <span className="text-[11px] text-gray-500">اختر فترة سريعة أو حدد التواريخ يدوياً</span>
            </div>

            {/* أزرار الفترات السريعة */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickPreset('today')}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-white hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('yesterday')}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-white hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
              >
                أمس
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('week')}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-white hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
              >
                هذا الأسبوع
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('current_fin')}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                الشهر المالي الحالي (21 - 20)
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('prev_fin')}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-white hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
              >
                الشهر السابق
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('last30')}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-white hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
              >
                آخر 30 يوم
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('all')}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-100 text-gray-600 transition-colors"
              >
                كافة الفترات
              </button>
            </div>

            {/* حقول التاريخ المباشرة (من - إلى) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">من تاريخ (بداية الفترة):</label>
                <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-3 py-2 shadow-2xs focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    max={dateTo || undefined}
                    className="w-full bg-transparent text-sm font-semibold outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">إلى تاريخ (نهاية الفترة):</label>
                <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-3 py-2 shadow-2xs focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    min={dateFrom || undefined}
                    className="w-full bg-transparent text-sm font-semibold outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2) فلاتر اختيارية متقدمة (عيادة / طبيب / مريض) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-gray-500" /> فلترة العيادة:
              </label>
              <select
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-xs font-bold bg-white text-gray-700 shadow-2xs"
              >
                <option value="">كل العيادات (شامل)</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5 text-gray-500" /> فلترة الطبيب المعالج:
              </label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-xs font-bold bg-white text-gray-700 shadow-2xs"
              >
                <option value="">كل الأطباء (شامل)</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-gray-500" /> بحث باسم المريض:
              </label>
              <input
                type="text"
                placeholder="كل المرضى أو اكتب اسماً..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-xs font-bold bg-white text-gray-700 shadow-2xs"
              />
            </div>
          </div>

          {/* 3) ملخص إحصائيات البيانات المطابقة الجاهزة للتصدير */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-700" /> إحصائيات البيانات الجاهزة للتصدير للفترة المختارة:
              </span>
              {loading && (
                <span className="flex items-center gap-1 text-xs text-emerald-700 font-bold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري التحميل...
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-2xs text-center">
                <p className="text-[11px] text-gray-500 font-bold mb-0.5">عدد الزيارات (الجلسات)</p>
                <p className="text-xl font-black text-emerald-800" dir="ltr">
                  {stats.totalSessions.toLocaleString('ar-EG')}
                </p>
              </div>

              <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-2xs text-center">
                <p className="text-[11px] text-gray-500 font-bold mb-0.5">إجمالي الخدمات المقدمة</p>
                <p className="text-xl font-black text-teal-800" dir="ltr">
                  {stats.totalServices.toLocaleString('ar-EG')}
                </p>
              </div>

              <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-2xs text-center">
                <p className="text-[11px] text-gray-500 font-bold mb-0.5">إجمالي التحصيلات</p>
                <p className="text-xl font-black text-emerald-700" dir="ltr">
                  {stats.totalRevenue.toLocaleString('ar-EG')} ج.م
                </p>
              </div>
            </div>
          </div>

          {/* 4) معاينة سريعة لأول 4 سجلات للتأكد من المحتوى */}
          {groupedVisits.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-100 px-3.5 py-2 text-xs font-bold text-gray-700 flex items-center justify-between">
                <span>معاينة عينة من السجلات ({Math.min(groupedVisits.length, 3)} من {groupedVisits.length} زيارة)</span>
                <span className="text-[11px] text-gray-500">سيتم تصدير كافة السجلات ({groupedVisits.length}) بالكامل</span>
              </div>
              <div className="divide-y divide-gray-100 max-h-36 overflow-y-auto text-xs">
                {groupedVisits.slice(0, 3).map((g) => (
                  <div key={g.groupId} className="p-2.5 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <span className="font-bold text-gray-800">{g.first.patient_name}</span>
                      <span className="text-[11px] text-gray-400 mr-2">{(g.first.visit_date || '').slice(0, 10)}</span>
                      {g.first.clinics?.name && <span className="text-[11px] text-gray-500 mr-1.5">— {g.first.clinics.name}</span>}
                      {g.first.doctor && <span className="text-[11px] text-gray-500 mr-1.5">— د. {g.first.doctor.first_name}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500">{g.servicesList}</span>
                      <span className="font-bold text-emerald-700 mr-2" dir="ltr">{g.totalAmount} ج.م</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {groupedVisits.length === 0 && !loading && (
            <div className="text-center py-6 text-gray-400 text-xs">
              لا توجد زيارات مسجلة تطابق التواريخ والفلاتر المحددة حالياً.
            </div>
          )}
        </div>

        {/* ذيل المودال وأزرار التصدير */}
        <div className="bg-gray-50 border-t p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
          >
            إلغاء وإغلاق
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            {/* زر تصدير CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading || isExportingCsv || groupedVisits.length === 0}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-all shadow-2xs disabled:opacity-50"
              title="تصدير كملف نصي CSV بترميز UTF-8"
            >
              {isExportingCsv ? <Loader2 className="w-4 h-4 animate-spin text-gray-500" /> : <FileText className="w-4 h-4 text-gray-600" />}
              <span>تصدير CSV</span>
            </button>

            {/* زر طباعة تقرير رسمي */}
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              disabled={loading || groupedVisits.length === 0}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-all shadow-2xs disabled:opacity-50"
              title="معاينة وطباعة تقرير رسمي A4"
            >
              <Printer className="w-4 h-4 text-emerald-600" />
              <span>طباعة تقرير</span>
            </button>

            {/* زر تصدير إكسيل الرئيسي */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={loading || isExportingExcel || groupedVisits.length === 0}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {isExportingExcel ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Download className="w-4 h-4 text-white" />
              )}
              <span>تحميل ملف إكسيل (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* مودال الطباعة الرسمي */}
      {isPrintModalOpen && (
        <PrintableReportModal
          title={`سجل الزيارات والكشوفات الطبية`}
          subtitle={`الفترة من: ${dateFrom || 'البداية'} حتى: ${dateTo || 'النهاية'}`}
          periodLabel={dateFrom === dateTo ? `يوم ${dateFrom}` : `من ${dateFrom} إلى ${dateTo}`}
          stats={[
            { label: 'عدد الزيارات (الجلسات)', value: `${stats.totalSessions} زيارة` },
            { label: 'إجمالي الخدمات الطبية', value: `${stats.totalServices} خدمة` },
            { label: 'إجمالي المبالغ المحصلة', value: `${stats.totalRevenue.toLocaleString('ar-EG')} ج.م` },
          ]}
          table={printableTable}
          notes="تم تصدير هذا التقرير تلقائيًا من سجل الزيارات المعتمد للمركز الطبي."
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}
    </div>
  );
}
