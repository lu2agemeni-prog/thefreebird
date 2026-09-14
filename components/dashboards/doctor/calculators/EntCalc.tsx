'use client';
import { useState } from 'react';
import { Calculator, Info } from 'lucide-react';

export function EntCalc() {
  // ==== 1) مقياس STOP-BANG لتقييم خطر انقطاع النفس الانسدادي أثناء النوم ====
  const [snoring, setSnoring] = useState(false);
  const [tiredness, setTiredness] = useState(false);
  const [observedApnea, setObservedApnea] = useState(false);
  const [pressure, setPressure] = useState(false);
  const [bmiOver35, setBmiOver35] = useState(false);
  const [ageOver50, setAgeOver50] = useState(false);
  const [neckOver40, setNeckOver40] = useState(false);
  const [maleGender, setMaleGender] = useState(false);
  const stopBangScore = [snoring, tiredness, observedApnea, pressure, bmiOver35, ageOver50, neckOver40, maleGender].filter(Boolean).length;
  const stopBangRisk = stopBangScore <= 2 ? 'خطر منخفض' : stopBangScore <= 4 ? 'خطر متوسط' : 'خطر عالٍ';

  // ==== 2) تصنيف حجم اللوزتين (مقياس Brodsky) ====
  const [tonsilGrade, setTonsilGrade] = useState(0);
  const tonsilDescriptions: Record<number, string> = {
    0: 'اللوزتان داخل الحفرة اللوزية تمامًا (مستأصلتان أو ضامرتان)',
    1: 'تشغلان ≤25% من المسافة بين الأقواس الحنكية',
    2: 'تشغلان 26-50% من المسافة',
    3: 'تشغلان 51-75% من المسافة',
    4: 'تشغلان ≥75% (تلامس خط الوسط) — لوزتان ضخمتان',
  };

  // ==== 3) تصنيف شدة ضعف السمع (منظمة الصحة العالمية) ====
  const [hearingDb, setHearingDb] = useState('');
  const hearingResult = (() => {
    const db = parseFloat(hearingDb);
    if (isNaN(db) || hearingDb === '') return null;
    if (db < 20) return 'طبيعي';
    if (db < 35) return 'ضعف خفيف';
    if (db < 50) return 'ضعف متوسط';
    if (db < 65) return 'ضعف متوسط إلى شديد';
    if (db < 80) return 'ضعف شديد';
    return 'ضعف عميق';
  })();

  return (
    <div className="space-y-6">
      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> مقياس STOP-BANG لخطر انقطاع النفس الانسدادي
        </h3>
        <p className="text-xs text-gray-400 mb-4">أداة فحص شائعة الاستخدام قبل الإجراءات الجراحية والتخدير أيضًا.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={snoring} onChange={(e) => setSnoring(e.target.checked)} /> شخير عالٍ (Snoring)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={tiredness} onChange={(e) => setTiredness(e.target.checked)} /> إرهاق/نعاس نهاري (Tiredness)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={observedApnea} onChange={(e) => setObservedApnea(e.target.checked)} /> ملاحظة انقطاع تنفس أثناء النوم (Observed)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={pressure} onChange={(e) => setPressure(e.target.checked)} /> ارتفاع ضغط الدم (Pressure)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={bmiOver35} onChange={(e) => setBmiOver35(e.target.checked)} /> مؤشر كتلة الجسم أكبر من 35</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={ageOver50} onChange={(e) => setAgeOver50(e.target.checked)} /> العمر أكبر من 50 سنة</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={neckOver40} onChange={(e) => setNeckOver40(e.target.checked)} /> محيط الرقبة أكبر من 40 سم</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={maleGender} onChange={(e) => setMaleGender(e.target.checked)} /> الجنس ذكر</label>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-800 font-bold">
          المجموع: {stopBangScore}/8 — {stopBangRisk}
        </div>
      </div>

      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> تصنيف حجم اللوزتين (مقياس Brodsky)
        </h3>
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">الدرجة</label>
          <select value={tonsilGrade} onChange={(e) => setTonsilGrade(Number(e.target.value))} className="w-full border rounded-lg p-2">
            {[0, 1, 2, 3, 4].map(g => <option key={g} value={g}>الدرجة {g}</option>)}
          </select>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-800 font-bold">
          {tonsilDescriptions[tonsilGrade]}
        </div>
      </div>

      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> تصنيف شدة ضعف السمع (منظمة الصحة العالمية)
        </h3>
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">متوسط عتبة السمع (dB HL)</label>
          <input type="number" value={hearingDb} onChange={(e) => setHearingDb(e.target.value)} className="w-full md:w-64 border rounded-lg p-2" placeholder="مثال: 30" />
        </div>
        {hearingResult && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-800 font-bold">
            {hearingResult}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        أدوات مرجعية مبنية على مقاييس معتمدة سريريًا، والتقييم النهائي يعود لتقدير الطبيب المعالج.
      </div>
    </div>
  );
}
