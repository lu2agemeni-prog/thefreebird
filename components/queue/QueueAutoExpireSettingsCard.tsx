'use client';

// ============================================================================
// components/queue/QueueAutoExpireSettingsCard.tsx
// كارت ولوحة تحكم المدير في مدة الإنهاء التلقائي لأدوار النداء الآلي:
// - خيارات سريعة: ساعة، ساعتان، 3 ساعات، 4 ساعات
// - خيار: نهاية اليوم عند الساعة 12:00 منتصف الليل (12 م/ص)
// - خيار: مدة مخصصة بالدقائق أو الساعات
// - حفظ وتطبيق فوري على كافة الشاشات وقاعدة البيانات مع إمكانية التنظيف الفوري
// ============================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Clock,
  CheckCircle2,
  Moon,
  Sparkles,
  Save,
  RotateCcw,
  Loader2,
  AlertCircle,
  Zap,
  Sliders,
  Check,
} from 'lucide-react';
import {
  QueueAutoExpireConfig,
  QueueAutoExpireMode,
  DEFAULT_QUEUE_AUTO_EXPIRE_CONFIG,
  fetchQueueAutoExpireConfig,
  saveQueueAutoExpireConfig,
  formatExpiryConfigSummary,
  autoCompleteExpiredQueueItems,
  triggerAutoCompleteServer,
} from '@/lib/queue-auto-complete';

interface QueueAutoExpireSettingsCardProps {
  onSaved?: (newConfig: QueueAutoExpireConfig) => void;
  className?: string;
  isCompact?: boolean;
}

export function QueueAutoExpireSettingsCard({
  onSaved,
  className = '',
  isCompact = false,
}: QueueAutoExpireSettingsCardProps) {
  const [config, setConfig] = useState<QueueAutoExpireConfig>(DEFAULT_QUEUE_AUTO_EXPIRE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [cleanedCount, setCleanedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // حقل التخصيص اليدوي
  const [isCustom, setIsCustom] = useState(false);
  const [customHoursInput, setCustomHoursInput] = useState('2');
  const [customMinutesInput, setCustomMinutesInput] = useState('');

  // جلب الإعدادات الحالية عند التحميل
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const loaded = await fetchQueueAutoExpireConfig(supabase);
        if (active) {
          setConfig(loaded);
          if (loaded.customMinutes) {
            setIsCustom(true);
            setCustomMinutesInput(String(loaded.customMinutes));
          } else if (loaded.mode === 'hours' && ![1, 2, 3, 4, 6].includes(loaded.hours)) {
            setIsCustom(true);
            setCustomHoursInput(String(loaded.hours));
          }
        }
      } catch (e: any) {
        if (active) setError('تعذر جلب إعدادات الإنهاء التلقائي.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  // اختيار نمط محدد
  const handleSelectPreset = (preset: { mode: QueueAutoExpireMode; hours: number }) => {
    setIsCustom(false);
    setError(null);
    setConfig((prev) => ({
      ...prev,
      mode: preset.mode,
      hours: preset.hours,
      customMinutes: undefined,
    }));
  };

  // اختيار التخصيص اليدوي
  const handleSelectCustom = () => {
    setIsCustom(true);
    setError(null);
    const hrs = parseInt(customHoursInput, 10) || 2;
    setConfig((prev) => ({
      ...prev,
      mode: 'hours',
      hours: hrs,
      customMinutes: customMinutesInput ? parseInt(customMinutesInput, 10) : undefined,
    }));
  };

  // حفظ الإعدادات وتطبيقها
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    setCleanedCount(null);

    let finalConfig: QueueAutoExpireConfig = { ...config };

    if (isCustom) {
      if (customMinutesInput) {
        const mins = parseInt(customMinutesInput, 10);
        if (isNaN(mins) || mins <= 0) {
          setError('يرجى إدخال عدد دقائق صحيح وموجب.');
          setSaving(false);
          return;
        }
        finalConfig = {
          mode: 'hours',
          hours: Math.max(1, Math.round(mins / 60)),
          customMinutes: mins,
        };
      } else {
        const hrs = parseInt(customHoursInput, 10);
        if (isNaN(hrs) || hrs <= 0) {
          setError('يرجى إدخال عدد ساعات صحيح وموجب.');
          setSaving(false);
          return;
        }
        finalConfig = {
          mode: 'hours',
          hours: hrs,
          customMinutes: undefined,
        };
      }
    }

    try {
      const res = await saveQueueAutoExpireConfig(finalConfig, supabase);
      if (res.success) {
        setConfig(res.config);
        setSaveSuccess(true);
        onSaved?.(res.config);
        setTimeout(() => setSaveSuccess(false), 4500);
      } else {
        setError(res.error || 'تعذر حفظ الإعدادات.');
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء حفظ الإعدادات.');
    } finally {
      setSaving(false);
    }
  };

  // تنظيف الحالات المنتهية الآن فوراً
  const handleCleanNow = async () => {
    setCleaning(true);
    setError(null);
    setCleanedCount(null);
    try {
      await triggerAutoCompleteServer(config);
      const res = await autoCompleteExpiredQueueItems(supabase, config);
      setCleanedCount(res.completedCount);
      setTimeout(() => setCleanedCount(null), 5000);
    } catch (e: any) {
      setError('تعذر تنفيذ التنظيف الفوري.');
    } finally {
      setCleaning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-2xl border border-gray-100 shadow-xs">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span className="mr-3 text-sm font-bold text-gray-600">جاري تحميل إعدادات الإنهاء التلقائي...</span>
      </div>
    );
  }

  return (
    <Card className={`border-emerald-200/90 shadow-md overflow-hidden bg-white ${className}`}>
      <CardHeader className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-xs border border-white/20">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-white flex items-center gap-2">
                <span>تحديد مدة الإنهاء التلقائي للأدوار (تحكم المدير)</span>
                <span className="bg-emerald-400 text-emerald-950 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {formatExpiryConfigSummary(config)}
                </span>
              </CardTitle>
              <CardDescription className="text-emerald-100 text-xs mt-0.5">
                تحديد بعد كم من الوقت تنتهي مقابلة المريض تلقائياً وتُستبعد من شاشات النداء إذا نسي الطبيب أو السكرتارية إنهاءها.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleCleanNow}
              disabled={cleaning}
              className="bg-white/15 hover:bg-white/25 text-white border border-white/25 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              title="فحص وتنظيف كافة الحالات المنتهية الآن فوراً"
            >
              {cleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-300" />}
              <span>تنظيف فوري الآن</span>
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-900 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs animate-in fade-in duration-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>تم حفظ الإعدادات وتطبيقها فوريًا على كافة شاشات النداء وأجهزة المركز بنجاح! 🎉</span>
          </div>
        )}

        {cleanedCount !== null && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              {cleanedCount > 0
                ? `تم إنهاء وإزالة ${cleanedCount} دور منتهي بنجاح من الشاشات.`
                : 'لا توجد أدوار منتهية حالياً، كافة الحالات نشطة وضمن المدة المحددة.'}
            </span>
          </div>
        )}

        {/* شبكة الخيارات الرئيسية */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* خيار: ساعة واحدة */}
          <button
            type="button"
            onClick={() => handleSelectPreset({ mode: 'hours', hours: 1 })}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 relative ${
              config.mode === 'hours' && config.hours === 1 && !isCustom
                ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50/50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span className="font-black text-gray-900 text-base">ساعة واحدة</span>
              </div>
              {config.mode === 'hours' && config.hours === 1 && !isCustom && (
                <Check className="w-4 h-4 text-emerald-600 font-bold" />
              )}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              (60 دقيقة) — مناسب للعيادات سريعة الكشف لمنع بقاء أي مريض منسي على الشاشة.
            </p>
          </button>

          {/* خيار: ساعتان (الافتراضي) */}
          <button
            type="button"
            onClick={() => handleSelectPreset({ mode: 'hours', hours: 2 })}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 relative ${
              config.mode === 'hours' && config.hours === 2 && !isCustom
                ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50/50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span className="font-black text-gray-900 text-base">ساعتان (120 دقيقة)</span>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                الافتراضي القياسي
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              المدة الموصى بها لإعطاء وقت كافٍ للمقابلة والكشف والاستراحة ثم الإنهاء التلقائي.
            </p>
          </button>

          {/* خيار: 3 ساعات */}
          <button
            type="button"
            onClick={() => handleSelectPreset({ mode: 'hours', hours: 3 })}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 relative ${
              config.mode === 'hours' && config.hours === 3 && !isCustom
                ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50/50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span className="font-black text-gray-900 text-base">3 ساعات (180 دقيقة)</span>
              </div>
              {config.mode === 'hours' && config.hours === 3 && !isCustom && (
                <Check className="w-4 h-4 text-emerald-600 font-bold" />
              )}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              للعيادات ذات الإجراءات المتوسطة أو جلسات التحاليل والأشعة والمتابعة.
            </p>
          </button>

          {/* خيار: 4 ساعات */}
          <button
            type="button"
            onClick={() => handleSelectPreset({ mode: 'hours', hours: 4 })}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 relative ${
              config.mode === 'hours' && config.hours === 4 && !isCustom
                ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50/50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span className="font-black text-gray-900 text-base">4 ساعات (240 دقيقة)</span>
              </div>
              {config.mode === 'hours' && config.hours === 4 && !isCustom && (
                <Check className="w-4 h-4 text-emerald-600 font-bold" />
              )}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              للعمليات الصغرى أو الجلسات الطويلة مثل العلاج الطبيعي والأسنان.
            </p>
          </button>

          {/* خيار: 6 ساعات أو أكثر */}
          <button
            type="button"
            onClick={() => handleSelectPreset({ mode: 'hours', hours: 6 })}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 relative ${
              config.mode === 'hours' && config.hours === 6 && !isCustom
                ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50/50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span className="font-black text-gray-900 text-base">6 ساعات (360 دقيقة)</span>
              </div>
              {config.mode === 'hours' && config.hours === 6 && !isCustom && (
                <Check className="w-4 h-4 text-emerald-600 font-bold" />
              )}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              تغطية نصف يوم كامل أو وردية عمل مطولة بالمركز قبل الإنهاء التلقائي.
            </p>
          </button>

          {/* خيار: بعد انتهاء اليوم 12 منتصف الليل (12 م) */}
          <button
            type="button"
            onClick={() => handleSelectPreset({ mode: 'end_of_day', hours: 24 })}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 relative sm:col-span-2 lg:col-span-1 ${
              config.mode === 'end_of_day' && !isCustom
                ? 'border-indigo-600 bg-indigo-50/80 shadow-sm ring-2 ring-indigo-500/20'
                : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50/50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-600" />
                <span className="font-black text-gray-900 text-base">بعد انتهاء اليوم (12:00 م)</span>
              </div>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                منتصف الليل 12:00
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              تظل الحالة مسجلة طوال ساعات اليوم وتنتهي تلقائياً عند انتهاء اليوم (12:00 ليلاً / 12 م).
            </p>
          </button>

          {/* خيار: مدة مخصصة */}
          <button
            type="button"
            onClick={handleSelectCustom}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 relative sm:col-span-2 lg:col-span-1 ${
              isCustom
                ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50/50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <span className="font-black text-gray-900 text-base">تخصيص يدوي لأي مدة</span>
              </div>
              {isCustom && <Check className="w-4 h-4 text-emerald-600 font-bold" />}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              تحديد أي عدد ساعات مخصص (ساعة، ساعتان، 5، 8، 12 ساعة) أو بالدقائق بدقة.
            </p>
          </button>
        </div>

        {/* مدخلات التخصيص اليدوي */}
        {isCustom && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 animate-in fade-in duration-200">
            <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              <span>تحديد المدة المخصصة يدوياً:</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 font-bold mb-1">
                  المدة بالساعات (مثال: 5 ساعات أو 6 ساعات):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="48"
                    value={customHoursInput}
                    onChange={(e) => {
                      setCustomHoursInput(e.target.value);
                      setCustomMinutesInput('');
                    }}
                    placeholder="مثال: 5"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-gray-500 shrink-0">ساعة</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 font-bold mb-1">
                  أو المدة الإجمالية بالدقائق (مثال: 90 أو 150 دقيقة):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="2880"
                    value={customMinutesInput}
                    onChange={(e) => setCustomMinutesInput(e.target.value)}
                    placeholder="مثال: 90"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-gray-500 shrink-0">دقيقة</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* بطاقة توضيحية لآلية العمل الحالية */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-emerald-950">
              <p className="font-bold">
                الوضع النشط حالياً: {formatExpiryConfigSummary(config)}
              </p>
              <p className="text-emerald-800 leading-relaxed text-[11px]">
                {config.mode === 'end_of_day'
                  ? 'أي حالة مسجلة اليوم تظل نشطة في شاشات النداء حتى الساعة 12:00 منتصف الليل (نهاية اليوم)، وبعدها تُعتبر منتهية وتختفي تلقائياً.'
                  : `أي حالة يمر على تسجيلها ${formatExpiryConfigSummary(config)} دون قيام الطبيب أو السكرتارية بإنهاء المقابلة، تُعتبر منتهية وتختفي تلقائياً من شاشة النداء.`}
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 shrink-0 self-end sm:self-auto"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4" />}
            <span>حفظ وتطبيق الضبط فوراً</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
