'use client';
import { useState } from 'react';
import { Calculator, Info } from 'lucide-react';

export function FamilyMedicineCalc() {
  // ==== 1) مساحة سطح الجسم (BSA) — معادلة Mosteller ====
  const [bsaWeight, setBsaWeight] = useState('');
  const [bsaHeight, setBsaHeight] = useState('');
  const bsaResult = (() => {
    const w = parseFloat(bsaWeight), h = parseFloat(bsaHeight);
    if (w > 0 && h > 0) return Math.sqrt((h * w) / 3600);
    return null;
  })();

  // ==== 2) تصفية الكرياتينين — معادلة Cockcroft-Gault ====
  const [ccAge, setCcAge] = useState('');
  const [ccWeight, setCcWeight] = useState('');
  const [ccCreatinine, setCcCreatinine] = useState('');
  const [ccGender, setCcGender] = useState<'male' | 'female'>('male');
  const ccResult = (() => {
    const age = parseFloat(ccAge), w = parseFloat(ccWeight), cr = parseFloat(ccCreatinine);
    if (age > 0 && w > 0 && cr > 0) {
      const base = ((140 - age) * w) / (72 * cr);
      return ccGender === 'female' ? base * 0.85 : base;
    }
    return null;
  })();

  // ==== 3) مؤشر CHA2DS2-VASc لتقييم خطر السكتة في الرجفان الأذيني ====
  const [chf, setChf] = useState(false);
  const [htn, setHtn] = useState(false);
  const [age75, setAge75] = useState(false);
  const [age65, setAge65] = useState(false);
  const [diabetes, setDiabetes] = useState(false);
  const [stroke, setStroke] = useState(false);
  const [vascular, setVascular] = useState(false);
  const [female, setFemale] = useState(false);
  const chadsScore = (chf ? 1 : 0) + (htn ? 1 : 0) + (age75 ? 2 : (age65 ? 1 : 0)) + (diabetes ? 1 : 0) + (stroke ? 2 : 0) + (vascular ? 1 : 0) + (female ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> مساحة سطح الجسم (BSA)
        </h3>
        <p className="text-xs text-gray-400 mb-4">معادلة Mosteller — تُستخدم غالبًا في حساب جرعات الأدوية الكيميائية وبعض البروتوكولات العلاجية.</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div><label className="block text-sm text-gray-600 mb-1">الطول (سم)</label><input type="number" value={bsaHeight} onChange={(e) => setBsaHeight(e.target.value)} className="w-full border rounded-lg p-2" placeholder="170" /></div>
          <div><label className="block text-sm text-gray-600 mb-1">الوزن (كجم)</label><input type="number" value={bsaWeight} onChange={(e) => setBsaWeight(e.target.value)} className="w-full border rounded-lg p-2" placeholder="70" /></div>
        </div>
        {bsaResult !== null && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-800 font-bold">
            BSA = {bsaResult.toFixed(2)} م²
          </div>
        )}
      </div>

      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> تصفية الكرياتينين (Creatinine Clearance)
        </h3>
        <p className="text-xs text-gray-400 mb-4">معادلة Cockcroft-Gault — لتقدير وظائف الكلى وضبط جرعات الأدوية المصفّاة كلويًا.</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div><label className="block text-sm text-gray-600 mb-1">النوع</label><select value={ccGender} onChange={(e) => setCcGender(e.target.value as any)} className="w-full border rounded-lg p-2"><option value="male">ذكر</option><option value="female">أنثى</option></select></div>
          <div><label className="block text-sm text-gray-600 mb-1">العمر (سنة)</label><input type="number" value={ccAge} onChange={(e) => setCcAge(e.target.value)} className="w-full border rounded-lg p-2" placeholder="45" /></div>
          <div><label className="block text-sm text-gray-600 mb-1">الوزن (كجم)</label><input type="number" value={ccWeight} onChange={(e) => setCcWeight(e.target.value)} className="w-full border rounded-lg p-2" placeholder="70" /></div>
          <div><label className="block text-sm text-gray-600 mb-1">كرياتينين المصل (mg/dL)</label><input type="number" step="0.01" value={ccCreatinine} onChange={(e) => setCcCreatinine(e.target.value)} className="w-full border rounded-lg p-2" placeholder="1.0" /></div>
        </div>
        {ccResult !== null && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-800 font-bold">
            CrCl ≈ {ccResult.toFixed(1)} مل/دقيقة
          </div>
        )}
      </div>

      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> مؤشر CHA₂DS₂-VASc
        </h3>
        <p className="text-xs text-gray-400 mb-4">تقييم خطر السكتة الدماغية في مرضى الرجفان الأذيني غير الروماتيزمي (وفق الإرشادات الأوروبية/الأمريكية).</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={chf} onChange={(e) => setChf(e.target.checked)} /> قصور القلب الاحتقاني</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={htn} onChange={(e) => setHtn(e.target.checked)} /> ارتفاع ضغط الدم</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={age75} onChange={(e) => { setAge75(e.target.checked); if (e.target.checked) setAge65(false); }} /> العمر ≥ 75</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={age65} onChange={(e) => { setAge65(e.target.checked); if (e.target.checked) setAge75(false); }} /> العمر 65-74</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={diabetes} onChange={(e) => setDiabetes(e.target.checked)} /> السكري</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={stroke} onChange={(e) => setStroke(e.target.checked)} /> سكتة/TIA/جلطة سابقة</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={vascular} onChange={(e) => setVascular(e.target.checked)} /> مرض وعائي (شرايين تاجية/طرفية)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={female} onChange={(e) => setFemale(e.target.checked)} /> أنثى</label>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-800 font-bold">
          المجموع: {chadsScore} — {chadsScore === 0 ? 'خطر منخفض' : chadsScore === 1 ? 'خطر متوسط (يُراعى حسب الجنس)' : 'خطر عالٍ — يُرجّح الحاجة لمضادات التخثر'}
        </div>
      </div>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        أدوات مرجعية مبنية على معادلات ومقاييس معتمدة سريريًا، والقرار العلاجي النهائي يعود لتقدير الطبيب المعالج وحالة المريض الكاملة.
      </div>
    </div>
  );
}
