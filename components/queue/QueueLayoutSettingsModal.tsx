'use client';

// ============================================================================
// components/queue/QueueLayoutSettingsModal.tsx
// لوحة التحكم الشاملة لشاشة النداء الآلي:
// - عرض وإخفاء كافة الأقسام (الميديا، العيادات، قائمة الانتظار، شريط الأخبار)
// - تحديد أبعاد ومقاسات كل قسم ونسب العرض والارتفاع
// - التحكم بمكان وترتيب الأقسام في الشاشة (يمين / يسار / أعلى / أسفل)
// - التحكم الكامل بالألوان والقوالب والخطوط
// - تخصيص شريط الأخبار بالأسفل والنصوص الإرشادية
// - حفظ الإعدادات كإعدادات افتراضية دائمة في قاعدة البيانات (Supabase)
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
  Monitor,
  Check,
  AlertCircle,
  Loader2,
  Volume2,
  VolumeX,
  Stethoscope,
  Clock,
  Image as ImageIcon,
} from 'lucide-react';
import {
  QueueLayoutConfig,
  THEME_PRESETS,
  DEFAULT_QUEUE_LAYOUT_CONFIG,
  ThemePresetKey,
  FontFamilyOption,
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

type TabKey = 'visibility' | 'dimensions' | 'layout' | 'audio_announcements' | 'colors' | 'typography' | 'ticker';

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
  const [activeTab, setActiveTab] = useState<TabKey>('visibility');

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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white animate-in zoom-in-95 duration-200">
        {/* الترويسة العلوية للمودال */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wide text-white">
                تخصيص شاشة النداء والتحكم الكامل
              </h2>
              <p className="text-xs text-slate-400">
                تحكم فوري في عرض الأقسام، المقاسات، الأماكن، الألوان، الخطوط وشريط الأخبار
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

        {/* شريط التبويبات الرئيسي */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 overflow-x-auto scrollbar-none shrink-0">
          <TabButton
            active={activeTab === 'visibility'}
            onClick={() => setActiveTab('visibility')}
            icon={<Eye className="w-4 h-4" />}
            label="الأقسام والعرض"
          />
          <TabButton
            active={activeTab === 'dimensions'}
            onClick={() => setActiveTab('dimensions')}
            icon={<Sliders className="w-4 h-4" />}
            label="المقاسات والأبعاد"
          />
          <TabButton
            active={activeTab === 'layout'}
            onClick={() => setActiveTab('layout')}
            icon={<Move className="w-4 h-4" />}
            label="المكان والترتيب"
          />
          <TabButton
            active={activeTab === 'audio_announcements'}
            onClick={() => setActiveTab('audio_announcements')}
            icon={<Volume2 className="w-4 h-4 text-emerald-400" />}
            label="صوت الأطباء وتكراره (جديد)"
          />
          <TabButton
            active={activeTab === 'colors'}
            onClick={() => setActiveTab('colors')}
            icon={<Palette className="w-4 h-4" />}
            label="الألوان والثيمات"
          />
          <TabButton
            active={activeTab === 'typography'}
            onClick={() => setActiveTab('typography')}
            icon={<Type className="w-4 h-4" />}
            label="الخطوط والنصوص"
          />
          <TabButton
            active={activeTab === 'ticker'}
            onClick={() => setActiveTab('ticker')}
            icon={<Newspaper className="w-4 h-4 text-amber-400" />}
            label="شريط الأخبار (جديد)"
          />
        </div>

        {/* جسم الإعدادات حسب التبويب */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. تبويب عرض وإخفاء الأقسام */}
          {activeTab === 'visibility' && (
            <div className="space-y-4">
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-200 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  قم بتفعيل أو إخفاء أي قسم في شاشة النداء بحرية تامة. عند إخفاء قسم، تتمدد الأقسام الأخرى تلقائياً لملء المساحة.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <VisibilityToggleCard
                  title="الميديا (إعلانات الأطباء / وسائط المركز)"
                  desc="عرض صور ومقاطع الفيديو وإعلانات الأطباء المتواجدين"
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
                  desc="الكارت البارز الكبير الذي ينادي على العميل الحالي بالرقم واسم العيادة"
                  enabled={config.showCurrentCall}
                  onChange={(val) => updateConfig({ showCurrentCall: val })}
                />

                <VisibilityToggleCard
                  title="شريط الأخبار المتحرك بالأسفل (جديد)"
                  desc="شريط متحرك أسفل الشاشة يعرض آخر الأخبار الطبية وتنبيهات المركز"
                  enabled={config.showNewsTicker}
                  onChange={(val) => updateConfig({ showNewsTicker: val })}
                  badge="جديد"
                />

                <VisibilityToggleCard
                  title="شريط الترويسة العلوي (الهيدر)"
                  desc="اسم المركز الطبي وشعاره والساعة الحية ومؤشرات الصوت"
                  enabled={config.showHeader}
                  onChange={(val) => updateConfig({ showHeader: val })}
                />
              </div>
            </div>
          )}

          {/* 2. تبويب المقاسات والأبعاد */}
          {activeTab === 'dimensions' && (
            <div className="space-y-6">
              {/* عرض قسم الميديا والأطباء */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-white">نسبة عرض قسم الميديا</span>
                  <span className="text-emerald-400 font-mono text-base bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-xl">
                    الميديا {config.mediaWidthPct}% / الجانب الآخر {100 - config.mediaWidthPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={25}
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
                    { pct: 70, label: '70% (موصى به)' },
                    { pct: 80, label: '80% (ميديا عملاقة)' },
                  ].map((p) => (
                    <button
                      key={p.pct}
                      type="button"
                      onClick={() => updateConfig({ mediaWidthPct: p.pct })}
                      className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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

              {/* ارتفاع القسم السفلي (النداء والانتظار) */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-white">ارتفاع قسم النداء وقائمة الانتظار بالأسفل</span>
                  <span className="text-emerald-400 font-mono text-base bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-xl">
                    {config.bottomHeightPct}% من ارتفاع الشاشة
                  </span>
                </div>
                <input
                  type="range"
                  min={18}
                  max={48}
                  step={2}
                  value={config.bottomHeightPct}
                  onChange={(e) => updateConfig({ bottomHeightPct: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>18% (شريط سفلي رفيع)</span>
                  <span>32% (ارتفاع متوازن قياسي)</span>
                  <span>48% (قسم كبير للنداء)</span>
                </div>
              </div>

              {/* حجم خط رقم النداء المباشر */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-white">حجم خط رقم النداء المباشر</span>
                  <span className="text-amber-400 font-mono text-base bg-amber-950/80 border border-amber-500/40 px-3 py-1 rounded-xl">
                    {config.tokenFontSize}px
                  </span>
                </div>
                <input
                  type="range"
                  min={48}
                  max={110}
                  step={4}
                  value={config.tokenFontSize}
                  onChange={(e) => updateConfig({ tokenFontSize: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                />
                <div className="text-center font-black font-mono tracking-widest text-amber-300 py-2 border border-slate-700 rounded-xl bg-slate-950" style={{ fontSize: `${config.tokenFontSize * 0.55}px` }}>
                  #104
                </div>
              </div>

              {/* ارتفاع شريط الأخبار وزووم الشاشة */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span>ارتفاع شريط الأخبار</span>
                    <span className="text-emerald-400 font-mono">{config.tickerHeightPx}px</span>
                  </div>
                  <input
                    type="range"
                    min={36}
                    max={68}
                    step={2}
                    value={config.tickerHeightPx}
                    onChange={(e) => updateConfig({ tickerHeightPx: Number(e.target.value) })}
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
                    min={0.8}
                    max={1.3}
                    step={0.05}
                    value={config.zoom}
                    onChange={(e) => updateConfig({ zoom: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                </div>
              </div>

              {/* أعمدة العرض وكثافة الكروت */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">أعمدة قائمة الانتظار</label>
                  <div className="grid grid-cols-3 gap-2">
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
                  <label className="text-xs font-bold text-slate-300 block">كثافة وتباعد الكروت</label>
                  <div className="grid grid-cols-3 gap-2">
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
              </div>

              {/* تكبير صورة الطبيب في إعلان التواجد */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center text-sm font-bold">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-emerald-400" />
                    <span className="text-white">حجم وتكبير صورة الطبيب في الإعلان</span>
                  </div>
                  <span className="text-emerald-400 font-mono text-base bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-xl">
                    {config.doctorPhotoSizePx || 280}px
                  </span>
                </div>
                <input
                  type="range"
                  min={180}
                  max={460}
                  step={10}
                  value={config.doctorPhotoSizePx || 280}
                  onChange={(e) => updateConfig({ doctorPhotoSizePx: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { label: 'عادي (220px)', size: 220 },
                    { label: 'كبير (280px)', size: 280 },
                    { label: 'كبير جداً (360px)', size: 360 },
                    { label: 'عملاق (440px)', size: 440 },
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

              {/* ارتفاع الهيدر وحجم خط بطاقات الأطباء */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span>ارتفاع شريط الترويسة العلوي (الهيدر)</span>
                    <span className="text-emerald-400 font-mono">{config.headerHeightPx || 66}px</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={90}
                    step={2}
                    value={config.headerHeightPx || 66}
                    onChange={(e) => updateConfig({ headerHeightPx: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span>حجم خط بطاقات الأطباء والعيادات</span>
                    <span className="text-emerald-400 font-mono">{config.clinicsFontSizePx || 14}px</span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={20}
                    step={1}
                    value={config.clinicsFontSizePx || 14}
                    onChange={(e) => updateConfig({ clinicsFontSizePx: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. تبويب المكان والترتيب */}
          {activeTab === 'layout' && (
            <div className="space-y-6">
              {/* زر سريع لتطبيق التخطيط المفضل للمستخدم */}
              <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-500/40 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                <div className="space-y-1 text-center sm:text-right">
                  <div className="inline-flex items-center gap-1.5 text-xs font-black text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-0.5 rounded-full mb-1">
                    <span>🌟 التخطيط السينمائي المفضل</span>
                  </div>
                  <h4 className="text-sm font-black text-white">الميديا على اليسار (70%) + العيادات والنداء فوق بعض على اليمين</h4>
                  <p className="text-xs text-slate-300">
                    تخطيط احترافي يعطي الميديا المساحة الأكبر للظهور مع ترتيب العيادات والنداء والانتظار رأسياً بجانبها.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateConfig({
                      screenLayoutMode: 'split_columns',
                      mediaPosition: 'left',
                      mediaWidthPct: 70,
                      showMedia: true,
                      showClinics: true,
                      showCurrentCall: true,
                      showWaitingList: true,
                    })
                  }
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                >
                  تطبيق هذا التخطيط الآن ✓
                </button>
              </div>

              {/* اختيار نمط هيكل الشاشة */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">نمط تقسيم وهيكل الشاشة</h3>
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
                      <div className="font-bold text-sm">أعمدة جانبية كاملة (ميديا بجانب العيادات)</div>
                      <div className="text-xs text-slate-400 mt-1">
                        الميديا بارتفاع الشاشة الكامل، والعيادات والنداء وقائمة الانتظار فوق بعض
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

              {/* موضع الميديا (يمين أو يسار) */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">موضع قسم الميديا في الشاشة الرئيسية</h3>
                <p className="text-xs text-slate-400">حدد هل تظهر شريحة الميديا والإعلانات على اليمين أم على اليسار</p>
                <div className="grid grid-cols-2 gap-3 pt-1">
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
                      <div className="text-xs text-slate-400 mt-1">والعيادات والأطباء على اليسار</div>
                    </div>
                    {config.mediaPosition === 'right' && <Check className="w-5 h-5 text-emerald-400" />}
                  </button>

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
                      <div className="font-bold text-sm">الميديا على اليسار ▶</div>
                      <div className="text-xs text-slate-400 mt-1">والعيادات والأطباء على اليمين</div>
                    </div>
                    {config.mediaPosition === 'left' && <Check className="w-5 h-5 text-emerald-400" />}
                  </button>
                </div>
              </div>

              {/* ترتيب القسم السفلي (كارت النداء وقائمة الانتظار) */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">ترتيب كارت النداء وقائمة الانتظار بالأسفل</h3>
                <p className="text-xs text-slate-400">حدد طريقة توزيع بطاقة النداء المباشر وقائمة الانتظار</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => updateConfig({ bottomOrder: 'call_right_queue_left' })}
                    className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
                      config.bottomOrder === 'call_right_queue_left'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/30'
                        : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs sm:text-sm">النداء يمين / الانتظار يسار</div>
                    <div className="text-[11px] text-slate-400 mt-1">التوزيع القياسي العربي المعتمد</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateConfig({ bottomOrder: 'call_left_queue_right' })}
                    className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
                      config.bottomOrder === 'call_left_queue_right'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/30'
                        : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs sm:text-sm">الانتظار يمين / النداء يسار</div>
                    <div className="text-[11px] text-slate-400 mt-1">التركيز على الطابور باليمين</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateConfig({ bottomOrder: 'call_center' })}
                    className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
                      config.bottomOrder === 'call_center'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/30'
                        : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs sm:text-sm">النداء بالمنتصف كامل</div>
                    <div className="text-[11px] text-slate-400 mt-1">كارت نداء عريض مع قائمة جانبية</div>
                  </button>
                </div>
              </div>

              {/* الترتيب العمودي الرئيسي */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">الترتيب العمودي للشاشة</h3>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => updateConfig({ verticalOrder: 'media_top_queue_bottom' })}
                    className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
                      config.verticalOrder === 'media_top_queue_bottom'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/30'
                        : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-sm">الميديا والعيادات بالأعلى ⬆</div>
                    <div className="text-xs text-slate-400 mt-1">والنداء وقائمة الانتظار بالأسفل ⬇</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateConfig({ verticalOrder: 'queue_top_media_bottom' })}
                    className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
                      config.verticalOrder === 'queue_top_media_bottom'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/30'
                        : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-sm">النداء وقائمة الانتظار بالأعلى ⬆</div>
                    <div className="text-xs text-slate-400 mt-1">والميديا والعيادات بالأسفل ⬇</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* تبويب الصوت وإعلانات الأطباء (جديد لمنع الإزعاج) */}
          {activeTab === 'audio_announcements' && (
            <div className="space-y-6">
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-200 flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  تحكم ذكي في فترات تشغيل الإعلان الصوتي للأطباء: لمنع إزعاج المرضى والعملاء في صالة الانتظار، يتم تشغيل النداء الصوتي لتواجد جميع الأطباء مرة واحدة فقط، ثم ينتظر النظام المدة التي تختارها قبل تكراره.
                </span>
              </div>

              {/* اختيار الفاصل الزمني بالدقائق */}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                  {[
                    { minutes: 5, label: 'كل 5 دقائق', desc: 'تكرار صوتي خفيف' },
                    { minutes: 10, label: 'كل 10 دقائق (موصى به)', desc: 'توازن مثالي بين الإعلان والهدوء' },
                    { minutes: 15, label: 'كل 15 دقيقة', desc: 'هدوء أكبر للمرضى' },
                    { minutes: 20, label: 'كل 20 دقيقة', desc: 'فترات هدوء طويلة' },
                    { minutes: 30, label: 'كل 30 دقيقة', desc: 'إعلان مريح ونادر جداً' },
                    { minutes: 0, label: 'مع كل دورة (دائم)', desc: 'يعمل مع كل ظهور للطبيب' },
                    { minutes: -1, label: 'كتم صوت الأطباء', desc: 'صامت تماماً (نداء المرضى فقط يعمل)' },
                  ].map((opt) => {
                    const isSelected = config.doctorAudioIntervalMinutes === opt.minutes;
                    return (
                      <button
                        key={opt.minutes}
                        type="button"
                        onClick={() => updateConfig({ doctorAudioIntervalMinutes: opt.minutes })}
                        className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
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

              {/* ملاحظة تأكيدية حول نداء المرضى */}
              <div className="bg-slate-850 border border-slate-700/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-300">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-white block">ملاحظة أولوية نداء المرضى:</span>
                  <p className="text-slate-400 leading-relaxed">
                    الإعداد أعلاه خاص فقط بالمقاطع الصوتية لإعلانات الأطباء. أما نداء استدعاء المريض للعيادة (الدور ورقم الكشف) فإنه يمتلك **أولوية مطلقة دائماً** ويقوم بإيقاف أي إعلان فوراً مع تشغيل نغمة النداء وشاشة المريض الكبيرة.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 4. تبويب الألوان والثيمات */}
          {activeTab === 'colors' && (
            <div className="space-y-6">
              {/* قوالب الألوان الجاهزة بضغطة واحدة */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>قوالب ألوان جاهزة بلمسة زر واحدة</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                          <div className="font-bold text-xs sm:text-sm text-white">{preset.name}</div>
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
                  <span>تخصيص الألوان يدوياً (Custom Hex)</span>
                  <span className="text-[11px] text-slate-400 font-normal">اضغط على المربع لاختيار أي لون تريده</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ColorPickerItem
                    label="خلفية الشاشة الرئيسية"
                    value={config.bgColor}
                    onChange={(val) => updateConfig({ bgColor: val, themePreset: 'custom' })}
                  />

                  <ColorPickerItem
                    label="خلفية اللوحات والهيدر"
                    value={config.panelBgColor}
                    onChange={(val) => updateConfig({ panelBgColor: val, themePreset: 'custom' })}
                  />

                  <ColorPickerItem
                    label="خلفية كروت الأطباء والانتظار"
                    value={config.cardBgColor}
                    onChange={(val) => updateConfig({ cardBgColor: val, themePreset: 'custom' })}
                  />

                  <ColorPickerItem
                    label="لون إطار وحدود الكروت"
                    value={config.cardBorderColor}
                    onChange={(val) => updateConfig({ cardBorderColor: val, themePreset: 'custom' })}
                  />

                  <ColorPickerItem
                    label="لون النص الأساسي"
                    value={config.textColor}
                    onChange={(val) => updateConfig({ textColor: val, themePreset: 'custom' })}
                  />

                  <ColorPickerItem
                    label="لون النصوص الثانوية"
                    value={config.mutedTextColor}
                    onChange={(val) => updateConfig({ mutedTextColor: val, themePreset: 'custom' })}
                  />

                  <ColorPickerItem
                    label="لون التمييز واللمسات الحية"
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

          {/* 5. تبويب الخطوط والنصوص */}
          {activeTab === 'typography' && (
            <div className="space-y-6">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white">نوع الخط العربي لشاشة العرض</h3>
                <p className="text-xs text-slate-400">اختر الخط الأوضح والمناسب لحجم شاشة صالة الانتظار</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  {[
                    { key: 'cairo', name: 'Cairo (كايرو)', sample: 'مركز الطائر الحر' },
                    { key: 'tajawal', name: 'Tajawal (تجوّل)', sample: 'مركز الطائر الحر' },
                    { key: 'almarai', name: 'Almarai (المراعي)', sample: 'مركز الطائر الحر' },
                    { key: 'system', name: 'خط النظام القياسي', sample: 'مركز الطائر الحر' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => updateConfig({ fontFamily: f.key as FontFamilyOption })}
                      className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
                        config.fontFamily === f.key
                          ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/30'
                          : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="font-bold text-sm">{f.name}</div>
                      <div className="text-xs text-emerald-400 mt-2 font-black">{f.sample}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">كثافة وسمك الخطوط</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updateConfig({ fontWeight: 'bold' })}
                    className={`p-3.5 rounded-xl border text-center font-bold text-xs sm:text-sm cursor-pointer ${
                      config.fontWeight === 'bold'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white'
                        : 'border-slate-700 bg-slate-850 text-slate-300'
                    }`}
                  >
                    عريض متوازن (Bold)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateConfig({ fontWeight: 'black' })}
                    className={`p-3.5 rounded-xl border text-center font-black text-xs sm:text-sm cursor-pointer ${
                      config.fontWeight === 'black'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white'
                        : 'border-slate-700 bg-slate-850 text-slate-300'
                    }`}
                  >
                    فائق العرض والوضوح (Black)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 6. تبويب شريط الأخبار بالأسفل (جديد) */}
          {activeTab === 'ticker' && (
            <div className="space-y-6">
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 flex items-center gap-3">
                <Newspaper className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  ميزة شريط الأخبار الجديد: يعرض نصاً متحركاً متواصلاً أسفل الشاشة لجذب انتباه المرضى بنصائح المركز وآخر الأخبار الطبية الحية.
                </span>
              </div>

              {/* تفعيل أو إيقاف شريط الأخبار */}
              <div className="flex items-center justify-between p-4 bg-slate-800/80 border border-slate-700 rounded-2xl">
                <div>
                  <h4 className="font-bold text-sm text-white">تفعيل شريط الأخبار بالأسفل</h4>
                  <p className="text-xs text-slate-400 mt-0.5">إظهار أو إخفاء الشريط من الشاشة كلياً</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig({ showNewsTicker: !config.showNewsTicker })}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                    config.showNewsTicker ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {config.showNewsTicker ? 'مفعّل الآن ✓' : 'معطل'}
                </button>
              </div>

              {/* مصدر نصوص شريط الأخبار */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">مصدر محتوى الشريط</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { key: 'both', label: 'كلاهما (أخبار طبية + نص مخصص)', desc: 'الخيار الشامل الموصى به' },
                    { key: 'medical_news', label: 'الأخبار الطبية الحية فقط', desc: 'تحديث تلقائي من قاعدة البيانات' },
                    { key: 'custom', label: 'نص إعلاني مخصص فقط', desc: 'رسالة إرشادية أو تنبيه للمركز' },
                  ].map((src) => (
                    <button
                      key={src.key}
                      type="button"
                      onClick={() => updateConfig({ tickerTextSource: src.key as any })}
                      className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
                        config.tickerTextSource === src.key
                          ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/20'
                          : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs text-white">{src.label}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{src.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* النص المخصص للمركز */}
              {(config.tickerTextSource === 'custom' || config.tickerTextSource === 'both') && (
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                  <label className="text-sm font-bold text-white block">النص المخصص الإرشادي للمركز</label>
                  <textarea
                    rows={3}
                    value={config.tickerCustomText}
                    onChange={(e) => updateConfig({ tickerCustomText: e.target.value })}
                    placeholder="اكتب هنا التنبيه أو النص الذي ترغب في ظهوره على الشاشة للزوار..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                  <p className="text-[11px] text-slate-400">
                    يمكنك كتابة نصائح وقائية، مواعيد الدوام، ترحيب بالزوار أو عروض العيادات الحالية.
                  </p>
                </div>
              )}

              {/* اتجاه حركة شريط الأخبار وتكرار النص */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">اتجاه حركة النص وتكراره المتصل</h3>
                  <span className="text-[11px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    تكرار متصل ورا بعضه ✓
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  يدور النص ويكرر نفسه ورا بعضه باستمرار ودون توقف أو فراغات. يمكنك اختيار اتجاه الحركة المناسب.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => updateConfig({ tickerDirection: 'ltr' })}
                    className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                      config.tickerDirection !== 'rtl'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/20'
                        : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-white">من اليسار إلى اليمين (شائع بالقنوات) ◀</div>
                      <div className="text-[11px] text-slate-400 mt-1">تتحرك الكلمات جهة اليمين بهدوء وسلاسة</div>
                    </div>
                    {config.tickerDirection !== 'rtl' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateConfig({ tickerDirection: 'rtl' })}
                    className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                      config.tickerDirection === 'rtl'
                        ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/20'
                        : 'border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-white">من اليمين إلى اليسار ▶</div>
                      <div className="text-[11px] text-slate-400 mt-1">تتحرك الكلمات جهة اليسار</div>
                    </div>
                    {config.tickerDirection === 'rtl' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* سرعة حركة الشريط وحجم الخط */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-white">سرعة حركة النص بالشريط (كلما زادت الثواني كلما تحرك الشريط ببطء وهدوء)</span>
                  <span className="text-emerald-400 font-mono text-base bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-xl">
                    {config.tickerSpeedSeconds} ثانية
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={200}
                  step={5}
                  value={config.tickerSpeedSeconds}
                  onChange={(e) => updateConfig({ tickerSpeedSeconds: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { label: 'بطيء وهادئ جداً (140s)', sec: 140 },
                    { label: 'بطيء ومريح (90s)', sec: 90 },
                    { label: 'متزن قياسي (65s)', sec: 65 },
                    { label: 'سريع (35s)', sec: 35 },
                  ].map((p) => (
                    <button
                      key={p.sec}
                      type="button"
                      onClick={() => updateConfig({ tickerSpeedSeconds: p.sec })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        config.tickerSpeedSeconds === p.sec
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-700/70 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-300">حجم خط نصوص شريط الأخبار</span>
                    <span className="text-emerald-400 font-mono text-sm">{config.tickerFontSizePx || 15}px</span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={22}
                    step={1}
                    value={config.tickerFontSizePx || 15}
                    onChange={(e) => updateConfig({ tickerFontSizePx: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                </div>
              </div>

              {/* ألوان شريط الأخبار */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white">ألوان شريط الأخبار</h3>
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
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
        active
          ? 'bg-emerald-600 text-white shadow-md'
          : 'text-slate-300 hover:bg-slate-850 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
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
