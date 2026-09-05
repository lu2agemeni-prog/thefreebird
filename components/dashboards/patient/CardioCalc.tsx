'use client';
import { useState } from 'react';
import { Calculator, Info, HeartPulse } from 'lucide-react';

export function CardioCalc() {
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [smoker, setSmoker] = useState(false);
  const [diabetes, setDiabetes] = useState(false);
  const [bp, setBp] = useState(''); // Systolic
  const [cholesterol, setCholesterol] = useState(''); // Total
  const [hdl, setHdl] = useState('');

  const [risk, setRisk] = useState<number | null>(null);

  const calculateRisk = () => {
    // Simplified Framingham Risk Score approximation for 10-year CVD risk
    // Note: A true ASCVD calculator requires complex logarithmic equations (Pooled Cohort Equations).
    // We will use a simplified point-based logic derived from Framingham for educational purposes.
    
    let a = parseInt(age);
    let s = parseInt(bp);
    let c = parseInt(cholesterol);
    let h = parseInt(hdl);

    if (a > 0 && s > 0 && c > 0 && h > 0) {
      let points = 0;
      
      // Rough age points
      if (a >= 35 && a < 40) points += 2;
      else if (a >= 40 && a < 45) points += 5;
      else if (a >= 45 && a < 50) points += 7;
      else if (a >= 50 && a < 55) points += 8;
      else if (a >= 55 && a < 60) points += 10;
      else if (a >= 60 && a < 65) points += 11;
      else if (a >= 65) points += 12;

      // Chol points
      if (c > 160 && c <= 199) points += 1;
      else if (c > 199 && c <= 239) points += 3;
      else if (c > 239 && c <= 279) points += 4;
      else if (c > 279) points += 5;

      // Smoker points
      if (smoker) points += (a < 50 ? 5 : 3);

      // HDL points
      if (h < 40) points += 2;
      else if (h >= 60) points -= 1;

      // BP points
      if (s >= 130 && s <= 139) points += 1;
      else if (s >= 140 && s <= 159) points += 2;
      else if (s >= 160) points += 3;

      if (diabetes) points += 4;

      // Calculate percentage roughly
      let riskPercent = 1;
      if (points >= 10 && points <= 12) riskPercent = 5;
      else if (points >= 13 && points <= 14) riskPercent = 10;
      else if (points == 15) riskPercent = 15;
      else if (points == 16) riskPercent = 20;
      else if (points >= 17) riskPercent = 25; // >20% is high risk

      // Adjust for females (usually lower baseline risk in this simplified model)
      if (gender === 'female') {
        riskPercent = Math.max(1, riskPercent - 3);
      }

      setRisk(riskPercent);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4 p-4 border rounded-xl bg-white shadow-sm">
          <h3 className="font-bold text-lg text-red-700 flex items-center gap-2">
            <HeartPulse className="w-5 h-5" /> تقييم مخاطر القلب
          </h3>
          <p className="text-sm text-gray-500">حساب خطر الإصابة بأمراض القلب والأوعية الدموية خلال 10 سنوات.</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">العمر</label>
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="w-full border rounded-lg p-2" placeholder="45" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">النوع</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full border rounded-lg p-2">
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">ضغط الدم الانقباضي (الرقم الأكبر)</label>
              <input type="number" value={bp} onChange={(e) => setBp(e.target.value)} className="w-full border rounded-lg p-2" placeholder="120" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">الكوليسترول الكلي (mg/dL)</label>
              <input type="number" value={cholesterol} onChange={(e) => setCholesterol(e.target.value)} className="w-full border rounded-lg p-2" placeholder="180" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">الكوليسترول النافع HDL (mg/dL)</label>
              <input type="number" value={hdl} onChange={(e) => setHdl(e.target.value)} className="w-full border rounded-lg p-2" placeholder="50" />
            </div>
            <div className="col-span-2 flex gap-6 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={smoker} onChange={(e) => setSmoker(e.target.checked)} className="w-4 h-4 text-red-600 rounded" />
                <span className="text-sm font-bold">مدخن</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={diabetes} onChange={(e) => setDiabetes(e.target.checked)} className="w-4 h-4 text-red-600 rounded" />
                <span className="text-sm font-bold">مريض سكري</span>
              </label>
            </div>
          </div>
          <button onClick={calculateRisk} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg transition-colors">
            احسب المخاطر
          </button>
        </div>

        <div className="p-4 border rounded-xl bg-gray-50 shadow-sm flex flex-col justify-center">
          <h3 className="font-bold text-lg text-gray-800 mb-4">نتيجة التقييم</h3>
          
          {risk !== null ? (
            <div className="bg-white p-4 rounded-lg border text-center space-y-2">
              <span className="text-gray-500 text-sm block">نسبة الخطر المقدرة للإصابة بمشاكل قلبية خلال 10 سنوات:</span>
              <span className={`font-bold text-4xl block ${risk < 7.5 ? 'text-emerald-600' : risk <= 20 ? 'text-orange-600' : 'text-red-600'}`}>
                {risk >= 25 ? '> 20%' : `${risk}%`}
              </span>
              <p className="font-bold mt-2">
                {risk < 7.5 ? 'خطر منخفض - استمر على نمط حياة صحي.' : 
                 risk <= 20 ? 'خطر متوسط - يجب استشارة الطبيب لتحسين العوامل.' : 
                 'خطر عالي - يجب التدخل الطبي فوراً واستشارة طبيب القلب.'}
              </p>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">أدخل بياناتك كاملة (الكوليسترول وضغط الدم) واضغط احسب</p>
          )}
        </div>
      </div>

      <div className="bg-red-50 p-4 rounded-xl text-sm text-red-900 flex gap-2">
        <Info className="w-5 h-5 shrink-0" />
        <div>
          <strong>المصادر الطبية:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>حسابات المخاطر مبنية بشكل مبسط على دراسة فرامنغهام لأمراض القلب (Framingham Heart Study).</li>
            <li>إرشادات الكلية الأمريكية لأمراض القلب وجمعية القلب الأمريكية (ACC/AHA ASCVD Risk).</li>
            <li>هذه النتيجة تقريبية ولا تغني أبداً عن الفحص الطبي الدقيق والتحاليل المعملية الكاملة.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
