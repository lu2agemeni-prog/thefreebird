'use client';

// ============================================================================
// components/queue/QueueLayoutSettingsModal.tsx
// لوحة التحكم الشاملة لتنسيق شاشة النداء الآلي بالكامل:
// - مخططات جاهزة لتقسيم الشاشة (قوالب سينمائية، تركيز على النداء، بانوراما العيادات...)
// - المقاسات والأبعاد بالكامل (الميديا، العيادات، النداء، الانتظار، الخطوط، الصور، الهيدر...)
// - الأماكن والترتيب (أعمدة رأسية كاملة، صفوف أفقية، ترتيب العمود الجانبي، يمين/يسار)
// - شريط الأخبار والسرعة الهادئة (سلحفاة 240s، هادئ 160s، مريح 120s، فواصل، اتجاه)
// - الفترات والتوقيتات والصوت (إعلانات الأطباء، مدة إشعار النداء، مدة الشرائح، الانتقالات)
// - الخطوط والنصوص (Cairo, Tajawal, Almarai, Readex, IBM Plex, سمك الخط، نمط الأرقام)
// - الألوان والقوالب (11 ثيم فاخر، تخصيص يدوي حر لجميع الألوان)
// - عرض وإخفاء كافة الأقسام
// ============================================================================

import React, { useState } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Sliders,
  Move,
  Palette,
  Type,
  Newspaper,
  Save,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  LayoutGrid,
  Check,
  AlertCircle,
  Loader2,
  Volume2,
  Stethoscope,
  Clock,
  Image as ImageIcon,
  Layers,
  Zap,
  Maximize2,
  Radio,
} from 'lucide-react';
import {
  QueueLayoutConfig,
  THEME_PRESETS,
  LAYOUT_BLUEPRINTS,
  ThemePresetKey,
  LayoutBlueprintKey,
  FontFamilyOption,
  SideStackOrder,
  TickerSeparator,
} from '@/lib/queue-layout-config';

interface QueueLayoutSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: QueueLayoutConfig;
  onChange: (updated: QueueLayoutConfig) => void;
  onSaveToDB: () => Promise<void>;
  onResetToDefaults: () => void;
  isSaving: boolean;
  saveSuccess: boolean;
}

type TabKey =
  | 'blueprints'
  | 'dimensions'
  | 'layout'
  | 'ticker'
  | 'audio_announcements'
  | 'typography'
  | 'colors'
  | 'visibility';

export function QueueLayoutSettingsModal({
  isOpen,
  onClose,
  config,
  onChange,
  onSaveToDB,
  onResetToDefaults,
  isSaving,
  saveSuccess,
}: QueueLayoutSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('blueprints');

  if (!isOpen) return null;

  const updateConfig = (partial: Partial<QueueLayoutConfig>) => {
    onChange({
      ...config,
      ...partial,
    });
  };

  const applyThemePreset = (presetKey: ThemePresetKey) => {
    if (presetKey === 'custom') {
      updateConfig({ themePreset: 'custom' });
      return;
    }
    const preset = THEME_PRESETS[presetKey];
    if (preset?.colors) {
      updateConfig({
        themePreset: presetKey,
        ...preset.colors,
      });
    }
  };

  const applyLayoutBlueprint = (blueprintKey: LayoutBlueprintKey) => {
    if (blueprintKey === 'custom') return;
    const bp = LAYOUT_BLUEPRINTS[blueprintKey];
    if (bp?.config) {
      updateConfig(bp.config);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-5 overflow-y-auto"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] text-white animate-in zoom-in-95 duration-200">
        {/* الترويسة العلوية للمودال */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-wide text-white">
                  مركز التحكم وتنسيق شاشة النداء الشامل
                </h2>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  تحديث فوري
                </span>
              </div>
              <p className="text-xs text-slate-400">
                مخططات جاهزة، مقاسات دقيقة، سرعة شريط هادئة، خطوط عربية، ألوان وثيمات، وأماكن الأقسام
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* شريط التبويبات الرئيسي الشامل */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 bg-slate-950/70 border-b border-slate-800/80 overflow-x-auto scrollbar-none shrink-0">
          <TabButton
            active={activeTab === 'blueprints'}
            onClick={() => setActiveTab('blueprints')}
            icon={<LayoutGrid className="w-4 h-4 text-amber-400" />}
            label="مخططات جاهزة لتقسيم الشاشة"
            badge="مهم"
          />
          <TabButton
            active={activeTab === 'dimensions'}
            onClick={() => setActiveTab('dimensions')}
            icon={<Sliders className="w-4 h-4 text-emerald-400" />}
            label="المقاسات والأبعاد"
          />
          <TabButton
            active={activeTab === 'layout'}
            onClick={() => setActiveTab('layout')}
            icon={<Move className="w-4 h-4 text-blue-400" />}
            label="الأماكن والترتيب"
          />
          <TabButton
            active={activeTab === 'ticker'}
            onClick={() => setActiveTab('ticker')}
            icon={<Newspaper className="w-4 h-4 text-amber-300" />}
            label="شريط الأخبار والسرعة"
            badge="تحكم هادئ"
          />
          <TabButton
            active={activeTab === 'audio_announcements'}
            onClick={() => setActiveTab('audio_announcements')}
            icon={<Volume2 className="w-4 h-4 text-teal-400" />}
            label="الصوت والتوقيتات"
          />
          <TabButton
            active={activeTab === 'typography'}
            onClick={() => setActiveTab('typography')}
            icon={<Type className="w-4 h-4 text-purple-400" />}
            label="الخطوط والنصوص"
          />
          <TabButton
            active={activeTab === 'colors'}
            onClick={() => setActiveTab('colors')}
            icon={<Palette className="w-4 h-4 text-pink-400" />}
            label="الألوان والثيمات (11)"
          />
          <TabButton
            active={activeTab === 'visibility'}
            onClick={() => setActiveTab('visibility')}
            icon={<Eye className="w-4 h-4 text-slate-300" />}
            label="الأقسام والعرض"
          />
        </div>

        {/* جسم الإعدادات حسب التبويب */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ========================================================================= */}
          {/* 1. تبويب المخططات الجاهزة لتقسيم الشاشة (Layout Blueprints) */}
          {/* ========================================================================= */}
          {activeTab === 'blueprints' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-500/40 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                <div className="space-y-1 text-center sm:text-right">
                  <div className="inline-flex items-center gap-1.5 text-xs font-black text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-0.5 rounded-full mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>مخططك المفضل المطلوب (70% ميديا)</span>
                  </div>
                  <h4 className="text-base font-black text-white">
                    الميديا على اليسار (70%) + العيادات والنداء وقائمة الانتظار فوق بعض على اليمين
                  </h4>
                  <p className="text-xs text-slate-300">
                    يعطي شاشة الميديا المساحة الأكبر للظهور مع رص كروت العيادات والنداء المباشر والانتظار رأسياً بجانبها.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => applyLayoutBlueprint('cinema_left')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm px-6 py-3 rounded-xl transition-all shadow-md shrink-0 cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>تطبيق هذا التخطيط الموصى به</span>
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-amber-400" />
                    <span>مكتبة المخططات الجاهزة لتقسيم الشاشة بلمسة زر واحدة:</span>
                  </h3>
                  <span className="text-xs text-slate-400">اضغط على أي مخطط لتطبيقه ومعاينته فوراً</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {(Object.keys(LAYOUT_BLUEPRINTS) as LayoutBlueprintKey[])
                    .filter((k) => k !== 'custom')
                    .map((bpKey) => {
                      const bp = LAYOUT_BLUEPRINTS[bpKey];
                      const isCinemaLeft = bpKey === 'cinema_left';
                      const isCurrentlyActive =
                        (bpKey === 'cinema_left' &&
                          config.screenLayoutMode === 'split_columns' &&
                          config.mediaPosition === 'left' &&
                          config.mediaWidthPct === 70) ||
                        (bpKey === 'cinema_right' &&
                          config.screenLayoutMode === 'split_columns' &&
                          config.mediaPosition === 'right' &&
                          config.mediaWidthPct === 70) ||
                        (bpKey === 'media_giant' &&
                          config.screenLayoutMode === 'split_columns' &&
                          config.mediaWidthPct >= 80) ||
                        (bpKey === 'half_and_half' &&
                          config.screenLayoutMode === 'split_columns' &&
                          config.mediaWidthPct === 50) ||
                        (bpKey === 'call_focus' && config.tokenFontSize >= 96) ||
                        (bpKey === 'pure_queue_no_media' && !config.showMedia) ||
                        (bpKey === 'classic_rows' && config.screenLayoutMode === 'classic_rows');

                      return (
                        <div
                          key={bpKey}
                          onClick={() => applyLayoutBlueprint(bpKey)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative group ${
                            isCurrentlyActive
                              ? 'border-emerald-500 bg-emerald-950/40 ring-2 ring-emerald-500/30'
                              : 'border-slate-700/80 bg-slate-850 hover:bg-slate-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                  isCinemaLeft
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-slate-700/60 text-slate-300 border-slate-600'
                                }`}
                              >
                                {bp.badge}
                              </span>
                              {isCurrentlyActive && (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>مطبّق الآن</span>
                                </span>
                              )}
                            </div>

                            <h4 className="font-bold text-sm text-white">{bp.name}</h4>
                            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{bp.desc}</p>
                          </div>

                          {/* تمثيل بصري مصغر لهيكل الشاشة */}
                          <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 w-full h-8 bg-slate-900 rounded-lg p-1 border border-slate-750">
                              {bpKey === 'cinema_left' && (
                                <>
                                  <div className="w-[30%] h-full bg-slate-700 rounded flex items-center justify-center text-[9px] text-slate-300 font-bold">
                                    عيادات
                                  </div>
                                  <div className="w-[70%] h-full bg-emerald-700/60 rounded flex items-center justify-center text-[9px] text-emerald-200 font-black">
                                    ميديا 70%
                                  </div>
                                </>
                              )}
                              {bpKey === 'cinema_right' && (
                                <>
                                  <div className="w-[70%] h-full bg-emerald-700/60 rounded flex items-center justify-center text-[9px] text-emerald-200 font-black">
                                    ميديا 70%
                                  </div>
                                  <div className="w-[30%] h-full bg-slate-700 rounded flex items-center justify-center text-[9px] text-slate-300 font-bold">
                                    عيادات
                                  </div>
                                </>
                              )}
                              {bpKey === 'media_giant' && (
                                <>
                                  <div className="w-[20%] h-full bg-slate-700 rounded flex items-center justify-center text-[8px] text-slate-300 font-bold">
                                    نداء
                                  </div>
                                  <div className="w-[80%] h-full bg-emerald-700/60 rounded flex items-center justify-center text-[9px] text-emerald-200 font-black">
                                    ميديا 80%
                                  </div>
                                </>
                              )}
                              {bpKey === 'half_and_half' && (
                                <>
                                  <div className="w-[50%] h-full bg-slate-700 rounded flex items-center justify-center text-[9px] text-slate-300 font-bold">
                                    نداء 50%
                                  </div>
                                  <div className="w-[50%] h-full bg-emerald-700/60 rounded flex items-center justify-center text-[9px] text-emerald-200 font-black">
                                    ميديا 50%
                                  </div>
                                </>
                              )}
                              {bpKey === 'call_focus' && (
                                <>
                                  <div className="w-[48%] h-full bg-amber-600/60 rounded flex items-center justify-center text-[9px] text-amber-200 font-black">
                                    نداء ضخم #104
                                  </div>
                                  <div className="w-[52%] h-full bg-emerald-700/60 rounded flex items-center justify-center text-[9px] text-emerald-200 font-bold">
                                    ميديا 52%
                                  </div>
                                </>
                              )}
                              {bpKey === 'clinics_wall' && (
                                <>
                                  <div className="w-[60%] h-full bg-blue-700/60 rounded flex items-center justify-center text-[9px] text-blue-200 font-black">
                                    أطباء وعيادات 60%
                                  </div>
                                  <div className="w-[40%] h-full bg-emerald-700/60 rounded flex items-center justify-center text-[9px] text-emerald-200 font-bold">
                                    ميديا 40%
                                  </div>
                                </>
                              )}
                              {bpKey === 'pure_queue_no_media' && (
                                <div className="w-full h-full bg-blue-800/60 rounded flex items-center justify-center text-[10px] text-blue-100 font-black">
                                  شاشة استدعاء كاملة 100% (عيادات + نداء + انتظار)
                                </div>
                              )}
                              {bpKey === 'cinema_fullscreen_ads' && (
                                <div className="w-full h-full bg-emerald-700/60 rounded flex items-center justify-center text-[10px] text-emerald-100 font-black">
                                  ميديا وإعلانات تلفزيونية 100%
                                </div>
                              )}
                              {bpKey === 'classic_rows' && (
                                <div className="w-full h-full flex flex-col gap-0.5">
                                  <div className="h-1/2 bg-emerald-700/50 rounded text-[8px] flex items-center justify-center font-bold">
                                    قسم علوي (ميديا + عيادات)
                                  </div>
                                  <div className="h-1/2 bg-slate-700 rounded text-[8px] flex items-center justify-center font-bold">
                                    قسم سفلي (نداء + انتظار)
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. تبويب المقاسات والأبعاد بالكامل (Dimensions) */}
          {/* ========================================================================= */}
          {activeTab === 'dimensions' && (
            <div className="space-y-6">
              {/* عرض قسم الميديا */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-white">نسبة عرض قسم الميديا</span>
                  <span className="text-emerald-400 font-mono text-base bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-xl">
                    الميديا {config.mediaWidthPct}% / العمود الجانبي {100 - config.mediaWidthPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={85}
                  step={5}
                  value={config.mediaWidthPct}
                  onChange={(e) => updateConfig({ mediaWidthPct: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                />
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[
                    { pct: 50, label: '50% (متساوي)' },
                    { pct: 60, label: '60% (ميديا عريضة)' },
                    { pct: 70, label: '70% (الموصى به)' },
                    { pct: 80, label: '80% (ميديا عملاقة)' },
                  ].map((p) => (
                    <button
                      key={p.pct}
                      type="button"
                      onClick={() => updateConfig({ mediaWidthPct: p.pct })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        config.mediaWidthPct === p.pct
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* حجم خط رقم النداء وتفاصيله */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-white">حجم خط رقم النداء المباشر</span>
                    <span className="text-amber-400 font-mono text-base bg-amber-950/80 border border-amber-500/40 px-3 py-1 rounded-xl">
                      {config.tokenFontSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={44}
                    max={130}
                    step={4}
                    value={config.tokenFontSize}
                    onChange={(e) => updateConfig({ tokenFontSize: Number(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                  <div
                    className="text-center font-black font-mono tracking-widest text-amber-300 py-1.5 border border-slate-700 rounded-xl bg-slate-950"
                    style={{ fontSize: `${Math.min(config.tokenFontSize * 0.45, 48)}px` }}
                  >
                    #104
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-white">حجم خط تفاصيل النداء (العيادة/الطبيب)</span>
                    <span className="text-emerald-400 font-mono text-base bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-xl">
                      {config.callingDetailsFontSizePx || 14}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={26}
                    step={1}
                    value={config.callingDetailsFontSizePx || 14}
                    onChange={(e) => updateConfig({ callingDetailsFontSizePx: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                  <div className="p-2 border border-slate-700 rounded-xl bg-slate-950 text-center">
                    <span className="text-slate-300 font-bold" style={{ fontSize: `${config.callingDetailsFontSizePx || 14}px` }}>
                      عيادة الأسنان والتجميل
                    </span>
                  </div>
                </div>
              </div>

              {/* مقاس صورة الطبيب في إعلان الميديا وطريقة العرض */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center text-sm font-bold">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-emerald-400" />
                    <span className="text-white">حجم صورة الطبيب في إعلان الميديا</span>
                  </div>
                  <span className="text-emerald-400 font-mono text-base bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-xl">
                    {config.doctorPhotoSizePx || 280}px
                  </span>
                </div>
                <input
                  type="range"
                  min={180}
                  max={500}
                  step={10}
                  value={config.doctorPhotoSizePx || 280}
                  onChange={(e) => updateConfig({ doctorPhotoSizePx: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { label: 'قياسي (220px)', size: 220 },
                    { label: 'كبير (280px)', size: 280 },
                    { label: 'كبير جداً (360px)', size: 360 },
                    { label: 'عملاق (460px)', size: 460 },
                  ].map((preset) => (
                    <button
                      key={preset.size}
                      type="button"
                      onClick={() => updateConfig({ doctorPhotoSizePx: preset.size })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        config.doctorPhotoSizePx === preset.size
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs">
                  <span className="text-slate-400">طريقة عرض إعلان الطبيب:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateConfig({ doctorCardLayout: 'side_by_side' })}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer ${
                        config.doctorCardLayout === 'side_by_side'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      بجانب بعض (أفقي)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConfig({ doctorCardLayout: 'stacked' })}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer ${
                        config.doctorCardLayout === 'stacked'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      صورة بارزة بالوسط (رأسي)
                    </button>
                  </div>
                </div>
              </div>

              {/* خطوط كروت العيادات وقائمة الانتظار وصورة الطبيب بالكرت */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span>خط بطاقات العيادات</span>
                    <span className="text-emerald-400 font-mono">{config.clinicsFontSizePx || 14}px</span>
                  </div>
                  <input
                    type="range"
                    min={11}
                    max={22}
                    step={1}
                    value={config.clinicsFontSizePx || 14}
                    onChange={(e) => updateConfig({ clinicsFontSizePx: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span>خط عناصر قائمة الانتظار</span>
                    <span className="text-emerald-400 font-mono">{config.waitingListFontSizePx || 12}px</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={20}
                    step={1}
                    value={config.waitingListFontSizePx || 12}
                    onChange={(e) => updateConfig({ waitingListFontSizePx: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span>صورة الطبيب بكارت العيادة</span>
                    <span className="text-emerald-400 font-mono">{config.doctorCardPhotoSizePx || 44}px</span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={68}
                    step={2}
                    value={config.doctorCardPhotoSizePx || 44}
                    onChange={(e) => updateConfig({ doctorCardPhotoSizePx: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                </div>
              </div>

              {/* مقاسات الهيدر واسم المركز وزووم الشاشة */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span>ارتفاع الترويسة (الهيدر)</span>
                    <span className="text-emerald-400 font-mono">{config.headerHeightPx || 66}px</span>
                  </div>
                  <input
                    type="range"
                    min={48}
                    max={100}
                    step={2}
                    value={config.headerHeightPx || 66}
                    onChange={(e) => updateConfig({ headerHeightPx: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span>خط اسم المركز بالهيدر</span>
                    <span className="text-emerald-400 font-mono">{config.headerTitleFontSizePx || 20}px</span>
                  </div>
                  <input
                    type="range"
                    min={14}
                    max={30}
                    step={1}
                    value={config.headerTitleFontSizePx || 20}
                    onChange={(e) => updateConfig({ headerTitleFontSizePx: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span>زووم وتكبير الشاشة العام</span>
                    <span className="text-emerald-400 font-mono">{Math.round(config.zoom * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.75}
                    max={1.35}
                    step={0.05}
                    value={config.zoom}
                    onChange={(e) => updateConfig({ zoom: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                </div>
              </div>

              {/* أعمدة العرض وكثافة وتباعد واستدارة الكروت */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">أعمدة قائمة الانتظار</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[1, 2, 3].map((cols) => (
                      <button
                        key={cols}
                        type="button"
                        onClick={() => updateConfig({ waitingListColumns: cols as 1 | 2 | 3 })}
                        className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          config.waitingListColumns === cols
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {cols} {cols === 1 ? 'عمود' : 'أعمدة'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">أعمدة كروت العيادات</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[1, 2, 3].map((cols) => (
                      <button
                        key={cols}
                        type="button"
                        onClick={() => updateConfig({ clinicsGridColumns: cols as 1 | 2 | 3 })}
                        className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          config.clinicsGridColumns === cols
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {cols}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">كثافة وحجم الكروت</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: 'compact', name: 'مضغوط' },
                      { key: 'normal', name: 'قياسي' },
                      { key: 'spacious', name: 'واسع' },
                    ].map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => updateConfig({ cardDensity: d.key as any })}
                        className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          config.cardDensity === d.key
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">استدارة زوايا الكروت</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { key: 'none', label: 'حادة' },
                      { key: 'small', label: 'خفيفة' },
                      { key: 'medium', label: 'متوسطة' },
                      { key: 'large', label: 'دائرية' },
                    ].map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => updateConfig({ cardBorderRadius: r.key as any })}
                        className={`py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                          config.cardBorderRadius === r.key
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. تبويب الأماكن والترتيب (Layout & Placement) */}
          {/* ========================================================================= */}
          {activeTab === 'layout' && (
            <div className="space-y-6">
              {/* اختيار نمط هيكل الشاشة */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">نمط تقسيم وهيكل الشاشة العام</h3>
                <p className="text-xs text-slate-400">اختر طريقة تقسيم الشاشة بين الميديا وأقسام العيادات والنداء</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => updateConfig({ screenLayoutMode: 'split_columns' })}
                    className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                      config.screenLayoutMode === 'split_columns'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/30'
                        : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm">أعمدة رأسية كاملة (ميديا بجانب العيادات والنداء)</div>
                      <div className="text-xs text-slate-400 mt-1">
                        الميديا بارتفاع الشاشة الكامل، والعيادات والنداء وقائمة الانتظار فوق بعض بجانبها
                      </div>
                    </div>
                    {config.screenLayoutMode === 'split_columns' && <Check className="w-5 h-5 text-emerald-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateConfig({ screenLayoutMode: 'classic_rows' })}
                    className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                      config.screenLayoutMode === 'classic_rows'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/30'
                        : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm">صفوف أفقية كلاسيكية (ميديا بالأعلى)</div>
                      <div className="text-xs text-slate-400 mt-1">
                        قسم علوي للميديا والعيادات + قسم سفلي لكارت النداء وقائمة الانتظار
                      </div>
                    </div>
                    {config.screenLayoutMode === 'classic_rows' && <Check className="w-5 h-5 text-emerald-400" />}
                  </button>
                </div>
              </div>

              {/* موضع قسم الميديا (يمين أو يسار) */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">موضع قسم الميديا في الشاشة الرئيسية</h3>
                <p className="text-xs text-slate-400">حدد هل تظهر شريحة الميديا والإعلانات على اليمين أم على اليسار</p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => updateConfig({ mediaPosition: 'left' })}
                    className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                      config.mediaPosition === 'left'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/30'
                        : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm">الميديا على اليسار ▶ (المفضل والموصى به)</div>
                      <div className="text-xs text-slate-400 mt-1">والعيادات والأطباء وقائمة الانتظار على اليمين</div>
                    </div>
                    {config.mediaPosition === 'left' && <Check className="w-5 h-5 text-emerald-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateConfig({ mediaPosition: 'right' })}
                    className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                      config.mediaPosition === 'right'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/30'
                        : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm">الميديا على اليمين ◀</div>
                      <div className="text-xs text-slate-400 mt-1">والعيادات والأطباء وقائمة الانتظار على اليسار</div>
                    </div>
                    {config.mediaPosition === 'right' && <Check className="w-5 h-5 text-emerald-400" />}
                  </button>
                </div>
              </div>

              {/* ترتيب عناصر العمود الجانبي (فوق بعض) */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">ترتيب كروت العمود الجانبي (فوق بعض)</h3>
                <p className="text-xs text-slate-400">حدد ما هو القسم الذي ترغب في ظهوره في أعلى العمود الجانبي</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {[
                    {
                      key: 'call_clinics_queue',
                      title: 'النداء ⬅ العيادات ⬅ الانتظار',
                      desc: 'كارت النداء البارز بالأعلى (الافتراضي)',
                    },
                    {
                      key: 'clinics_call_queue',
                      title: 'العيادات ⬅ النداء ⬅ الانتظار',
                      desc: 'شبكة الأطباء بالأعلى، والنداء بالوسط',
                    },
                    {
                      key: 'call_queue_clinics',
                      title: 'النداء ⬅ الانتظار ⬅ العيادات',
                      desc: 'النداء والانتظار أولاً، والعيادات بالأسفل',
                    },
                  ].map((ord) => (
                    <button
                      key={ord.key}
                      type="button"
                      onClick={() => updateConfig({ sideStackOrder: ord.key as SideStackOrder })}
                      className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
                        config.sideStackOrder === ord.key
                          ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/30'
                          : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs sm:text-sm text-white">{ord.title}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{ord.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ترتيب القسم السفلي (للنمط الأفقي الكلاسيكي) */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">ترتيب القسم السفلي (في حال اختيار النمط الأفقي الكلاسيكي)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => updateConfig({ bottomOrder: 'call_right_queue_left' })}
                    className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                      config.bottomOrder === 'call_right_queue_left'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white'
                        : 'border-slate-700 bg-slate-850 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs">النداء يمين / الانتظار يسار</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateConfig({ bottomOrder: 'call_left_queue_right' })}
                    className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                      config.bottomOrder === 'call_left_queue_right'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white'
                        : 'border-slate-700 bg-slate-850 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs">الانتظار يمين / النداء يسار</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateConfig({ bottomOrder: 'call_center' })}
                    className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                      config.bottomOrder === 'call_center'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white'
                        : 'border-slate-700 bg-slate-850 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs">النداء بالوسط</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. تبويب شريط الأخبار والسرعة الهادئة (Ticker) */}
          {/* ========================================================================= */}
          {activeTab === 'ticker' && (
            <div className="space-y-6">
              {/* التحكم الهادئ في سرعة شريط الأخبار */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center text-sm font-bold">
                  <div>
                    <span className="text-white block">سرعة حركة النص بالشريط (كلما زادت الثواني كلما تحرك الشريط بهدوء وبطء تام)</span>
                    <span className="text-xs text-slate-400 font-normal">تم ربط السرعة مباشرة بالثواني لضمان الهدوء التام والقراءة المريحة للجميع</span>
                  </div>
                  <span className="text-emerald-400 font-mono text-base bg-emerald-950/80 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl shrink-0">
                    {config.tickerSpeedSeconds || 120} ثانية
                  </span>
                </div>

                <input
                  type="range"
                  min={20}
                  max={360}
                  step={5}
                  value={config.tickerSpeedSeconds || 120}
                  onChange={(e) => updateConfig({ tickerSpeedSeconds: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer h-2.5 bg-slate-700 rounded-lg"
                />

                {/* أزرار سريعة للسرعات الهادئة والبطيئة */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {[
                    { label: '🐢 سلحفاة (240s)', sec: 240, desc: 'فائق البطء والهدوء للشاشات الكبيرة' },
                    { label: '🌿 هادئ جداً (160s)', sec: 160, desc: 'حركة هادئة وراقية' },
                    { label: '☕ بطيء مريح (120s)', sec: 120, desc: 'السرعة القياسية الموصى بها' },
                    { label: '⚖️ متزن (75s)', sec: 75, desc: 'سرعة قنوات الأخبار' },
                    { label: '⚡ سريع (40s)', sec: 40, desc: 'دوران سريع' },
                  ].map((p) => (
                    <button
                      key={p.sec}
                      type="button"
                      onClick={() => updateConfig({ tickerSpeedSeconds: p.sec })}
                      className={`p-2.5 rounded-xl text-center transition-all cursor-pointer border ${
                        config.tickerSpeedSeconds === p.sec
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                          : 'bg-slate-700/80 border-slate-600 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <div className="font-bold text-xs">{p.label}</div>
                      <div className="text-[10px] text-slate-300 mt-1 opacity-80">{p.desc}</div>
                    </button>
                  ))}
                </div>

                {/* حجم خط شريط الأخبار وارتفاعه */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-700/60">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-300">حجم خط نصوص شريط الأخبار</span>
                      <span className="text-emerald-400 font-mono text-sm">{config.tickerFontSizePx || 15}px</span>
                    </div>
                    <input
                      type="range"
                      min={12}
                      max={26}
                      step={1}
                      value={config.tickerFontSizePx || 15}
                      onChange={(e) => updateConfig({ tickerFontSizePx: Number(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-300">ارتفاع شريط الأخبار</span>
                      <span className="text-emerald-400 font-mono text-sm">{config.tickerHeightPx || 46}px</span>
                    </div>
                    <input
                      type="range"
                      min={34}
                      max={76}
                      step={2}
                      value={config.tickerHeightPx || 46}
                      onChange={(e) => updateConfig({ tickerHeightPx: Number(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* اتجاه حركة النص وشكل الفاصل */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white">اتجاه حركة النص</h3>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => updateConfig({ tickerDirection: 'ltr' })}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        config.tickerDirection !== 'rtl'
                          ? 'border-emerald-500 bg-emerald-950/40 text-white font-bold'
                          : 'border-slate-700 bg-slate-850 text-slate-300'
                      }`}
                    >
                      <div className="text-xs">من اليسار لليمين ◀</div>
                      <div className="text-[10px] text-slate-400 mt-1">المعتمد بالقنوات</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateConfig({ tickerDirection: 'rtl' })}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        config.tickerDirection === 'rtl'
                          ? 'border-emerald-500 bg-emerald-950/40 text-white font-bold'
                          : 'border-slate-700 bg-slate-850 text-slate-300'
                      }`}
                    >
                      <div className="text-xs">من اليمين لليسار ▶</div>
                      <div className="text-[10px] text-slate-400 mt-1">حركة معاكسة</div>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white">شكل الفاصل بين الأخبار</h3>
                  <div className="grid grid-cols-6 gap-1.5 pt-1">
                    {[
                      { key: 'star', char: '✦', name: 'نجمة' },
                      { key: 'sparkle', char: '✨', name: 'لمعة' },
                      { key: 'medical', char: '⚕', name: 'طبي' },
                      { key: 'crescent', char: '🌙', name: 'هلال' },
                      { key: 'bar', char: '❙', name: 'خط' },
                      { key: 'dot', char: '●', name: 'نقطة' },
                    ].map((sep) => (
                      <button
                        key={sep.key}
                        type="button"
                        onClick={() => updateConfig({ tickerSeparator: sep.key as TickerSeparator })}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          config.tickerSeparator === sep.key
                            ? 'border-amber-500 bg-amber-950/40 text-amber-300 ring-2 ring-amber-500/30'
                            : 'border-slate-700 bg-slate-850 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="text-base font-black">{sep.char}</div>
                        <div className="text-[9px] mt-0.5 text-slate-400">{sep.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* نص شارة الأخبار ومصدر المحتوى */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">نص شارة شريط الأخبار الثابتة</label>
                    <input
                      type="text"
                      value={config.tickerBadgeText || 'أخبار المركز والتنبيهات'}
                      onChange={(e) => updateConfig({ tickerBadgeText: e.target.value })}
                      placeholder="أخبار المركز والتنبيهات"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">مصدر محتوى الشريط</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'both', label: 'كلاهما' },
                        { key: 'medical_news', label: 'أخبار طبية' },
                        { key: 'custom', label: 'نص مخصص' },
                      ].map((src) => (
                        <button
                          key={src.key}
                          type="button"
                          onClick={() => updateConfig({ tickerTextSource: src.key as any })}
                          className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            config.tickerTextSource === src.key
                              ? 'bg-emerald-600 text-white shadow-md'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {src.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* نص مخصص للمركز */}
                {(config.tickerTextSource === 'custom' || config.tickerTextSource === 'both') && (
                  <div className="space-y-2 pt-2 border-t border-slate-700/60">
                    <label className="text-xs font-bold text-slate-300 block">
                      النص المخصص الإرشادي للمركز (يدور ويكرر نفسه ورا بعضه باستمرار)
                    </label>
                    <textarea
                      rows={2}
                      value={config.tickerCustomText}
                      onChange={(e) => updateConfig({ tickerCustomText: e.target.value })}
                      placeholder="اكتب هنا التنبيه أو النص الذي ترغب في ظهوره على الشاشة للزوار..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>
                )}
              </div>

              {/* ألوان شريط الأخبار */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white">ألوان وتخصيص شريط الأخبار</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ColorPickerItem
                    label="خلفية شريط الأخبار"
                    value={config.tickerBgColor}
                    onChange={(val) => updateConfig({ tickerBgColor: val })}
                  />
                  <ColorPickerItem
                    label="لون نص الأخبار المتحرك"
                    value={config.tickerTextColor}
                    onChange={(val) => updateConfig({ tickerTextColor: val })}
                  />
                  <ColorPickerItem
                    label="خلفية شارة الأخبار الثابتة"
                    value={config.tickerBadgeBg}
                    onChange={(val) => updateConfig({ tickerBadgeBg: val })}
                  />
                  <ColorPickerItem
                    label="لون نص شارة الأخبار"
                    value={config.tickerBadgeTextColor}
                    onChange={(val) => updateConfig({ tickerBadgeTextColor: val })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. تبويب الصوت والتوقيتات (Audio & Intervals) */}
          {/* ========================================================================= */}
          {activeTab === 'audio_announcements' && (
            <div className="space-y-6">
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-200 flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  تحكم ذكي في فترات تشغيل الإعلان الصوتي للأطباء: لمنع إزعاج المرضى، يتم تشغيل النداء الصوتي لتواجد جميع الأطباء مرة واحدة فقط، ثم ينتظر النظام المدة التي تختارها قبل تكراره.
                </span>
              </div>

              {/* اختيار الفاصل الزمني لإعلان الأطباء */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center text-sm font-bold">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span className="text-white">الفترة بين الإعلانات الصوتية لتواجد الأطباء</span>
                  </div>
                  <span className="text-emerald-400 font-mono text-xs sm:text-sm bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-xl">
                    {config.doctorAudioIntervalMinutes === -1
                      ? 'صوت الأطباء مكتوم'
                      : config.doctorAudioIntervalMinutes === 0
                      ? 'مستمر مع كل دورة'
                      : `كل ${config.doctorAudioIntervalMinutes} دقائق`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                  {[
                    { minutes: 5, label: 'كل 5 دقائق (الموصى به)', desc: 'طبيب واحد كل 5 دقائق بالتتابع ثم التكرار' },
                    { minutes: 10, label: 'كل 10 دقائق', desc: 'توازن بين الإعلان والهدوء' },
                    { minutes: 15, label: 'كل 15 دقيقة', desc: 'هدوء أكبر للمرضى' },
                    { minutes: 20, label: 'كل 20 دقيقة', desc: 'فترات هدوء طويلة' },
                    { minutes: 30, label: 'كل 30 دقيقة', desc: 'إعلان نادر ومريح' },
                    { minutes: 45, label: 'كل 45 دقيقة', desc: 'فترات تباعد ممتدة' },
                    { minutes: 0, label: 'مع كل دورة (دائم)', desc: 'يعمل مع كل ظهور' },
                    { minutes: -1, label: 'كتم صوت الأطباء', desc: 'صامت تماماً (نداء المرضى يعمل)' },
                  ].map((opt) => {
                    const isSelected = config.doctorAudioIntervalMinutes === opt.minutes;
                    return (
                      <button
                        key={opt.minutes}
                        type="button"
                        onClick={() => updateConfig({ doctorAudioIntervalMinutes: opt.minutes })}
                        className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-950/50 text-white ring-2 ring-emerald-500/30'
                            : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs sm:text-sm text-white">{opt.label}</span>
                          {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* مدة بقاء إشعار النداء ومدة الشرائح */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>مدة بقاء إشعار استدعاء المريض (المنسدل)</span>
                    <span className="text-emerald-400 font-mono">{config.patientCallNoticeDurationSec || 8} ثواني</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={25}
                    step={1}
                    value={config.patientCallNoticeDurationSec || 8}
                    onChange={(e) => updateConfig({ patientCallNoticeDurationSec: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                  <p className="text-[11px] text-slate-400">المدة التي تظل فيها بطاقة الاستدعاء المباشرة ظاهرة بملء الشاشة</p>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>مدة عرض شريحة الميديا الافتراضية</span>
                    <span className="text-emerald-400 font-mono">{config.slideDefaultDurationSec || 10} ثواني</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={40}
                    step={1}
                    value={config.slideDefaultDurationSec || 10}
                    onChange={(e) => updateConfig({ slideDefaultDurationSec: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                  <p className="text-[11px] text-slate-400">مدة بقاء كل صورة أو إعلان طبيب قبل الانتقال للشريحة التالية</p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. تبويب الخطوط والنصوص (Typography) */}
          {/* ========================================================================= */}
          {activeTab === 'typography' && (
            <div className="space-y-6">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white">نوع الخط العربي لشاشة العرض والنداء</h3>
                <p className="text-xs text-slate-400">اختر الخط الأوضح والمناسب لحجم شاشة صالة الانتظار ومسافة الرؤية</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
                  {[
                    { key: 'cairo', name: 'Cairo (كايرو)', sample: 'مركز الطائر' },
                    { key: 'tajawal', name: 'Tajawal (تجوّل)', sample: 'مركز الطائر' },
                    { key: 'almarai', name: 'Almarai (المراعي)', sample: 'مركز الطائر' },
                    { key: 'readex', name: 'Readex Pro', sample: 'مركز الطائر' },
                    { key: 'ibm_plex', name: 'IBM Plex Sans', sample: 'مركز الطائر' },
                    { key: 'system', name: 'خط النظام القياسي', sample: 'مركز الطائر' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => updateConfig({ fontFamily: f.key as FontFamilyOption })}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                        config.fontFamily === f.key
                          ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/30'
                          : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs sm:text-sm">{f.name}</div>
                      <div className="text-[11px] text-emerald-400 mt-2 font-black">{f.sample}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* سمك الخطوط ونمط الأرقام وتأثير الوميض */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-bold text-white">كثافة وسمك الخطوط</h3>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: 'medium', label: 'متوسط' },
                      { key: 'bold', label: 'عريض' },
                      { key: 'black', label: 'أسود فائق' },
                    ].map((w) => (
                      <button
                        key={w.key}
                        type="button"
                        onClick={() => updateConfig({ fontWeight: w.key as any })}
                        className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          config.fontWeight === w.key
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-bold text-white">نمط وشكل الأرقام</h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateConfig({ numberFormat: 'western' })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        config.numberFormat !== 'arabic'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      لاتينية (123)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConfig({ numberFormat: 'arabic' })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        config.numberFormat === 'arabic'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      عربية (١٢٣)
                    </button>
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-bold text-white">تأثير وميض النداء المباشر</h3>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: 'none', label: 'بدون' },
                      { key: 'gentle', label: 'هادئ' },
                      { key: 'vibrant', label: 'نابض' },
                    ].map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => updateConfig({ callingPulseEffect: p.key as any })}
                        className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          config.callingPulseEffect === p.key
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 7. تبويب الألوان والثيمات (Colors & Themes) */}
          {/* ========================================================================= */}
          {activeTab === 'colors' && (
            <div className="space-y-6">
              {/* قوالب الألوان الجاهزة */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>11 قالب ألوان وتنسيقات ملكية جاهزة بلمسة زر واحدة:</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {(Object.keys(THEME_PRESETS) as ThemePresetKey[])
                    .filter((k) => k !== 'custom')
                    .map((presetKey) => {
                      const preset = THEME_PRESETS[presetKey];
                      const isSelected = config.themePreset === presetKey;

                      return (
                        <button
                          key={presetKey}
                          type="button"
                          onClick={() => applyThemePreset(presetKey)}
                          className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-950/40 ring-2 ring-emerald-500/30'
                              : 'border-slate-700 bg-slate-850 hover:bg-slate-800'
                          }`}
                        >
                          <div className="font-bold text-xs text-white">{preset.name}</div>
                          <div className="flex items-center gap-1.5 mt-3">
                            <span
                              className="w-4 h-4 rounded-full border border-white/20 shadow-xs"
                              style={{ backgroundColor: preset.colors.bgColor }}
                            />
                            <span
                              className="w-4 h-4 rounded-full border border-white/20 shadow-xs"
                              style={{ backgroundColor: preset.colors.panelBgColor }}
                            />
                            <span
                              className="w-4 h-4 rounded-full border border-white/20 shadow-xs"
                              style={{ backgroundColor: preset.colors.accentColor }}
                            />
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* تخصيص دقيق بالألوان اليدوية */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center justify-between">
                  <span>تخصيص الألوان يدوياً (Custom Color Picker)</span>
                  <span className="text-[11px] text-slate-400 font-normal">اضغط على المربع لاختيار أي لون تريده</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <ColorPickerItem
                    label="خلفية الشاشة"
                    value={config.bgColor}
                    onChange={(val) => updateConfig({ bgColor: val, themePreset: 'custom' })}
                  />
                  <ColorPickerItem
                    label="خلفية اللوحات والهيدر"
                    value={config.panelBgColor}
                    onChange={(val) => updateConfig({ panelBgColor: val, themePreset: 'custom' })}
                  />
                  <ColorPickerItem
                    label="خلفية الكروت"
                    value={config.cardBgColor}
                    onChange={(val) => updateConfig({ cardBgColor: val, themePreset: 'custom' })}
                  />
                  <ColorPickerItem
                    label="حدود الكروت"
                    value={config.cardBorderColor}
                    onChange={(val) => updateConfig({ cardBorderColor: val, themePreset: 'custom' })}
                  />
                  <ColorPickerItem
                    label="لون النص الأساسي"
                    value={config.textColor}
                    onChange={(val) => updateConfig({ textColor: val, themePreset: 'custom' })}
                  />
                  <ColorPickerItem
                    label="لون النص الثانوي"
                    value={config.mutedTextColor}
                    onChange={(val) => updateConfig({ mutedTextColor: val, themePreset: 'custom' })}
                  />
                  <ColorPickerItem
                    label="لون التمييز (Accent)"
                    value={config.accentColor}
                    onChange={(val) => updateConfig({ accentColor: val, themePreset: 'custom' })}
                  />
                  <ColorPickerItem
                    label="لون رقم النداء المباشر"
                    value={config.callingTokenColor}
                    onChange={(val) => updateConfig({ callingTokenColor: val, themePreset: 'custom' })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 8. تبويب عرض وإخفاء الأقسام (Visibility) */}
          {/* ========================================================================= */}
          {activeTab === 'visibility' && (
            <div className="space-y-4">
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-200 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  قم بتفعيل أو إخفاء أي قسم في شاشة النداء بحرية تامة. عند إخفاء قسم، تتمدد الأقسام الأخرى تلقائياً لملء المساحة.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <VisibilityToggleCard
                  title="الميديا (إعلانات الأطباء / وسائط المركز)"
                  desc="عرض صور وفيديوهات وإعلانات الأطباء المتواجدين"
                  enabled={config.showMedia}
                  onChange={(val) => updateConfig({ showMedia: val })}
                />
                <VisibilityToggleCard
                  title="العيادات والأطباء المتواجدون"
                  desc="شبكة كروت الأطباء المتواجدين بالمركز وأرقام الأدوار الحالية"
                  enabled={config.showClinics}
                  onChange={(val) => updateConfig({ showClinics: val })}
                />
                <VisibilityToggleCard
                  title="قائمة الانتظار القادمة"
                  desc="قائمة المرضى المنتظرين في الطابور القادم وأرقام تذاكرهم"
                  enabled={config.showWaitingList}
                  onChange={(val) => updateConfig({ showWaitingList: val })}
                />
                <VisibilityToggleCard
                  title="كارت النداء الحالي المباشر"
                  desc="الكارت البارز الذي ينادي على العميل الحالي بالرقم واسم العيادة"
                  enabled={config.showCurrentCall}
                  onChange={(val) => updateConfig({ showCurrentCall: val })}
                />
                <VisibilityToggleCard
                  title="شريط الأخبار المتحرك بالأسفل"
                  desc="شريط متحرك أسفل الشاشة يعرض آخر الأخبار وتنبيهات المركز"
                  enabled={config.showNewsTicker}
                  onChange={(val) => updateConfig({ showNewsTicker: val })}
                  badge="شريط متصل"
                />
                <VisibilityToggleCard
                  title="شريط الترويسة العلوي (الهيدر)"
                  desc="اسم المركز الطبي وشعاره والساعة الحية وتاريخ اليوم"
                  enabled={config.showHeader}
                  onChange={(val) => updateConfig({ showHeader: val })}
                />
                <VisibilityToggleCard
                  title="تاريخ اليوم في الهيدر"
                  desc="عرض التاريخ الهجري / الميلادي في الشريط العلوي"
                  enabled={config.showDate !== false}
                  onChange={(val) => updateConfig({ showDate: val })}
                />
                <VisibilityToggleCard
                  title="الساعة الحية في الهيدر"
                  desc="عرض الساعة المباشرة في الشريط العلوي"
                  enabled={config.showClock !== false}
                  onChange={(val) => updateConfig({ showClock: val })}
                />
                <VisibilityToggleCard
                  title="شريط تقدم شريحة الميديا"
                  desc="عرض مؤشر خط التقدم الزمني أسفل كل شريحة"
                  enabled={config.showSlideProgressBar !== false}
                  onChange={(val) => updateConfig({ showSlideProgressBar: val })}
                />
              </div>
            </div>
          )}
        </div>

        {/* الشريط السفلي للإجراءات والحفظ في قاعدة البيانات */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResetToDefaults}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>استعادة الإعدادات الأصلية</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>تم الحفظ كإعداد افتراضي في قاعدة البيانات بنجاح!</span>
              </span>
            )}

            <button
              type="button"
              onClick={onSaveToDB}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ في قاعدة البيانات...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ كإعدادات افتراضية في قاعدة البيانات</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
        active
          ? 'bg-emerald-600 text-white shadow-md'
          : 'text-slate-300 hover:bg-slate-850 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge && (
        <span
          className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
            active ? 'bg-white text-emerald-900' : 'bg-amber-500/20 text-amber-300'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function VisibilityToggleCard({
  title,
  desc,
  enabled,
  onChange,
  badge,
}: {
  title: string;
  desc: string;
  enabled: boolean;
  onChange: (val: boolean) => void;
  badge?: string;
}) {
  return (
    <div
      onClick={() => onChange(!enabled)}
      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
        enabled
          ? 'bg-slate-850 border-emerald-500/50 hover:border-emerald-500'
          : 'bg-slate-900/60 border-slate-800 opacity-60 hover:opacity-80'
      }`}
    >
      <div className="flex-1 pr-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-white">{title}</span>
          {badge && (
            <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.2 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1">{desc}</p>
      </div>

      <div className="shrink-0 mr-3">
        {enabled ? (
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <Eye className="w-5 h-5" />
          </div>
        ) : (
          <div className="p-2 bg-slate-800 text-slate-500 rounded-xl border border-slate-700">
            <EyeOff className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}

function ColorPickerItem({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-700/80 rounded-xl">
      <span className="text-xs font-bold text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-slate-400">{value}</span>
        <input
          type="color"
          value={value.startsWith('#') ? value : '#059669'}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border border-slate-600 bg-transparent cursor-pointer p-0"
        />
      </div>
    </div>
  );
}
