'use client';
import { useState } from 'react';
import { Calculator, Info, AlertTriangle } from 'lucide-react';

export function DermatologyCalc() {
  // ==== 1) قاعدة التسعات (Rule of Nines) لتقدير المساحة الجلدية المصابة ====
  const REGIONS = [
    { id: 'head', label: 'الرأس والرقبة', pct: 9 },
    { id: 'armR', label: 'الذراع اليمنى', pct: 9 },
    { id: 'armL', label: 'الذراع اليسرى', pct: 9 },
    { id: 'trunkF', label: 'الجذع الأمامي', pct: 18 },
    { id: 'trunkB', label: 'الجذع الخلفي', pct: 18 },
    { id: 'legR', label: 'الساق اليمنى', pct: 18 },
    { id: 'legL', label: 'الساق اليسرى', pct: 18 },
    { id: 'groin', label: 'منطقة العجان', pct: 1 },
  ];
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const totalPct = REGIONS.filter(r => selectedRegions.includes(r.id)).reduce((s, r) => s + r.pct, 0);
  const toggleRegion = (id: string) => setSelectedRegions(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ==== 2) تصنيف فيتزباتريك لنوع البشرة ====
  const [skinColor, setSkinColor] = useState(0);
  const [tanning, setTanning] = useState(0);
  const fitzScore = skinColor + tanning;
  const fitzType = Math.min(6, Math.max(1, Math.round(fitzScore / 2) + 1));
  const fitzDescriptions: Record<number, string> = {
    1: 'النوع I — بشرة بيضاء جدًا، تحترق دائمًا ولا تسمّر أبدًا',
    2: 'النوع II — بشرة فاتحة، تحترق بسهولة وتسمّر بصعوبة',
    3: 'النوع III — بشرة متوسطة، قد تحترق قليلًا وتسمّر تدريجيًا',
    4: 'النوع IV — بشرة زيتونية، نادرًا ما تحترق وتسمّر بسهولة',
    5: 'النوع V — بشرة سمراء، تحترق نادرًا جدًا',
    6: 'النوع VI — بشرة داكنة، لا تحترق أبدًا',
  };

  // ==== 3) قائمة ABCDE للفحص الأولي لسرطان الجلد (الميلانوما) ====
  const [asymmetry, setAsymmetry] = useState(false);
  const [border, setBorder] = useState(false);
  const [color, setColor] = useState(false);
  const [diameter, setDiameter] = useState(false);
  const [evolving, setEvolving] = useState(false);
  const abcdeCount = [asymmetry, border, color, diameter, evolving].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> قاعدة التسعات (Rule of Nines)
        </h3>
        <p className="text-xs text-gray-400 mb-4">تقدير النسبة المئوية لمساحة الجلد المصابة (حروق أو أمراض جلدية منتشرة) — تعتمد على البالغين.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {REGIONS.map(r => (
            <label key={r.id} className={`flex items-center gap-2 text-sm border rounded-lg p-2 cursor-pointer ${selectedRegions.includes(r.id) ? 'bg-emerald-50 border-emerald-300' : 'bg-white'}`}>
              <input type="checkbox" checked={selectedRegions.includes(r.id)} onChange={() => toggleRegion(r.id)} />
              {r.label} ({r.pct}%)
            </label>
          ))}
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-800 font-bold">
          إجمالي المساحة المصابة: {totalPct}% من مساحة سطح الجسم
        </div>
      </div>

      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> تصنيف فيتزباتريك لنوع البشرة
        </h3>
        <p className="text-xs text-gray-400 mb-4">يُستخدم لتقييم حساسية البشرة للشمس وتحديد الإجراءات التجميلية/الليزر المناسبة.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">لون البشرة الطبيعي</label>
            <select value={skinColor} onChange={(e) => setSkinColor(Number(e.target.value))} className="w-full border rounded-lg p-2">
              <option value={0}>فاتح جدًا (أبيض)</option>
              <option value={1}>فاتح</option>
              <option value={2}>متوسط (زيتوني)</option>
              <option value={3}>داكن (بني)</option>
              <option value={4}>داكن جدًا (أسمر غامق)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">استجابة البشرة للشمس</label>
            <select value={tanning} onChange={(e) => setTanning(Number(e.target.value))} className="w-full border rounded-lg p-2">
              <option value={0}>تحترق دائمًا ولا تسمّر</option>
              <option value={1}>تحترق بسهولة، تسمّر بصعوبة</option>
              <option value={2}>تحترق أحيانًا، تسمّر تدريجيًا</option>
              <option value={3}>نادرًا ما تحترق، تسمّر جيدًا</option>
              <option value={4}>لا تحترق أبدًا تقريبًا</option>
            </select>
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-800 font-bold">
          {fitzDescriptions[fitzType]}
        </div>
      </div>

      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> قائمة ABCDE للفحص الأولي لشامة مشبوهة
        </h3>
        <p className="text-xs text-gray-400 mb-4">أداة فحص سريع لملاحظات تستدعي مزيدًا من التقييم (خزعة/إحالة) — ليست تشخيصًا.</p>
        <div className="space-y-2 mb-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={asymmetry} onChange={(e) => setAsymmetry(e.target.checked)} /> A — عدم تماثل الشكل (Asymmetry)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={border} onChange={(e) => setBorder(e.target.checked)} /> B — حواف غير منتظمة (Border)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={color} onChange={(e) => setColor(e.target.checked)} /> C — تعدد الألوان داخل الآفة (Color)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={diameter} onChange={(e) => setDiameter(e.target.checked)} /> D — قطر أكبر من 6 مم (Diameter)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={evolving} onChange={(e) => setEvolving(e.target.checked)} /> E — تغيّر في الحجم/الشكل/اللون مؤخرًا (Evolving)</label>
        </div>
        <div className={`rounded-lg p-3 font-bold flex items-center gap-2 ${abcdeCount >= 2 ? 'bg-red-50 border border-red-100 text-red-700' : 'bg-gray-50 border border-gray-100 text-gray-600'}`}>
          {abcdeCount >= 2 && <AlertTriangle className="w-4 h-4" />}
          {abcdeCount} من 5 علامات — {abcdeCount >= 2 ? 'يُنصح بالإحالة لتقييم متخصص/خزعة' : 'لا توجد علامات كافية مثيرة للقلق حاليًا'}
        </div>
      </div>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        أدوات مرجعية للمساعدة السريرية، والتشخيص النهائي يعتمد على الفحص الإكلينيكي والخزعة عند الحاجة.
      </div>
    </div>
  );
}
