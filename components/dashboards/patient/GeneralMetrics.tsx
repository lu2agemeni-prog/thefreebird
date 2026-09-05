'use client';
import { useState } from 'react';
import { Calculator, Info } from 'lucide-react';

export function GeneralMetrics() {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState('male');
  const [waist, setWaist] = useState('');

  const [bmi, setBmi] = useState<number | null>(null);
  const [ibw, setIbw] = useState<number | null>(null);
  const [calories, setCalories] = useState<number | null>(null);
  const [waistRisk, setWaistRisk] = useState<string | null>(null);

  const calculateAll = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height); // in cm
    const wc = parseFloat(waist);

    if (w > 0 && h > 0) {
      // BMI = weight(kg) / height(m)^2
      const hm = h / 100;
      const calcBmi = w / (hm * hm);
      setBmi(calcBmi);

      // Ideal Body Weight (Devine Formula)
      // Male: 50.0 kg + 2.3 kg per inch over 5 feet
      // Female: 45.5 kg + 2.3 kg per inch over 5 feet
      const heightInInches = h / 2.54;
      let calcIbw = 0;
      if (heightInInches > 60) {
        if (gender === 'male') calcIbw = 50.0 + 2.3 * (heightInInches - 60);
        else calcIbw = 45.5 + 2.3 * (heightInInches - 60);
      } else {
        calcIbw = gender === 'male' ? 50.0 : 45.5; // Base if under 5 feet
      }
      setIbw(calcIbw);

      // Mifflin-St Jeor Equation for resting metabolic rate based on ideal weight (for maintenance)
      // We will calculate maintenance calories for their IDEAL weight to help them set goals
      // Age isn't requested, assuming average adult age of 30 for baseline estimation
      let bmr = 0;
      if (gender === 'male') {
        bmr = 10 * calcIbw + 6.25 * h - 5 * 30 + 5;
      } else {
        bmr = 10 * calcIbw + 6.25 * h - 5 * 30 - 161;
      }
      // Assuming sedentary activity multiplier 1.2
      setCalories(bmr * 1.2);
    }

    if (wc > 0) {
      if (gender === 'male') {
        setWaistRisk(wc > 102 ? 'عالي (خطر زيادة أمراض القلب)' : 'طبيعي');
      } else {
        setWaistRisk(wc > 88 ? 'عالي (خطر زيادة أمراض القلب)' : 'طبيعي');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4 p-4 border rounded-xl bg-white shadow-sm">
          <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2">
            <Calculator className="w-5 h-5" /> إدخال البيانات
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">النوع</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full border rounded-lg p-2">
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">الطول (سم)</label>
              <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="w-full border rounded-lg p-2" placeholder="170" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">الوزن الحالي (كجم)</label>
              <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full border rounded-lg p-2" placeholder="70" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">محيط الخصر (سم) - اختياري</label>
              <input type="number" value={waist} onChange={(e) => setWaist(e.target.value)} className="w-full border rounded-lg p-2" placeholder="90" />
            </div>
          </div>
          <button onClick={calculateAll} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg transition-colors">
            احسب النتائج
          </button>
        </div>

        <div className="p-4 border rounded-xl bg-gray-50 shadow-sm space-y-4">
          <h3 className="font-bold text-lg text-gray-800">النتائج</h3>
          
          {bmi !== null && (
            <div className="bg-white p-3 rounded-lg border">
              <span className="text-gray-500 text-sm block">مؤشر كتلة الجسم (BMI):</span>
              <span className="font-bold text-xl">{bmi.toFixed(1)}</span>
              <span className={`ml-2 text-sm font-bold ${bmi < 18.5 ? 'text-blue-600' : bmi < 25 ? 'text-emerald-600' : bmi < 30 ? 'text-orange-600' : 'text-red-600'}`}>
                ({bmi < 18.5 ? 'نحافة' : bmi < 25 ? 'وزن طبيعي' : bmi < 30 ? 'وزن زائد' : 'سمنة'})
              </span>
            </div>
          )}

          {ibw !== null && (
            <div className="bg-white p-3 rounded-lg border">
              <span className="text-gray-500 text-sm block">الوزن المثالي (بناءً على الطول):</span>
              <span className="font-bold text-xl text-emerald-700">{ibw.toFixed(1)} كجم</span>
            </div>
          )}

          {calories !== null && (
            <div className="bg-white p-3 rounded-lg border">
              <span className="text-gray-500 text-sm block">السعرات الحرارية اليومية للحفاظ على الوزن المثالي:</span>
              <span className="font-bold text-xl text-blue-700">{Math.round(calories)} سعرة</span>
            </div>
          )}

          {waistRisk && (
            <div className="bg-white p-3 rounded-lg border">
              <span className="text-gray-500 text-sm block">مخاطر محيط الخصر:</span>
              <span className={`font-bold text-lg ${waistRisk === 'طبيعي' ? 'text-emerald-600' : 'text-red-600'}`}>{waistRisk}</span>
            </div>
          )}

          {bmi === null && <p className="text-gray-400 text-center py-8">قم بإدخال الطول والوزن واضغط على احسب</p>}
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 flex gap-2">
        <Info className="w-5 h-5 shrink-0" />
        <div>
          <strong>المصادر الطبية:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>مؤشر كتلة الجسم ومحيط الخصر: منظمة الصحة العالمية (WHO).</li>
            <li>الوزن المثالي: معادلة Devine (1974) المعتمدة عالمياً.</li>
            <li>السعرات الحرارية: معادلة Mifflin-St Jeor (معتمدة من أكاديمية التغذية وعلم الجينات).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
