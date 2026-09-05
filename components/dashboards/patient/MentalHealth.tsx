'use client';
import { useState } from 'react';
import { Brain, Info, CheckCircle2 } from 'lucide-react';

const gad7Questions = [
  "الشعور بالعصبية، القلق، أو التوتر؟",
  "عدم القدرة على إيقاف أو السيطرة على القلق؟",
  "القلق كثيراً حول أمور مختلفة؟",
  "صعوبة في الاسترخاء؟",
  "الشعور بالتململ لدرجة صعوبة الجلوس بهدوء؟",
  "سهولة الانزعاج أو الغضب السريع؟",
  "الشعور بالخوف وكأن شيئاً مروعاً سيحدث؟"
];

const phq9Questions = [
  "قلة الاهتمام أو المتعة في القيام بالأشياء؟",
  "الشعور بالإحباط، الاكتئاب، أو اليأس؟",
  "صعوبة في النوم أو البقاء نائماً، أو النوم لفترات طويلة؟",
  "الشعور بالتعب أو فقدان الطاقة؟",
  "ضعف الشهية أو الإفراط في الأكل؟",
  "الشعور بالسوء تجاه نفسك، أو أنك فاشل، أو خذلت نفسك أو عائلتك؟",
  "صعوبة في التركيز على الأشياء، مثل قراءة الصحف أو مشاهدة التلفاز؟",
  "التحرك أو التحدث ببطء شديد يلاحظه الآخرون، أو العكس (التململ وكثرة الحركة)؟",
  "أفكار بأنك من الأفضل أن تموت، أو إيذاء نفسك بطريقة ما؟"
];

const options = [
  { text: "مطلقاً", value: 0 },
  { text: "عدة أيام", value: 1 },
  { text: "أكثر من نصف الأيام", value: 2 },
  { text: "كل يوم تقريباً", value: 3 }
];

export function MentalHealth() {
  const [activeTest, setActiveTest] = useState<'GAD7' | 'PHQ9'>('GAD7');
  const [gadAnswers, setGadAnswers] = useState<number[]>(Array(7).fill(-1));
  const [phqAnswers, setPhqAnswers] = useState<number[]>(Array(9).fill(-1));

  const handleAnswer = (index: number, val: number, type: 'GAD7' | 'PHQ9') => {
    if (type === 'GAD7') {
      const newAns = [...gadAnswers];
      newAns[index] = val;
      setGadAnswers(newAns);
    } else {
      const newAns = [...phqAnswers];
      newAns[index] = val;
      setPhqAnswers(newAns);
    }
  };

  const getGadScore = () => gadAnswers.includes(-1) ? null : gadAnswers.reduce((a, b) => a + b, 0);
  const getPhqScore = () => phqAnswers.includes(-1) ? null : phqAnswers.reduce((a, b) => a + b, 0);

  const renderQuestions = (questions: string[], answers: number[], type: 'GAD7' | 'PHQ9') => {
    return (
      <div className="space-y-6 mt-4">
        <p className="text-gray-600 mb-4 font-medium">خلال الأسبوعين الماضيين، كم مرة عانيت من المشاكل التالية؟</p>
        {questions.map((q, i) => (
          <div key={i} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <p className="font-bold text-gray-800 mb-3">{i + 1}. {q}</p>
            <div className="flex flex-wrap gap-2">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAnswer(i, opt.value, type)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors border flex-1 md:flex-none ${
                    answers[i] === opt.value
                      ? 'bg-purple-600 text-white border-purple-600 font-bold'
                      : 'bg-white text-gray-600 hover:bg-purple-50'
                  }`}
                >
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderGadResult = () => {
    const score = getGadScore();
    if (score === null) return null;
    let severity = '';
    let color = '';
    if (score <= 4) { severity = 'لا يوجد قلق (طبيعي)'; color = 'text-emerald-600'; }
    else if (score <= 9) { severity = 'قلق خفيف'; color = 'text-yellow-600'; }
    else if (score <= 14) { severity = 'قلق متوسط'; color = 'text-orange-600'; }
    else { severity = 'قلق شديد'; color = 'text-red-600'; }

    return (
      <div className="mt-6 p-6 border-2 border-purple-200 bg-purple-50 rounded-xl text-center">
        <h3 className="text-gray-500 font-bold mb-2">النتيجة الإجمالية (GAD-7)</h3>
        <p className="text-4xl font-bold mb-2">{score} <span className="text-xl text-gray-400">/ 21</span></p>
        <p className={`text-xl font-bold ${color}`}>{severity}</p>
      </div>
    );
  };

  const renderPhqResult = () => {
    const score = getPhqScore();
    if (score === null) return null;
    let severity = '';
    let color = '';
    if (score <= 4) { severity = 'لا يوجد اكتئاب (طبيعي)'; color = 'text-emerald-600'; }
    else if (score <= 9) { severity = 'اكتئاب خفيف'; color = 'text-yellow-600'; }
    else if (score <= 14) { severity = 'اكتئاب متوسط'; color = 'text-orange-600'; }
    else if (score <= 19) { severity = 'اكتئاب متوسط إلى شديد'; color = 'text-red-500'; }
    else { severity = 'اكتئاب شديد'; color = 'text-red-700'; }

    return (
      <div className="mt-6 p-6 border-2 border-purple-200 bg-purple-50 rounded-xl text-center">
        <h3 className="text-gray-500 font-bold mb-2">النتيجة الإجمالية (PHQ-9)</h3>
        <p className="text-4xl font-bold mb-2">{score} <span className="text-xl text-gray-400">/ 27</span></p>
        <p className={`text-xl font-bold ${color}`}>{severity}</p>
        {phqAnswers[8] > 0 && (
          <p className="mt-4 text-red-700 font-bold bg-red-100 p-2 rounded">تنبيه: يجب استشارة طبيب نفسي فوراً بناءً على إجابتك للسؤال الأخير.</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <button 
          onClick={() => setActiveTest('GAD7')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-center transition-colors border-2 ${activeTest === 'GAD7' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 hover:bg-gray-50 border-transparent shadow-sm'}`}
        >
          مقياس القلق العام (GAD-7)
        </button>
        <button 
          onClick={() => setActiveTest('PHQ9')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-center transition-colors border-2 ${activeTest === 'PHQ9' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 hover:bg-gray-50 border-transparent shadow-sm'}`}
        >
          مقياس الاكتئاب (PHQ-9)
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h3 className="font-bold text-xl text-purple-900 flex items-center gap-2 border-b pb-4">
          <Brain className="w-6 h-6" /> 
          {activeTest === 'GAD7' ? 'تقييم اضطراب القلق العام' : 'تقييم الصحة النفسية والاكتئاب'}
        </h3>
        
        {activeTest === 'GAD7' ? renderQuestions(gad7Questions, gadAnswers, 'GAD7') : renderQuestions(phq9Questions, phqAnswers, 'PHQ9')}
        
        {activeTest === 'GAD7' ? renderGadResult() : renderPhqResult()}
      </div>

      <div className="bg-purple-50 p-4 rounded-xl text-sm text-purple-900 flex gap-2">
        <Info className="w-5 h-5 shrink-0" />
        <div>
          <strong>المصادر الطبية والأدلة:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>(GAD-7): مقياس موثق عالمياً من تطوير (Spitzer et al., 2006) لتقييم حدة القلق.</li>
            <li>(PHQ-9): استبيان صحة المريض المعتمد من الجمعية الأمريكية للطب النفسي (APA) لتقييم الاكتئاب.</li>
            <li>هذه التقييمات هي أدوات فحص مبدئية ولا تعتبر تشخيصاً طبياً نهائياً، ويجب مراجعة الطبيب المختص للحصول على تشخيص وعلاج.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
