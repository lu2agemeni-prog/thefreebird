'use client';
import { useState } from 'react';
import { Calculator, Info, AlertTriangle } from 'lucide-react';

export function DentistryCalc() {
  // ==== 1) الجرعة القصوى للتخدير الموضعي (ليدوكايين) ====
  const [weight, setWeight] = useState('');
  const [withEpi, setWithEpi] = useState(true);
  const maxDoseMgPerKg = withEpi ? 7 : 4.5;
  const absoluteMaxMg = withEpi ? 500 : 300;
  const doseResult = (() => {
    const w = parseFloat(weight);
    if (w > 0) {
      const calculated = w * maxDoseMgPerKg;
      const maxMg = Math.min(calculated, absoluteMaxMg);
      const cartridges = maxMg / 36; // خرطوشة 1.8 مل ليدوكايين 2% = 36 مجم تقريبًا
      return { maxMg, cartridges };
    }
    return null;
  })();

  // ==== 2) مؤشر DMFT (تسوس/مفقود/محشو) ====
  const [decayed, setDecayed] = useState('');
  const [missing, setMissing] = useState('');
  const [filled, setFilled] = useState('');
  const dmft = (() => {
    const d = parseInt(decayed) || 0, m = parseInt(missing) || 0, f = parseInt(filled) || 0;
    if (decayed || missing || filled) return d + m + f;
    return null;
  })();

  // ==== 3) دواعي الوقاية بالمضاد الحيوي قبل الإجراءات الجراحية بالفم (إرشادات AHA) ====
  const [prostheticValve, setProstheticValve] = useState(false);
  const [priorEndocarditis, setPriorEndocarditis] = useState(false);
  const [congenitalHeart, setCongenitalHeart] = useState(false);
  const [transplantValvulopathy, setTransplantValvulopathy] = useState(false);
  const needsProphylaxis = prostheticValve || priorEndocarditis || congenitalHeart || transplantValvulopathy;

  return (
    <div className="space-y-6">
      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> الجرعة القصوى للتخدير الموضعي (ليدوكايين)
        </h3>
        <p className="text-xs text-gray-400 mb-4">القيم المرجعية المعتادة: 4.5 مجم/كجم بدون أدرينالين (حد أقصى 300 مجم)، 7 مجم/كجم مع أدرينالين (حد أقصى 500 مجم).</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div><label className="block text-sm text-gray-600 mb-1">وزن المريض (كجم)</label><input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full border rounded-lg p-2" placeholder="70" /></div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">نوع المحلول</label>
            <select value={withEpi ? 'epi' : 'plain'} onChange={(e) => setWithEpi(e.target.value === 'epi')} className="w-full border rounded-lg p-2">
              <option value="epi">ليدوكايين 2% + أدرينالين</option>
              <option value="plain">ليدوكايين 2% بدون أدرينالين</option>
            </select>
          </div>
        </div>
        {doseResult && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-800 font-bold space-y-1">
            <p>الجرعة القصوى: {doseResult.maxMg.toFixed(0)} مجم</p>
            <p>يعادل تقريبًا: {doseResult.cartridges.toFixed(1)} خرطوشة (1.8 مل)</p>
          </div>
        )}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 mt-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          قيمة تقريبية مرجعية — راجع النشرة الدوائية وبروتوكولات العيادة، خصوصًا مع الأطفال أو مرضى القلب/الكبد.
        </div>
      </div>

      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> مؤشر DMFT (تسوس/مفقود/محشو)
        </h3>
        <p className="text-xs text-gray-400 mb-4">المؤشر الوبائي المعتمد من منظمة الصحة العالمية لتقييم عبء تسوس الأسنان.</p>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div><label className="block text-sm text-gray-600 mb-1">D — متسوسة</label><input type="number" min="0" value={decayed} onChange={(e) => setDecayed(e.target.value)} className="w-full border rounded-lg p-2" /></div>
          <div><label className="block text-sm text-gray-600 mb-1">M — مفقودة</label><input type="number" min="0" value={missing} onChange={(e) => setMissing(e.target.value)} className="w-full border rounded-lg p-2" /></div>
          <div><label className="block text-sm text-gray-600 mb-1">F — محشوة</label><input type="number" min="0" value={filled} onChange={(e) => setFilled(e.target.value)} className="w-full border rounded-lg p-2" /></div>
        </div>
        {dmft !== null && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-800 font-bold">
            DMFT = {dmft} {dmft === 0 ? '(لا يوجد عبء تسوس)' : dmft <= 4 ? '(منخفض)' : dmft <= 9 ? '(متوسط)' : '(مرتفع)'}
          </div>
        )}
      </div>

      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> دواعي الوقاية بالمضاد الحيوي (التهاب الشغاف)
        </h3>
        <p className="text-xs text-gray-400 mb-4">حسب إرشادات جمعية القلب الأمريكية (AHA) لمرضى الفئات عالية الخطورة قبل الإجراءات الجراحية بالفم.</p>
        <div className="space-y-2 mb-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={prostheticValve} onChange={(e) => setProstheticValve(e.target.checked)} /> صمام قلب صناعي</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={priorEndocarditis} onChange={(e) => setPriorEndocarditis(e.target.checked)} /> تاريخ سابق للإصابة بالتهاب الشغاف</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={congenitalHeart} onChange={(e) => setCongenitalHeart(e.target.checked)} /> مرض قلب خلقي (غير مُصحح أو مُصحح حديثًا)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={transplantValvulopathy} onChange={(e) => setTransplantValvulopathy(e.target.checked)} /> زراعة قلب مصحوبة باعتلال صمامي</label>
        </div>
        <div className={`rounded-lg p-3 font-bold ${needsProphylaxis ? 'bg-red-50 border border-red-100 text-red-700' : 'bg-gray-50 border border-gray-100 text-gray-600'}`}>
          {needsProphylaxis ? 'تُنصح الوقاية بالمضاد الحيوي قبل الإجراء' : 'لا توجد دواعي وقاية وفق العوامل المحددة أعلاه'}
        </div>
      </div>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        أدوات مرجعية للمساعدة السريرية، والقرار النهائي يعود لتقدير الطبيب المعالج.
      </div>
    </div>
  );
}
