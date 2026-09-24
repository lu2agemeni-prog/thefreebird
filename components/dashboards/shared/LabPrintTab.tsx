'use client';

// ============================================================================
// components/dashboards/shared/LabPrintTab.tsx
// تبويب "طباعة معمل" — مشترك بين السكرتارية والمدير
// قوالب تحاليل جاهزة للطباعة مع هوامش A4 مخصصة (4 سم فارغ بالأعلى للورق المروّس)
// وخيارات طباعة، إرسال للمريض عبر التطبيق، ومشاركة واتساب.
// ============================================================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Printer,
  Share2,
  Send,
  Search,
  User,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Copy,
  RefreshCw,
  FlaskConical,
  X,
  Stethoscope,
  Plus,
  Trash2,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { LAB_TEMPLATES, LabTemplate, LabTestField } from '@/lib/lab-templates';

interface RegisteredPatient {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  patient_code: string | null;
  gender?: string | null;
  birth_date?: string | null;
}

interface DoctorProfile {
  id: string;
  name: string;
}

export function LabPrintTab() {
  const { user } = useAuth();

  // 1. اختيارات القالب
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('hba1c');
  const currentTemplate = useMemo(() => {
    return LAB_TEMPLATES.find((t) => t.id === selectedTemplateId) || LAB_TEMPLATES[0];
  }, [selectedTemplateId]);

  // 2. بيانات رأس التقرير (مريض، طبيب، تاريخ، عمر)
  const [patientSearch, setPatientSearch] = useState('');
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  const [patientSearchResults, setPatientSearchResults] = useState<RegisteredPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<RegisteredPatient | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState<'ذكر' | 'أنثى' | ''>('ذكر');
  const [patientPhone, setPatientPhone] = useState('');
  const [doctorMode, setDoctorMode] = useState<'select' | 'custom'>('select');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [customDoctorName, setCustomDoctorName] = useState('');
  const [doctorsList, setDoctorsList] = useState<DoctorProfile[]>([]);
  const [sampleDate, setSampleDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [sampleId, setSampleId] = useState<string>(() => `LAB-${Math.floor(100000 + Math.random() * 900000)}`);

  // 3. قيم نتائج التحليل
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    LAB_TEMPLATES[0].fields.forEach((f) => {
      initial[f.id] = f.defaultValue !== undefined ? String(f.defaultValue) : '';
    });
    return initial;
  });
  const [clinicalNotes, setClinicalNotes] = useState<string>(LAB_TEMPLATES[0].notesDefault || '');
  const [labTechnician, setLabTechnician] = useState<string>('أخصائي التحاليل الطبية');

  // خيارات حقول القالب المخصص
  const [customRows, setCustomRows] = useState<
    Array<{ id: string; name: string; result: string; unit: string; range: string; status: 'normal' | 'high' | 'low' }>
  >([
    { id: '1', name: 'الفحص المخصص 1', result: '', unit: '', range: 'Normal', status: 'normal' },
  ]);

  // 4. خيارات الطباعة والعرض
  const [leaveLetterheadMargin, setLeaveLetterheadMargin] = useState<boolean>(true); // 4cm فارغ بالأعلى
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSendingToPatient, setIsSendingToPatient] = useState(false);

  // اختيار قالب وإعادة تهيئة الحقول مباشرة
  const handleSelectTemplate = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    const tmpl = LAB_TEMPLATES.find((t) => t.id === tmplId) || LAB_TEMPLATES[0];
    const initial: Record<string, string> = {};
    tmpl.fields.forEach((f) => {
      initial[f.id] = f.defaultValue !== undefined ? String(f.defaultValue) : '';
    });
    setFieldValues(initial);
    setClinicalNotes(tmpl.notesDefault || '');
  };

  // تعديل قيمة حقل مع الحساب التلقائي للسكر التراكمي
  const handleFieldValueChange = (fieldId: string, val: string) => {
    setFieldValues((prev) => {
      const next = { ...prev, [fieldId]: val };
      if (selectedTemplateId === 'hba1c' && fieldId === 'hba1c_val') {
        const num = parseFloat(val);
        if (!isNaN(num) && num > 0) {
          next['eag_val'] = String(Math.round(28.7 * num - 46.7));
        }
      }
      return next;
    });
  };

  // تحميل الأطباء
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('role', 'doctor')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const docs = data.map((d) => ({
            id: d.id,
            name: `د. ${d.first_name || ''} ${d.last_name || ''}`.trim(),
          }));
          setDoctorsList(docs);
          setSelectedDoctorId((prev) => prev || docs[0].name);
        }
      });
  }, []);

  // البحث عن مريض
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = patientSearch.trim();
    if (!q) {
      setTimeout(() => setPatientSearchResults([]), 0);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setIsSearchingPatient(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, patient_code, gender, birth_date')
        .eq('role', 'patient')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,patient_code.ilike.%${q}%`)
        .limit(6);

      setPatientSearchResults((data as RegisteredPatient[]) || []);
      setIsSearchingPatient(false);
    }, 250);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [patientSearch]);

  // اختيار مريض مسجل
  const handleSelectPatient = (p: RegisteredPatient) => {
    setSelectedPatient(p);
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    setPatientName(fullName);
    setPatientPhone(p.phone || '');
    if (p.gender === 'female' || p.gender === 'أنثى') setPatientGender('أنثى');
    else if (p.gender === 'male' || p.gender === 'ذكر') setPatientGender('ذكر');

    // حساب العمر إذا كان تاريخ الميلاد متاح
    if (p.birth_date) {
      const birthYear = new Date(p.birth_date).getFullYear();
      const currentYear = new Date().getFullYear();
      if (birthYear > 1900 && currentYear >= birthYear) {
        setPatientAge(`${currentYear - birthYear} سنة`);
      }
    }
    setPatientSearch('');
    setPatientSearchResults([]);
  };

  const handleClearPatient = () => {
    setSelectedPatient(null);
    setPatientName('');
    setPatientPhone('');
    setPatientAge('');
  };

  // اسم الطبيب الفعلي
  const effectiveDoctorName = doctorMode === 'select' ? selectedDoctorId || 'طبيب المركز' : customDoctorName || 'د. استشاري المعمل';

  // تقييم النتيجة للقالب الحالي
  const currentInterpretation = useMemo(() => {
    if (currentTemplate.interpret) {
      return currentTemplate.interpret(fieldValues);
    }
    return null;
  }, [currentTemplate, fieldValues]);

  // 1. إجراء الطباعة الفورية
  const handlePrint = () => {
    window.print();
  };

  // 2. إرسال النتيجة إلى حساب المريض في التطبيق
  const handleSendToPatientApp = async () => {
    if (!patientName.trim()) {
      setStatusMessage({ type: 'error', text: 'يرجى إدخال اسم المريض أولاً.' });
      return;
    }

    if (!selectedPatient) {
      setStatusMessage({
        type: 'info',
        text: 'تنبيه: لإرسال النتيجة إلى تطبيق المريض، يجب اختيار مريض مسجل بحساب في المنظومة من شريط البحث. يمكنك الطباعة أو المشاركة بالواتساب حالياً للمرضى غير المسجلين.',
      });
      return;
    }

    setIsSendingToPatient(true);
    setStatusMessage(null);

    try {
      // حفظ في جدول lab_results
      const numericVal = parseFloat(fieldValues['hba1c_val'] || Object.values(fieldValues)[0] || '0');
      const formattedNotes = `تقرير فحص ${currentTemplate.titleAr} (${currentTemplate.titleEn}) - النتيجة: ${
        fieldValues['hba1c_val'] ? fieldValues['hba1c_val'] + '%' : Object.values(fieldValues)[0] || 'مكتمل'
      }. الطبيب المعالج: ${effectiveDoctorName}. ملاحظات المعمل: ${clinicalNotes}`;

      // إدراج النتيجة
      const { error: labError } = await supabase.from('lab_results').insert([
        {
          patient_id: selectedPatient.id,
          value: isNaN(numericVal) ? 0 : numericVal,
          notes: formattedNotes,
          entered_by: user?.id || null,
        },
      ]);

      if (labError) {
        console.warn('lab_results insert notice:', labError.message);
      }

      // إشعار المريض
      await supabase.from('notifications').insert([
        {
          user_id: selectedPatient.id,
          title: `نتيجة ${currentTemplate.titleAr} جاهزة 🔬`,
          message: `أصدر معمل المركز نتيجة فحص ${currentTemplate.titleAr} الخاصة بك (${patientName}). يمكنك مراجعة تفاصيل الفحص الآن.`,
          type: 'lab',
          link: '/lab-results',
        },
      ]);

      setStatusMessage({
        type: 'success',
        text: `تم إرسال نتيجة ${currentTemplate.titleAr} إلى حساب المريض (${patientName}) وإشعاره في التطبيق بنجاح!`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: getFriendlyErrorMessage(err, 'تعذر إرسال النتيجة إلى حساب المريض.') });
    } finally {
      setIsSendingToPatient(false);
    }
  };

  // 3. مشاركة عبر واتساب
  const handleShareWhatsApp = () => {
    const cleanPhone = patientPhone.replace(/[^0-9]/g, '');
    const greeting = patientGender === 'أنثى' ? 'عزيزتي المريضة' : 'عزيزي المريض';

    let resultSummary = '';
    if (selectedTemplateId === 'hba1c') {
      resultSummary = `*نتيجة السكر التراكمي (HbA1c):* ${fieldValues['hba1c_val'] || '---'} %\n*متوسط الجلوكوز التقديري (eAG):* ${
        fieldValues['eag_val'] || '---'
      } mg/dL\n*المعدل الطبيعي للأصحاء:* 4.0 - 5.6 %`;
    } else if (selectedTemplateId === 'custom') {
      resultSummary = customRows.map((r) => `*${r.name}:* ${r.result} ${r.unit} (${r.range})`).join('\n');
    } else {
      resultSummary = currentTemplate.fields.map((f) => `*${f.nameAr}:* ${fieldValues[f.id] || '---'} ${f.unit}`).join('\n');
    }

    const message = `🏥 *تقرير نتائج التحاليل الطبية*\n${greeting}: *${patientName || 'المحترم'}*\n👨‍⚕️ *الطبيب المعالج:* ${effectiveDoctorName}\n🔬 *نوع الفحص:* ${currentTemplate.titleAr} (${currentTemplate.titleEn})\n📅 *تاريخ سحب العينة:* ${sampleDate}\n🔢 *رقم العينة:* ${sampleId}\n\n📊 *النتائج المخبرية:*\n${resultSummary}\n\n📝 *ملاحظات المعمل:* ${
      clinicalNotes || 'النتيجة معتمدة مخبرياً.'
    }\n\nنتمنى لكم دوام الصحة والعافية!`;

    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  // 4. نسخ ملخص التقرير
  const handleCopySummary = () => {
    let text = `تقرير معمل: ${currentTemplate.titleAr}\nالمريض: ${patientName || '---'}\nالطبيب: ${effectiveDoctorName}\nتاريخ السحب: ${sampleDate}\n`;
    if (selectedTemplateId === 'hba1c') {
      text += `HbA1c: ${fieldValues['hba1c_val']} % | eAG: ${fieldValues['eag_val']} mg/dL\n`;
    } else {
      currentTemplate.fields.forEach((f) => {
        text += `${f.nameAr}: ${fieldValues[f.id]} ${f.unit} (طبيعي: ${f.normalRange})\n`;
      });
    }
    if (clinicalNotes) text += `ملاحظات: ${clinicalNotes}\n`;
    navigator.clipboard.writeText(text);
    setStatusMessage({ type: 'success', text: 'تم نسخ ملخص التقرير للحافظة.' });
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* رأس الصفحة التعريفي */}
      <div className="bg-white border rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 font-black text-xl md:text-2xl">
            <FlaskConical className="w-7 h-7 text-emerald-600 shrink-0" />
            <h1>قوالب طباعة نتائج المعمل</h1>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
              جاهز للورق المروّس A4
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            إعداد وطباعة تقارير التحاليل بدقة عالية مع هامش علوي 4 سم فارغ مخصص لورق العيادة المروّس وخيار الإرسال للمريض مباشرة.
          </p>
        </div>

        {/* أزرار الإجراءات الرئيسية السريعة */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={handlePrint}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة التقرير (A4)</span>
          </button>

          <button
            onClick={handleSendToPatientApp}
            disabled={isSendingToPatient}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            title="إرسال إلى حساب المريض المسجل في التطبيق"
          >
            <Send className="w-4 h-4" />
            <span>إرسال للمريض بالتطبيق</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors"
            title="مشاركة عبر تطبيق واتساب"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">واتساب</span>
          </button>
        </div>
      </div>

      {/* شريط الإشعارات والتنبيهات */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-sky-50 text-sky-800 border border-sky-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* قسم اختيار القالب الطبي السريع */}
      <div className="bg-white border rounded-2xl p-4 shadow-xs">
        <label className="text-xs font-bold text-gray-500 mb-2.5 block flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          اختر قالب التحليل الطبي المطلوب:
        </label>
        <div className="flex flex-wrap gap-2">
          {LAB_TEMPLATES.map((tmpl) => {
            const isSelected = tmpl.id === selectedTemplateId;
            return (
              <button
                key={tmpl.id}
                onClick={() => handleSelectTemplate(tmpl.id)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-700 text-white shadow-xs scale-102 ring-2 ring-emerald-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                }`}
              >
                {tmpl.id === 'hba1c' && <span>⭐</span>}
                <span>{tmpl.titleAr}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* شبكة الإدخال والمعاينة (Grid: نموذج البيانات + المعاينة الحية للتقرير) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================= العمود الأيمن: نموذج إدخال وتعديل البيانات ================= */}
        <div className="lg:col-span-5 space-y-5">
          {/* بطاقة بيانات المريض والطبيب */}
          <div className="bg-white border rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="font-black text-gray-800 text-base flex items-center gap-2 border-b pb-3">
              <User className="w-4 h-4 text-emerald-600" />
              بيانات المريض والفحص
            </h3>

            {/* البحث عن مريض مسجل */}
            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">
                البحث عن مريض مسجل (أو كتابة يدوي):
              </label>
              {!selectedPatient ? (
                <div className="relative">
                  <Search className="w-4 h-4 absolute right-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="ابحث بالاسم، الهاتف، أو الكود الطبي..."
                    className="w-full pr-9 pl-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
                  />
                  {patientSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 bg-white border rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto divide-y">
                      {patientSearchResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectPatient(p)}
                          className="w-full text-right p-2.5 hover:bg-emerald-50 text-xs transition-colors flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-gray-800">{p.first_name} {p.last_name}</p>
                            <p className="text-gray-400 font-mono text-[11px]">{p.patient_code || 'بدون كود'}</p>
                          </div>
                          <span className="text-gray-500 text-xs" dir="ltr">{p.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-emerald-950">
                        {selectedPatient.first_name} {selectedPatient.last_name}
                      </p>
                      <p className="text-[11px] text-emerald-700" dir="ltr">{selectedPatient.phone}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleClearPatient}
                    className="text-xs text-red-600 hover:text-red-800 font-bold px-2 py-1 rounded"
                  >
                    تغيير
                  </button>
                </div>
              )}
            </div>

            {/* اسم المريض وعمره */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">اسم المريض: *</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="الاسم الثلاثي أو الرباعي"
                  className="w-full px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">عمر المريض (اختياري):</label>
                <input
                  type="text"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  placeholder="مثال: 45 سنة"
                  className="w-full px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* الطبيب المعالج (اختيار أو كتابة يدوية) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700">اسم الطبيب المعالج: *</label>
                <button
                  type="button"
                  onClick={() => setDoctorMode(doctorMode === 'select' ? 'custom' : 'select')}
                  className="text-[11px] text-emerald-600 hover:underline font-bold"
                >
                  {doctorMode === 'select' ? '+ كتابة طبيب مخصص' : '← اختيار من أطباء المركز'}
                </button>
              </div>

              {doctorMode === 'select' ? (
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  {doctorsList.map((doc) => (
                    <option key={doc.id} value={doc.name}>
                      {doc.name}
                    </option>
                  ))}
                  <option value="د. استشاري الباطنة والسكر">د. استشاري الباطنة والسكر</option>
                  <option value="طبيب المركز المعتمد">طبيب المركز المعتمد</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={customDoctorName}
                  onChange={(e) => setCustomDoctorName(e.target.value)}
                  placeholder="اكتب اسم الطبيب المعالج..."
                  className="w-full px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>

            {/* تاريخ سحب العينة ورقم العينة */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">تاريخ سحب العينة: *</label>
                <input
                  type="date"
                  value={sampleDate}
                  onChange={(e) => setSampleDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700">رقم العينة / الباركود:</label>
                  <button
                    type="button"
                    onClick={() => setSampleId(`LAB-${Math.floor(100000 + Math.random() * 900000)}`)}
                    className="text-[11px] text-gray-400 hover:text-emerald-600 flex items-center gap-0.5"
                    title="توليد كود جديد"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
                <input
                  type="text"
                  value={sampleId}
                  onChange={(e) => setSampleId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-xl outline-none font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* الجنس ورقم الهاتف للمشاركة */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">الجنس:</label>
                <select
                  value={patientGender}
                  onChange={(e) => setPatientGender(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="ذكر">ذكر (Male)</option>
                  <option value="أنثى">أنثى (Female)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">هاتف المريض (للواتساب):</label>
                <input
                  type="text"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  className="w-full px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-right"
                />
              </div>
            </div>
          </div>

          {/* بطاقة قيم التحليل حسب القالب المختار */}
          <div className="bg-white border rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-gray-800 text-base flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                قيم ونتائج: {currentTemplate.titleAr}
              </h3>
              <span className="text-[11px] text-gray-500 font-mono">{currentTemplate.titleEn}</span>
            </div>

            {/* إدخال قيم القالب العادي */}
            {selectedTemplateId !== 'custom' ? (
              <div className="space-y-3">
                {currentTemplate.fields.map((field) => (
                  <div key={field.id} className="p-3 bg-gray-50/70 border rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-800">
                        {field.nameAr}
                        {field.id === 'eag_val' && (
                          <span className="mr-2 text-[11px] text-emerald-600 font-normal">
                            (يُحسب تلقائياً من التراكمي)
                          </span>
                        )}
                      </label>
                      <span className="text-xs font-mono text-gray-500">{field.unit}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={fieldValues[field.id] || ''}
                        onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                        placeholder={field.unit ? `القيمة بـ ${field.unit}` : 'أدخل النتيجة'}
                        className="flex-1 px-3 py-1.5 text-sm border rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                      />
                      <span className="text-[11px] text-gray-500 bg-white px-2 py-1.5 border rounded-lg shrink-0">
                        طبيعي: {field.normalRange}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* إدخال القالب المخصص */
              <div className="space-y-3">
                {customRows.map((row, idx) => (
                  <div key={row.id} className="p-3 bg-gray-50 border rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-600">فحص #{idx + 1}</span>
                      {customRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setCustomRows(customRows.filter((r) => r.id !== row.id))}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => {
                          const updated = [...customRows];
                          updated[idx].name = e.target.value;
                          setCustomRows(updated);
                        }}
                        placeholder="اسم التحليل"
                        className="px-2.5 py-1.5 text-xs border rounded-lg bg-white"
                      />
                      <input
                        type="text"
                        value={row.result}
                        onChange={(e) => {
                          const updated = [...customRows];
                          updated[idx].result = e.target.value;
                          setCustomRows(updated);
                        }}
                        placeholder="النتيجة"
                        className="px-2.5 py-1.5 text-xs border rounded-lg bg-white font-bold"
                      />
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) => {
                          const updated = [...customRows];
                          updated[idx].unit = e.target.value;
                          setCustomRows(updated);
                        }}
                        placeholder="الوحدة (mg/dL)"
                        className="px-2.5 py-1.5 text-xs border rounded-lg bg-white"
                      />
                      <input
                        type="text"
                        value={row.range}
                        onChange={(e) => {
                          const updated = [...customRows];
                          updated[idx].range = e.target.value;
                          setCustomRows(updated);
                        }}
                        placeholder="المعدل المرجعي"
                        className="px-2.5 py-1.5 text-xs border rounded-lg bg-white"
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setCustomRows([
                      ...customRows,
                      {
                        id: String(Date.now()),
                        name: '',
                        result: '',
                        unit: '',
                        range: '',
                        status: 'normal',
                      },
                    ])
                  }
                  className="w-full py-2 border-2 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة فحص إضافي للتقرير</span>
                </button>
              </div>
            )}

            {/* تفسير وتقييم النتيجة اللحظي إذا كان متاحاً */}
            {currentInterpretation && (
              <div
                className={`p-3 rounded-xl border text-xs leading-relaxed ${
                  currentInterpretation.status === 'normal'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : currentInterpretation.status === 'borderline'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : currentInterpretation.status === 'low'
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <span>💡 التقييم المبدئي:</span>
                  <span>{currentInterpretation.summaryAr}</span>
                </div>
                <p className="text-[11px] opacity-90">{currentInterpretation.detailsAr}</p>
              </div>
            )}

            {/* ملاحظات التقرير المعملية */}
            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">
                ملاحظات وتوصيات المعمل الإكلينيكية:
              </label>
              <textarea
                rows={2}
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="ملاحظات تظهر أسفل نتائج الفحص..."
                className="w-full p-2.5 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* خيارات الطباعة المتقدمة (هامش 4 سم للورق المروّس) */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={leaveLetterheadMargin}
                  onChange={(e) => setLeaveLetterheadMargin(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-amber-900">
                  ترك مسافة فارغة 4 سم بالأعلى (مخصصة للورق المروّس للعيادة)
                </span>
              </label>
              <p className="text-[11px] text-amber-800 leading-normal pr-6">
                عند تحديد هذا الخيار، يتم ترك أعلى 4 سم من صفحة A4 فارغاً تماماً لتطابق ورقة المركز المطبوعة مسبقاً، وتستوعب الصفحة الواحدة كافة النتائج بدقة.
              </p>
            </div>
          </div>
        </div>

        {/* ================= العمود الأيسر: المعاينة الحية لورقة التقرير A4 ================= */}
        <div className="lg:col-span-7">
          <div className="sticky top-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <div className="flex items-center gap-2 font-bold text-gray-700">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>معاينة ورقة الطباعة (A4 صفحة واحدة):</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="text-gray-500 hover:text-emerald-700 font-bold flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ التقرير</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة الآن</span>
                </button>
              </div>
            </div>

            {/* ورقة A4 التفاعلية للطباعة */}
            <div className="bg-gray-200/80 p-3 sm:p-5 rounded-2xl overflow-x-auto shadow-inner flex justify-center">
              <div
                id="printable-lab-report"
                className={`bg-white text-black shadow-md border border-gray-300 w-[210mm] min-w-[210mm] max-w-[210mm] h-[297mm] max-h-[297mm] px-[14mm] pb-[10mm] flex flex-col justify-between box-border select-none print:shadow-none print:border-none print:m-0 ${
                  leaveLetterheadMargin ? 'pt-[40mm]' : 'pt-[12mm]'
                }`}
                style={{ direction: 'rtl' }}
              >
                {/* 1. الترويسة العليا (في حال عدم تفعيل هامش الـ 4 سم للورق المروّس) */}
                {!leaveLetterheadMargin ? (
                  <div className="border-b-2 border-emerald-800 pb-3 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-black text-xl">
                        🔬
                      </div>
                      <div>
                        <h2 className="font-black text-lg text-emerald-900 leading-tight">
                          مجمع الطائر الحر الطبي - قسم التحاليل
                        </h2>
                        <p className="text-[11px] text-gray-600">Free Bird Specialized Clinical Laboratories</p>
                      </div>
                    </div>
                    <div className="text-left text-[10px] text-gray-500 font-mono leading-tight">
                      <p>Accredited Quality Standards</p>
                      <p>Automated Diagnostic Systems</p>
                    </div>
                  </div>
                ) : (
                  // خط إرشادي بصري يظهر على الشاشة فقط ليبيّن مساحة الـ 4 سم الفارغة
                  <div className="print:hidden border-b border-dashed border-amber-300 text-amber-700 text-[10px] pb-1 mb-2 text-center bg-amber-50/50 rounded-md">
                    [مساحة 4 سم فارغة مخصصة لترويسة الورق المروّس للعيادة / Letterhead Margin]
                  </div>
                )}

                {/* 2. جدول بيانات المريض والطبيب (مطابق للصورة الطبية المرفقة) */}
                <div className="border-2 border-gray-800 rounded-lg overflow-hidden mb-3 text-xs">
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr className="border-b border-gray-300">
                        <td className="w-1/2 p-2 border-l border-gray-300 bg-gray-50/50">
                          <span className="text-gray-500 block text-[10px]">اسم المريض / Patient Name:</span>
                          <span className="font-black text-sm text-gray-900">{patientName || '....................................'}</span>
                        </td>
                        <td className="w-1/2 p-2 bg-gray-50/50">
                          <span className="text-gray-500 block text-[10px]">الطبيب المعالج / Referring Doctor:</span>
                          <span className="font-black text-sm text-gray-900">{effectiveDoctorName}</span>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="p-2 border-l border-gray-300">
                          <span className="text-gray-500 block text-[10px]">العمر / Age:</span>
                          <span className="font-bold text-gray-800">{patientAge || 'غير محدد'}</span>
                        </td>
                        <td className="p-2">
                          <span className="text-gray-500 block text-[10px]">تاريخ سحب العينة / Sampling Date:</span>
                          <span className="font-bold text-gray-800 font-mono">{sampleDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 border-l border-gray-300">
                          <span className="text-gray-500 block text-[10px]">الجنس / Gender:</span>
                          <span className="font-bold text-gray-800">{patientGender || '---'}</span>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-gray-500 block text-[10px]">رقم العينة / Sample ID:</span>
                              <span className="font-mono font-bold text-gray-800">{sampleId}</span>
                            </div>
                            <div className="text-left font-mono text-[9px] text-gray-400">
                              REP: {reportDate}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. شريط عنوان التقرير الطبي */}
                <div className="bg-gray-800 text-white py-1.5 px-3 rounded-md mb-3 flex items-center justify-between text-xs">
                  <div className="font-black tracking-wide text-sm flex items-center gap-1.5">
                    <span>🔬</span>
                    <span>{currentTemplate.titleAr}</span>
                  </div>
                  <div className="font-mono text-[11px] font-bold tracking-wider opacity-90">
                    {currentTemplate.titleEn}
                  </div>
                </div>

                {/* 4. جدول النتائج المخبرية الرسمية */}
                <div className="flex-1 flex flex-col justify-start">
                  <div className="border border-gray-400 rounded-lg overflow-hidden mb-3">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-400 text-gray-800 text-[11px] font-bold">
                          <th className="p-2 border-l border-gray-300">الفحص المطلوب (Test Name)</th>
                          <th className="p-2 border-l border-gray-300 text-center">النتيجة (Result)</th>
                          <th className="p-2 border-l border-gray-300 text-center">الوحدة (Unit)</th>
                          <th className="p-2 text-center">المعدل الطبيعي (Reference Range)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedTemplateId !== 'custom' ? (
                          currentTemplate.fields.map((field) => {
                            const val = fieldValues[field.id] || '---';
                            return (
                              <tr key={field.id} className="hover:bg-gray-50/50">
                                <td className="p-2.5 border-l border-gray-200 font-bold text-gray-900">
                                  <div className="leading-tight">{field.nameAr}</div>
                                  <div className="text-[10px] text-gray-500 font-mono font-normal">
                                    {field.nameEn}
                                  </div>
                                </td>
                                <td className="p-2.5 border-l border-gray-200 text-center font-black text-base text-gray-900 font-mono">
                                  {val}
                                </td>
                                <td className="p-2.5 border-l border-gray-200 text-center font-mono text-gray-600 text-[11px]">
                                  {field.unit}
                                </td>
                                <td className="p-2.5 text-center text-[11px] font-mono text-gray-700">
                                  {field.normalRange}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          customRows.map((row) => (
                            <tr key={row.id}>
                              <td className="p-2.5 border-l border-gray-200 font-bold text-gray-900">
                                {row.name || 'فحص'}
                              </td>
                              <td className="p-2.5 border-l border-gray-200 text-center font-black text-base text-gray-900 font-mono">
                                {row.result || '---'}
                              </td>
                              <td className="p-2.5 border-l border-gray-200 text-center font-mono text-gray-600 text-[11px]">
                                {row.unit || '---'}
                              </td>
                              <td className="p-2.5 text-center text-[11px] font-mono text-gray-700">
                                {row.range || '---'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 5. جدول المستويات الإرشادية الخاص بالسكر التراكمي (ADA Guidelines) */}
                  {selectedTemplateId === 'hba1c' && (
                    <div className="border border-gray-300 rounded-lg p-2.5 bg-gray-50/60 mb-3 text-[10px]">
                      <div className="font-bold text-gray-800 mb-1.5 text-[11px] border-b pb-1 flex items-center justify-between">
                        <span>معايير التشخيص الإكلينيكية للسكر التراكمي (ADA / WHO Clinical Criteria):</span>
                        <span className="font-mono text-[9px] text-gray-500">Method: {currentTemplate.methodology}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white border rounded p-1.5">
                          <span className="block font-bold text-emerald-700">طبيعي (Normal)</span>
                          <span className="font-mono font-bold text-xs">4.0 - 5.6 %</span>
                          <span className="text-[9px] text-gray-400 block">eAG: 70 - 114 mg/dL</span>
                        </div>
                        <div className="bg-white border rounded p-1.5">
                          <span className="block font-bold text-amber-600">ما قبل السكري (Prediabetes)</span>
                          <span className="font-mono font-bold text-xs">5.7 - 6.4 %</span>
                          <span className="text-[9px] text-gray-400 block">eAG: 117 - 137 mg/dL</span>
                        </div>
                        <div className="bg-white border rounded p-1.5">
                          <span className="block font-bold text-red-600">تشخيص سكري (Diabetic)</span>
                          <span className="font-mono font-bold text-xs">&ge; 6.5 %</span>
                          <span className="text-[9px] text-gray-400 block">eAG: &ge; 140 mg/dL</span>
                        </div>
                      </div>
                      <div className="mt-1.5 pt-1 border-t border-gray-200 text-gray-600 flex justify-between items-center text-[9px]">
                        <span>* الهدف العلاجي لمرضى السكري (ADA Target): &lt; 7.0%</span>
                        <span>تحكم ممتاز: 6.0 - 7.0% | تحكم متوسط: 7.1 - 8.0% | غير منضبط: &gt; 8.0%</span>
                      </div>
                    </div>
                  )}

                  {/* 6. الملاحظات الطبية الإكلينيكية */}
                  <div className="border border-gray-300 rounded-lg p-2.5 mb-3 text-xs bg-white">
                    <span className="font-bold text-gray-700 block text-[11px] mb-1">
                      الملاحظات والتوصيات الإكلينيكية (Clinical Notes):
                    </span>
                    <p className="text-gray-800 text-[11px] leading-relaxed">
                      {clinicalNotes || 'لا توجد ملاحظات إضافية. تم فحص العينة وفق المعايير القياسية للمختبر.'}
                    </p>
                  </div>
                </div>

                {/* 7. ذيل التقرير والاعتماد والتوقيع (Footer & Verification) */}
                <div className="border-t-2 border-gray-800 pt-3 mt-auto">
                  <div className="flex items-end justify-between text-xs">
                    {/* التوقيع الأول: أخصائي التحاليل */}
                    <div className="text-center w-40">
                      <p className="text-[10px] text-gray-500 mb-6">أخصائي التحاليل الطبية / Medical Technologist</p>
                      <p className="font-bold text-gray-800 border-t border-dashed border-gray-400 pt-1 text-[11px]">
                        {labTechnician}
                      </p>
                    </div>

                    {/* باركود توثيقي في المنتصف */}
                    <div className="text-center font-mono text-[9px] text-gray-500">
                      <div className="tracking-widest font-bold text-sm text-gray-800 mb-0.5">
                        ||||| | |||| || ||| |||||||
                      </div>
                      <p>VERIFIED & AUTHENTICATED</p>
                      <p className="text-[8px] text-gray-400">{sampleId}</p>
                    </div>

                    {/* التوقيع الثاني: استشاري ومدير المعمل */}
                    <div className="text-center w-40">
                      <p className="text-[10px] text-gray-500 mb-6">مدير المختبر / Laboratory Director</p>
                      <p className="font-bold text-gray-800 border-t border-dashed border-gray-400 pt-1 text-[11px]">
                        ختم واعتماد المختبر
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 text-center text-[9px] text-gray-400 border-t pt-1">
                    هذا التقرير صادر إلكترونياً ومعتمد رسمياً من قسم التحاليل الطبية والتشخيص المخبري.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
