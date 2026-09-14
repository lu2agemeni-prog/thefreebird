'use client';
import { useState } from 'react';
import { Calculator, Info } from 'lucide-react';

function ScoreSelect({ label, value, onChange, options }: { label: string; value: number; onChange: (v: number) => void; options: { value: number; label: string }[] }) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full border rounded-lg p-2">
        {options.map(o => <option key={o.value} value={o.value}>{o.value} — {o.label}</option>)}
      </select>
    </div>
  );
}

export function ObGynCalc() {
  // ==== 1) تاريخ الولادة المتوقع — قاعدة Naegele ====
  const [lmp, setLmp] = useState('');
  const eddResult = (() => {
    if (!lmp) return null;
    const lmpDate = new Date(lmp);
    const edd = new Date(lmpDate);
    edd.setDate(edd.getDate() + 280);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - lmpDate.getTime()) / 86400000);
    const gaWeeks = Math.floor(diffDays / 7);
    const gaDays = diffDays % 7;
    return { edd, gaWeeks, gaDays, diffDays };
  })();

  // ==== 2) مقياس بيشوب (Bishop Score) لجاهزية عنق الرحم ====
  const [dilation, setDilation] = useState(0);
  const [effacement, setEffacement] = useState(0);
  const [station, setStation] = useState(0);
  const [consistency, setConsistency] = useState(0);
  const [position, setPosition] = useState(0);
  const bishopTotal = dilation + effacement + station + consistency + position;

  // ==== 3) مقياس أبجار (APGAR) ====
  const [apgarFields, setApgarFields] = useState({ hr: 0, resp: 0, tone: 0, reflex: 0, color: 0 });
  const apgarTotal = apgarFields.hr + apgarFields.resp + apgarFields.tone + apgarFields.reflex + apgarFields.color;
  const apgarOption = (label0: string, label1: string, label2: string) => [{ value: 0, label: label0 }, { value: 1, label: label1 }, { value: 2, label: label2 }];

  return (
    <div className="space-y-6">
      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> تاريخ الولادة المتوقع وعمر الحمل
        </h3>
        <p className="text-xs text-gray-400 mb-4">قاعدة Naegele — بافتراض دورة شهرية منتظمة 28 يومًا.</p>
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">تاريخ أول يوم لآخر دورة شهرية (LMP)</label>
          <input type="date" value={lmp} onChange={(e) => setLmp(e.target.value)} className="w-full md:w-64 border rounded-lg p-2" />
        </div>
        {eddResult && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-800 font-bold space-y-1">
            <p>تاريخ الولادة المتوقع: {eddResult.edd.toLocaleDateString('ar-EG')}</p>
            <p>عمر الحمل الحالي: {eddResult.gaWeeks} أسبوع و{eddResult.gaDays} يوم</p>
          </div>
        )}
      </div>

      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> مقياس بيشوب (Bishop Score)
        </h3>
        <p className="text-xs text-gray-400 mb-4">تقييم جاهزية عنق الرحم للمخاض — نتيجة ≥ 8 تشير غالبًا لملاءمة الحث على الولادة.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <ScoreSelect label="اتساع عنق الرحم (Dilation)" value={dilation} onChange={setDilation} options={[{ value: 0, label: '0 سم' }, { value: 1, label: '1-2 سم' }, { value: 2, label: '3-4 سم' }, { value: 3, label: '≥5 سم' }]} />
          <ScoreSelect label="محو عنق الرحم (Effacement)" value={effacement} onChange={setEffacement} options={[{ value: 0, label: '0-30%' }, { value: 1, label: '40-50%' }, { value: 2, label: '60-70%' }, { value: 3, label: '≥80%' }]} />
          <ScoreSelect label="ارتكاز الجنين (Station)" value={station} onChange={setStation} options={[{ value: 0, label: '-3' }, { value: 1, label: '-2' }, { value: 2, label: '-1/0' }, { value: 3, label: '+1/+2' }]} />
          <ScoreSelect label="قوام عنق الرحم (Consistency)" value={consistency} onChange={setConsistency} options={[{ value: 0, label: 'صلب' }, { value: 1, label: 'متوسط' }, { value: 2, label: 'لين' }]} />
          <ScoreSelect label="وضع عنق الرحم (Position)" value={position} onChange={setPosition} options={[{ value: 0, label: 'خلفي' }, { value: 1, label: 'متوسط' }, { value: 2, label: 'أمامي' }]} />
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-800 font-bold">
          المجموع: {bishopTotal} — {bishopTotal >= 8 ? 'عنق رحم ملائم (مواتٍ) للحث على الولادة' : bishopTotal >= 6 ? 'حالة متوسطة' : 'عنق رحم غير مواتٍ حاليًا'}
        </div>
      </div>

      <div className="border rounded-xl p-5 bg-white shadow-sm">
        <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" /> مقياس أبجار (APGAR) للمولود
        </h3>
        <p className="text-xs text-gray-400 mb-4">يُقيَّم عادة في الدقيقة الأولى والخامسة بعد الولادة.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <ScoreSelect label="معدل ضربات القلب" value={apgarFields.hr} onChange={(v) => setApgarFields(p => ({ ...p, hr: v }))} options={apgarOption('غائب', 'أقل من 100', '100 فأكثر')} />
          <ScoreSelect label="المجهود التنفسي" value={apgarFields.resp} onChange={(v) => setApgarFields(p => ({ ...p, resp: v }))} options={apgarOption('غائب', 'بطيء/غير منتظم', 'بكاء قوي')} />
          <ScoreSelect label="التوتر العضلي" value={apgarFields.tone} onChange={(v) => setApgarFields(p => ({ ...p, tone: v }))} options={apgarOption('رخو', 'بعض الانثناء', 'حركة نشطة')} />
          <ScoreSelect label="الاستجابة المنعكسة" value={apgarFields.reflex} onChange={(v) => setApgarFields(p => ({ ...p, reflex: v }))} options={apgarOption('لا استجابة', 'تكشيرة', 'سعال/عطس/بكاء')} />
          <ScoreSelect label="اللون" value={apgarFields.color} onChange={(v) => setApgarFields(p => ({ ...p, color: v }))} options={apgarOption('أزرق/شاحب بالكامل', 'الجسم وردي والأطراف زرقاء', 'وردي بالكامل')} />
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-800 font-bold">
          المجموع: {apgarTotal}/10 — {apgarTotal >= 7 ? 'حالة طبيعية' : apgarTotal >= 4 ? 'يحتاج مراقبة/تدخل بسيط' : 'يحتاج إنعاش فوري'}
        </div>
      </div>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        أدوات مرجعية مبنية على مقاييس معتمدة سريريًا، والتقييم النهائي يعود للطبيب المعالج بناءً على الفحص الإكلينيكي الكامل.
      </div>
    </div>
  );
}
