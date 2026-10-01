'use client';

// ============================================================================
// components/dashboards/manager/tabs/AppointmentRemindersTab.tsx
// تبويب "تذكير المواعيد الآلي (SMS & Push)" للمدير:
// - يرسل تذكيرات تلقائية ومجدولة للمرضى قبل 24 ساعة من موعد الكشف
// - يدعم إشعارات Push وتطبيق الهاتف + رسائل SMS + روابط واتساب المباشرة
// - يتيح التحكم في قوالب الرسائل وتوقيت الإرسال وتشغيل دورة الفحص الآلي
// - يوثق كل حركة في سجل التذكيرات لمنع التكرار ويوفر تصدير Excel
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BellRing,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  MessageSquare,
  Clock,
  Calendar,
  Building,
  Stethoscope,
  RefreshCw,
  Search,
  Filter,
  Sliders,
  Sparkles,
  FileSpreadsheet,
  ExternalLink,
  PhoneCall,
  Check,
  X,
  Play,
  Volume2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { supabase } from '@/lib/supabase';
import { authFetchJson } from '@/lib/api-client';
import {
  ReminderSettings,
  ReminderLogItem,
  DEFAULT_REMINDER_SETTINGS,
  DEFAULT_REMINDER_TEMPLATE,
  DeliveryChannel,
} from '@/lib/appointment-reminders';
import { exportRowsToExcel } from '@/lib/export-excel';

export function AppointmentRemindersTab() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [history, setHistory] = useState<ReminderLogItem[]>([]);
  const [stats, setStats] = useState({
    upcoming24hCount: 0,
    dueCount: 0,
    remindedCount: 0,
    totalTracked: 0,
  });

  // التحكم وعمليات الإرسال
  const [runningAuto, setRunningAuto] = useState(false);
  const [sendingSingleId, setSendingSingleId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // شريط الإعدادات
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [tempSettings, setTempSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);

  // فلترة الجدول
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'reminded'>('all');
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');

  // جلب البيانات من الخادم
  const fetchRemindersData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await authFetchJson('/api/manager/appointment-reminders');
      if (error) {
        setLoadError(error || 'تعذر تحميل بيانات التذكيرات.');
      } else if (data) {
        setAppointments(data.appointments || []);
        if (data.settings) {
          setSettings(data.settings);
          setTempSettings(data.settings);
        }
        setHistory(data.history || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err: any) {
      setLoadError('حدث خطأ أثناء الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRemindersData();
  }, [fetchRemindersData]);

  // تشغيل فحص آلي دوري في الخلفية كل 5 دقائق عند فتح هذه الشاشة لو كان الخيار مفعلاً
  useEffect(() => {
    if (!settings.autoEnabled) return;
    const interval = setInterval(() => {
      // فحص صامت وتحديث
      fetchRemindersData();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [settings.autoEnabled, fetchRemindersData]);

  // تشغيل دورة الفحص والإرسال الآلي الآن
  const handleRunAutoDispatch = async () => {
    setRunningAuto(true);
    setSuccessBanner(null);
    try {
      const { data, error } = await authFetchJson('/api/manager/appointment-reminders', {
        method: 'POST',
        body: JSON.stringify({ action: 'auto_dispatch' }),
      });

      if (error) {
        alert('حدث خطأ أثناء تشغيل الفحص الآلي.');
      } else {
        const count = data?.dispatchedCount ?? 0;
        setSuccessBanner(
          count > 0
            ? `اكتمل الفحص الآلي بنجاح! تم إرسال تذكيرات الموعد (24h) إلى ${count} مريض عبر ${
                settings.channels === 'both' ? 'Push و SMS' : settings.channels === 'push' ? 'Push' : 'SMS'
              }.`
            : 'اكتمل الفحص الآلي: لا توجد مواعيد جديدة مستحقة للإرسال حالياً (جميع المرضى تم تذكيرهم).'
        );
        setTimeout(() => setSuccessBanner(null), 7000);
        fetchRemindersData();
      }
    } catch {
      alert('تعذر استكمال الفحص الآلي.');
    } finally {
      setRunningAuto(false);
    }
  };

  // إرسال تذكير لموعد فردي
  const handleSendSingle = async (apptId: string) => {
    setSendingSingleId(apptId);
    setSuccessBanner(null);
    try {
      const { data, error } = await authFetchJson('/api/manager/appointment-reminders', {
        method: 'POST',
        body: JSON.stringify({ action: 'send_single', appointmentId: apptId }),
      });

      if (error) {
        alert(error || 'حدث خطأ أثناء إرسال التذكير.');
      } else {
        const name = data?.result?.patientName || 'المريض';
        setSuccessBanner(`تم إرسال تذكير الموعد بنجاح إلى ${name} (Push و SMS).`);
        setTimeout(() => setSuccessBanner(null), 5000);
        fetchRemindersData();
      }
    } catch {
      alert('تعذر إرسال التذكير.');
    } finally {
      setSendingSingleId(null);
    }
  };

  // حفظ الإعدادات
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const { data, error } = await authFetchJson('/api/manager/appointment-reminders', {
        method: 'POST',
        body: JSON.stringify({ action: 'save_settings', settings: tempSettings }),
      });

      if (error) {
        alert('تعذر حفظ الإعدادات.');
      } else {
        setSettings(tempSettings);
        setShowSettingsPanel(false);
        setSuccessBanner('تم حفظ إعدادات تذكير المواعيد بنجاح.');
        setTimeout(() => setSuccessBanner(null), 5000);
        fetchRemindersData();
      }
    } catch {
      alert('حدث خطأ أثناء حفظ الإعدادات.');
    } finally {
      setSavingSettings(false);
    }
  };

  // تبديل حالة التشغيل التلقائي سريعاً
  const handleToggleAuto = async () => {
    const nextState = !settings.autoEnabled;
    const updated = { ...settings, autoEnabled: nextState };
    setSettings(updated);
    setTempSettings(updated);
    await authFetchJson('/api/manager/appointment-reminders', {
      method: 'POST',
      body: JSON.stringify({ action: 'save_settings', settings: updated }),
    });
  };

  // إضافة علامة ذكية لقالب الرسالة
  const handleInsertTag = (tag: string) => {
    setTempSettings((prev) => ({
      ...prev,
      messageTemplate: prev.messageTemplate + ' ' + tag,
    }));
  };

  // تصفية المواعيد المعروضة
  const filteredAppointments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments.filter((appt) => {
      const patientName = `${appt.patient?.first_name || ''} ${appt.patient?.last_name || ''}`.toLowerCase();
      const phone = (appt.patient?.phone || '').toLowerCase();
      const code = (appt.patient?.patient_code || '').toLowerCase();
      const clinicName = (appt.clinic?.name || '').toLowerCase();
      const doctorName = `${appt.doctor?.profiles?.first_name || ''} ${appt.doctor?.profiles?.last_name || ''}`.toLowerCase();

      const matchesSearch =
        !q ||
        patientName.includes(q) ||
        phone.includes(q) ||
        code.includes(q) ||
        clinicName.includes(q) ||
        doctorName.includes(q);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'due' && appt.isDue) ||
        (statusFilter === 'reminded' && appt.isReminded);

      return matchesSearch && matchesStatus;
    });
  }, [appointments, search, statusFilter]);

  // تصدير سجل التذكيرات إلى Excel
  const handleExportHistoryToExcel = () => {
    if (!history || history.length === 0) return;
    const rows = history.map((item, idx) => ({
      'م': idx + 1,
      'تاريخ ووقت الإرسال': new Date(item.sentAt).toLocaleString('ar-EG'),
      'اسم المريض': item.patientName,
      'رقم الهاتف': item.patientPhone,
      'العيادة': item.clinicName,
      'الطبيب': item.doctorName,
      'موعد الكشف': new Date(item.appointmentDate).toLocaleString('ar-EG'),
      'القناة': item.channel === 'both' ? 'Push + SMS' : item.channel === 'push' ? 'Push فقط' : 'SMS فقط',
      'حالة التسليم': item.status === 'sent' ? 'تم بنجاح' : 'فشل الإرسال',
      'نص التذكير المرسل': item.message,
    }));

    exportRowsToExcel(rows, 'سجل التذكيرات', `سجل_تذكيرات_المواعيد_${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className="space-y-6">
      {/* الرأس الرئيسي وشريط الإجراءات */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-gray-200 p-5 rounded-2xl shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <BellRing className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-gray-800">تذكير المواعيد الآلي (SMS & Push)</h2>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  settings.autoEnabled
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${settings.autoEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                {settings.autoEnabled ? 'النظام الآلي نشط' : 'النظام الآلي متوقف'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              إرسال تذكيرات الرسائل النصية SMS وإشعارات Push للمرضى قبل 24 ساعة من موعد الكشف بدقة
            </p>
          </div>
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex flex-wrap items-center gap-2">
          {/* زر تبديل التشغيل التلقائي */}
          <button
            type="button"
            onClick={handleToggleAuto}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
              settings.autoEnabled
                ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            <span>التذكير التلقائي:</span>
            <span className={settings.autoEnabled ? 'text-emerald-700 underline font-black' : 'text-gray-500'}>
              {settings.autoEnabled ? 'مفعل (يعمل تلقائياً)' : 'معطل'}
            </span>
          </button>

          {/* زر تشغيل الفحص الآلي يدوياً */}
          <button
            type="button"
            onClick={handleRunAutoDispatch}
            disabled={runningAuto || loading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs cursor-pointer transition-all disabled:opacity-50 text-xs"
            title="فحص وإرسال تذكيرات الـ 24 ساعة لكافة المواعيد المستحقة الآن"
          >
            {runningAuto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
            <span>تشغيل الفحص والإرسال الآلي الآن</span>
          </button>

          {/* زر إعدادات النظام */}
          <button
            type="button"
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 font-bold px-3 py-2.5 rounded-xl hover:bg-gray-50 shadow-2xs cursor-pointer text-xs transition-all"
          >
            <Sliders className="w-4 h-4 text-emerald-600" />
            <span>تخصيص القوالب والقنوات</span>
          </button>

          {/* زر التحديث */}
          <button
            type="button"
            onClick={fetchRemindersData}
            disabled={loading}
            className="p-2.5 bg-white border border-gray-200 text-gray-600 hover:text-emerald-600 rounded-xl hover:bg-gray-50 shadow-2xs cursor-pointer transition-all"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* شريط الإشعار الإيجابي */}
      {successBanner && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-bold shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* لوحة إعدادات التذكير والقوالب (قابلة للطي) */}
      {showSettingsPanel && (
        <Card className="border-emerald-200 shadow-sm bg-gradient-to-b from-emerald-50/40 to-white animate-in slide-in-from-top-3">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-emerald-900 text-base flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  إعدادات قنوات الإرسال وقوالب رسائل التذكير
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  تحديد توقيت التذكير وقنوات التسليم (SMS / Push) وصياغة نص الرسالة المرسلة للمريض
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsPanel(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* خيار القنوات */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">قنوات التسليم المفعلة</label>
                <select
                  value={tempSettings.channels}
                  onChange={(e) =>
                    setTempSettings({ ...tempSettings, channels: e.target.value as DeliveryChannel })
                  }
                  className="w-full border rounded-xl p-2.5 bg-white text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="both">إشعارات Push + رسائل SMS معاً (موصى به)</option>
                  <option value="push">إشعارات Push وتطبيق الهاتف فقط</option>
                  <option value="sms">رسائل نصية قصيرة SMS فقط</option>
                </select>
              </div>

              {/* توقيت الإرسال */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">توقيت إرسال التذكير</label>
                <select
                  value={tempSettings.leadTimeHours}
                  onChange={(e) =>
                    setTempSettings({ ...tempSettings, leadTimeHours: Number(e.target.value) })
                  }
                  className="w-full border rounded-xl p-2.5 bg-white text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="24">قبل الموعد بـ 24 ساعة (اليوم السابق للموعد)</option>
                  <option value="12">قبل الموعد بـ 12 ساعة</option>
                  <option value="48">قبل الموعد بـ 48 ساعة (يومين)</option>
                </select>
              </div>

              {/* اسم المرسل للـ SMS */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">اسم مرسل رسائل SMS</label>
                <input
                  type="text"
                  value={tempSettings.smsSenderName}
                  onChange={(e) => setTempSettings({ ...tempSettings, smsSenderName: e.target.value })}
                  placeholder="مثال: المركز الطبي"
                  className="w-full border rounded-xl p-2.5 bg-white text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* قالب الرسالة */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-bold text-gray-700">قالب نص التذكير (يدعم المتغيرات الذكية)</label>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-gray-500 ml-1">إدراج متغير:</span>
                  {[
                    { tag: '{المريض}', label: 'المريض' },
                    { tag: '{العيادة}', label: 'العيادة' },
                    { tag: '{الطبيب}', label: 'الطبيب' },
                    { tag: '{التاريخ}', label: 'تاريخ الموعد' },
                    { tag: '{التوقيت}', label: 'الساعة' },
                  ].map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => handleInsertTag(t.tag)}
                      className="text-[11px] font-bold bg-white border border-gray-200 text-emerald-800 hover:bg-emerald-50 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      +{t.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={3}
                value={tempSettings.messageTemplate}
                onChange={(e) => setTempSettings({ ...tempSettings, messageTemplate: e.target.value })}
                className="w-full border rounded-xl p-3 bg-white text-xs text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed font-sans"
              />
            </div>

            {/* معاينة حية لشكل التذكير */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs flex items-start gap-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <span className="text-[11px] font-bold text-gray-400 block mb-0.5">معاينة الرسالة للمريض:</span>
                <p className="text-gray-700 font-medium leading-relaxed">
                  {tempSettings.messageTemplate
                    .replace(/{المريض}/g, 'أحمد محمود')
                    .replace(/{العيادة}/g, 'عيادة الباطنة التخصصية')
                    .replace(/{الطبيب}/g, 'أحمد عادل')
                    .replace(/{التاريخ}/g, 'الخميس 2 أكتوبر 2026')
                    .replace(/{التوقيت}/g, '05:30 م')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setTempSettings(DEFAULT_REMINDER_SETTINGS)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 font-semibold cursor-pointer"
              >
                استعادة القالب الافتراضي
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* كروت الإحصائيات الأربعة السريعة */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-t-4 border-t-blue-500 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500">مواعيد الـ 24 ساعة القادمة</span>
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-3xl font-black text-blue-600">{stats.upcoming24hCount}</p>
            <p className="text-[11px] text-gray-400 mt-1">مواعيد مجدولة لليوم وغداً</p>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-amber-500 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500">مستحقة للإرسال الآن</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-3xl font-black text-amber-600">{stats.dueCount}</p>
            <p className="text-[11px] text-gray-400 mt-1">قبل الموعد بـ 24 ساعة ولم تُرسل بعد</p>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-emerald-500 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500">تذكيرات أُرسلت بنجاح</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-3xl font-black text-emerald-600">{stats.remindedCount}</p>
            <p className="text-[11px] text-gray-400 mt-1">تم إشعار المرضى عبر Push / SMS</p>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-purple-500 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500">قنوات التذكير المفعلة</span>
              <Smartphone className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-sm font-black text-purple-700 mt-2">
              {settings.channels === 'both' ? 'رسائل SMS + إشعارات Push' : settings.channels === 'push' ? 'إشعارات Push فقط' : 'رسائل SMS فقط'}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">إرسال تلقائي قبل الموعد بـ {settings.leadTimeHours} ساعة</p>
          </CardContent>
        </Card>
      </div>

      {/* التبديل بين طابور مواعيد الـ 24 ساعة وسجل التذكيرات */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            طابور مواعيد الـ 24 ساعة ({appointments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            سجل التذكيرات المرسلة ({history.length})
          </button>
        </div>

        {activeTab === 'queue' ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالمريض، الهاتف، العيادة..."
                className="border rounded-xl py-1.5 pr-3 pl-8 text-xs w-52 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border rounded-xl py-1.5 px-3 text-xs bg-white font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">كل الحالات</option>
              <option value="due">مستحقة للإرسال فقط ({stats.dueCount})</option>
              <option value="reminded">تم تذكيرها سابقاً ({stats.remindedCount})</option>
            </select>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleExportHistoryToExcel}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>تصدير السجل إلى Excel</span>
          </button>
        )}
      </div>

      {/* محتوى التبويب: طابور مواعيد الـ 24 ساعة */}
      {activeTab === 'queue' && (
        <Card className="shadow-xs border-gray-200">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : loadError ? (
              <ErrorState message={loadError} onRetry={fetchRemindersData} compact />
            ) : filteredAppointments.length === 0 ? (
              <div className="p-12 text-center text-gray-500 font-bold text-sm">
                {appointments.length === 0
                  ? 'لا توجد مواعيد كشوفات قادمة مسجلة في نافذة الـ 24-48 ساعة الحالية.'
                  : 'لا توجد نتائج مطابقة لخيارات الفلترة والبحث.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100/70 border-b text-gray-700">
                      <th className="p-3.5 font-bold">المريض</th>
                      <th className="p-3.5 font-bold">الهاتف والتواصل</th>
                      <th className="p-3.5 font-bold">العيادة والطبيب</th>
                      <th className="p-3.5 font-bold">موعد الكشف</th>
                      <th className="p-3.5 font-bold">الوقت المتبقي</th>
                      <th className="p-3.5 font-bold">حالة التذكير</th>
                      <th className="p-3.5 font-bold text-center">إجراءات التذكير</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAppointments.map((appt) => {
                      const patientName = appt.patient
                        ? `${appt.patient.first_name || ''} ${appt.patient.last_name || ''}`.trim()
                        : 'مريض';
                      const phone = appt.patient?.phone;
                      const doctorName = appt.doctor?.profiles
                        ? `د. ${appt.doctor.profiles.first_name || ''} ${appt.doctor.profiles.last_name || ''}`.trim()
                        : 'غير محدد';
                      const clinicName = appt.clinic?.name || 'المركز';
                      const dateObj = new Date(appt.appointment_date);
                      const isSending = sendingSingleId === appt.id;

                      return (
                        <tr key={appt.id} className="hover:bg-gray-50/80 transition-colors">
                          {/* بيانات المريض */}
                          <td className="p-3.5">
                            <span className="font-bold text-gray-800 block text-sm">{patientName}</span>
                            {appt.patient?.patient_code && (
                              <span className="text-[11px] text-gray-400 font-mono">
                                #{appt.patient.patient_code}
                              </span>
                            )}
                          </td>

                          {/* الهاتف وأزرار التواصل السريع */}
                          <td className="p-3.5">
                            {phone ? (
                              <div className="space-y-1">
                                <span className="font-mono text-gray-700 font-bold block" dir="ltr">
                                  {phone}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {appt.smsUrl && (
                                    <a
                                      href={appt.smsUrl}
                                      className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 font-bold"
                                      title="إرسال SMS مباشرة عبر تطبيق الرسائل"
                                    >
                                      <Smartphone className="w-3 h-3" />
                                      SMS
                                    </a>
                                  )}
                                  {appt.whatsAppUrl && (
                                    <a
                                      href={appt.whatsAppUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 font-bold"
                                      title="إرسال رسالة تذكير عبر واتساب"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      واتساب
                                    </a>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">لا يوجد هاتف</span>
                            )}
                          </td>

                          {/* العيادة والطبيب */}
                          <td className="p-3.5">
                            <div className="font-semibold text-gray-800 flex items-center gap-1">
                              <Building className="w-3 h-3 text-gray-400" />
                              <span>{clinicName}</span>
                            </div>
                            <div className="text-gray-500 text-[11px] flex items-center gap-1 mt-0.5">
                              <Stethoscope className="w-3 h-3 text-gray-400" />
                              <span>{doctorName}</span>
                            </div>
                          </td>

                          {/* موعد الكشف */}
                          <td className="p-3.5">
                            <span className="font-bold text-gray-800 block">
                              {dateObj.toLocaleDateString('ar-EG', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className="text-emerald-700 font-bold font-mono">
                              {dateObj.toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </td>

                          {/* الوقت المتبقي */}
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1 ${
                                appt.hoursRemaining <= 24
                                  ? 'bg-amber-100 text-amber-800 font-black'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {appt.hoursRemaining > 0
                                ? `متبقي ${appt.hoursRemaining} ساعة`
                                : 'الموعد الآن'}
                            </span>
                          </td>

                          {/* حالة التذكير */}
                          <td className="p-3.5">
                            {appt.isReminded ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                تم الإرسال (24h)
                              </span>
                            ) : appt.isDue ? (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-lg font-bold text-[11px] animate-pulse">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                مستحق للتذكير الآن
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[11px]">في انتظار دورة الـ 24h</span>
                            )}
                          </td>

                          {/* إجراء إرسال التذكير */}
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleSendSingle(appt.id)}
                              disabled={isSending}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                                appt.isReminded
                                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                              title="إرسال تذكير فوري (Push + SMS)"
                            >
                              {isSending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3 h-3" />
                              )}
                              <span>{appt.isReminded ? 'إعادة الإرسال' : 'إرسال تذكير 24h'}</span>
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
      )}

      {/* محتوى التبويب: سجل التذكيرات المرسلة */}
      {activeTab === 'history' && (
        <Card className="shadow-xs border-gray-200">
          <CardContent className="p-0">
            {history.length === 0 ? (
              <div className="p-12 text-center text-gray-500 font-bold text-sm">
                لا توجد تذكيرات مرسلة مسجلة في الأرشيف حتى الآن. سيتم توثيق كل تذكير يُرسل تلقائياً هنا.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100/70 border-b text-gray-700">
                      <th className="p-3.5 font-bold">توقيت الإرسال</th>
                      <th className="p-3.5 font-bold">المريض</th>
                      <th className="p-3.5 font-bold">الهاتف</th>
                      <th className="p-3.5 font-bold">العيادة والطبيب</th>
                      <th className="p-3.5 font-bold">موعد الكشف</th>
                      <th className="p-3.5 font-bold">القناة</th>
                      <th className="p-3.5 font-bold">الحالة</th>
                      <th className="p-3.5 font-bold">نص التذكير</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3.5 text-gray-600 font-mono" dir="ltr">
                          {new Date(log.sentAt).toLocaleString('ar-EG', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3.5 font-bold text-gray-800">{log.patientName}</td>
                        <td className="p-3.5 font-mono text-gray-600" dir="ltr">
                          {log.patientPhone || '---'}
                        </td>
                        <td className="p-3.5 text-gray-700">
                          {log.clinicName} {log.doctorName ? `(${log.doctorName})` : ''}
                        </td>
                        <td className="p-3.5 text-gray-700 font-semibold" dir="ltr">
                          {new Date(log.appointmentDate).toLocaleString('ar-EG', {
                            weekday: 'short',
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3.5">
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold text-[11px]">
                            {log.channel === 'both' ? 'Push + SMS' : log.channel === 'push' ? 'Push' : 'SMS'}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold text-[11px] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            تم بنجاح
                          </span>
                        </td>
                        <td className="p-3.5 text-gray-600 max-w-xs truncate" title={log.message}>
                          {log.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
