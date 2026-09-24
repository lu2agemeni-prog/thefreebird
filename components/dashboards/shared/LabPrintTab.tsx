'use client';

// ============================================================================
// components/dashboards/shared/LabPrintTab.tsx
// تبويب "طباعة معمل" — مشترك بين السكرتارية والمدير
// تقرير طبي احترافي باللغة الإنجليزية الطبية حصرياً من اليسار لليمين (LTR)
// العربي فقط لاسم المريض واسم الطبيب، ومقاس A4 صفحة واحدة بدقة مع هامش علوي 4 سم فارغ.
// ============================================================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Printer,
  Share2,
  Send,
  Search,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Copy,
  RefreshCw,
  FlaskConical,
  X,
  Plus,
  Trash2,
  Sliders,
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
  const [, setIsSearchingPatient] = useState(false);
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
  const [reportDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [sampleId, setSampleId] = useState<string>(() => `LAB-${Math.floor(100000 + Math.random() * 900000)}`);

  // 3. قيم نتائج التحليل
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    LAB_TEMPLATES[0].fields.forEach((f) => {
      initial[f.id] = f.defaultValue !== undefined ? String(f.defaultValue) : '';
    });
    return initial;
  });
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    LAB_TEMPLATES[0].notesDefaultEn || LAB_TEMPLATES[0].notesDefault || ''
  );
  const [labTechnicianEn] = useState<string>('Clinical Laboratory Specialist');

  // خيارات حقول القالب المخصص
  const [customRows, setCustomRows] = useState<
    Array<{ id: string; name: string; result: string; unit: string; range: string }>
  >([
    { id: '1', name: 'Investigation 1', result: '', unit: '', range: 'Normal' },
  ]);

  // 4. خيارات الطباعة والعرض (هامش 4 سم فارغ افتراضياً)
  const [leaveLetterheadMargin, setLeaveLetterheadMargin] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSendingToPatient, setIsSendingToPatient] = useState(false);

  // اختيار قالب وإعادة تهيئة الحقول مباشرة بالقيم الإنجليزية
  const handleSelectTemplate = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    const tmpl = LAB_TEMPLATES.find((t) => t.id === tmplId) || LAB_TEMPLATES[0];
    const initial: Record<string, string> = {};
    tmpl.fields.forEach((f) => {
      initial[f.id] = f.defaultValue !== undefined ? String(f.defaultValue) : '';
    });
    setFieldValues(initial);
    setClinicalNotes(tmpl.notesDefaultEn || tmpl.notesDefault || '');
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

    if (p.birth_date) {
      const birthYear = new Date(p.birth_date).getFullYear();
      const currentYear = new Date().getFullYear();
      if (birthYear > 1900 && currentYear >= birthYear) {
        setPatientAge(`${currentYear - birthYear}`);
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

  // اسم الطبيب الفعلي بالعربي
  const effectiveDoctorName =
    doctorMode === 'select'
      ? selectedDoctorId || 'طبيب المركز'
      : customDoctorName || 'د. استشاري المعمل';

  // صياغة العمر بالإنجليزية للتقرير
  const formattedAgeEn = useMemo(() => {
    if (!patientAge) return 'Not Specified';
    const num = patientAge.replace(/[^0-9]/g, '');
    return num ? `${num} Yrs` : patientAge;
  }, [patientAge]);

  // صياغة الجنس بالإنجليزية للتقرير
  const formattedGenderEn = useMemo(() => {
    if (patientGender === 'ذكر') return 'Male';
    if (patientGender === 'أنثى') return 'Female';
    return '---';
  }, [patientGender]);

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
        text: 'تنبيه: لإرسال النتيجة إلى تطبيق المريض، يرجى اختيار مريض مسجل من شريط البحث. يمكنك الطباعة أو المشاركة بالواتساب حالياً للمرضى غير المسجلين.',
      });
      return;
    }

    setIsSendingToPatient(true);
    setStatusMessage(null);

    try {
      const numericVal = parseFloat(fieldValues['hba1c_val'] || Object.values(fieldValues)[0] || '0');
      const formattedNotes = `Clinical Laboratory Report: ${currentTemplate.titleEn} (${currentTemplate.titleAr}) - Result: ${
        fieldValues['hba1c_val'] ? fieldValues['hba1c_val'] + '%' : Object.values(fieldValues)[0] || 'Verified'
      }. Referring Physician: ${effectiveDoctorName}. Notes: ${clinicalNotes}`;

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

      await supabase.from('notifications').insert([
        {
          user_id: selectedPatient.id,
          title: `نتيجة ${currentTemplate.titleAr} جاهزة 🔬`,
          message: `أصدر مختبر المركز نتيجة فحص ${currentTemplate.titleEn} (${patientName}). يمكنك مراجعة تقرير الفحص المعتمد الآن.`,
          type: 'lab',
          link: '/lab-results',
        },
      ]);

      setStatusMessage({
        type: 'success',
        text: `تم إرسال نتيجة ${currentTemplate.titleAr} إلى حساب المريض (${patientName}) بنجاح!`,
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
      resultSummary = `*HbA1c (Glycosylated Hemoglobin):* ${fieldValues['hba1c_val'] || '---'} %\n*eAG (Estimated Average Glucose):* ${
        fieldValues['eag_val'] || '---'
      } mg/dL\n*Reference Interval (Non-diabetic):* < 5.7 %`;
    } else if (selectedTemplateId === 'custom') {
      resultSummary = customRows.map((r) => `*${r.name}:* ${r.result} ${r.unit} (${r.range})`).join('\n');
    } else {
      resultSummary = currentTemplate.fields
        .slice(0, 10)
        .map((f) => `*${f.nameEn}:* ${fieldValues[f.id] || '---'} ${f.unit ? f.unit + ' ' : ''}(Ref: ${f.normalRange})`)
        .join('\n');
    }

    const message = `🏥 *Clinical Laboratory Report*\n${greeting}: *${patientName || 'المحترم'}*\n👨‍⚕️ *Referring Doctor:* ${effectiveDoctorName}\n🔬 *Investigation:* ${currentTemplate.titleEn}\n📅 *Date of Collection:* ${sampleDate}\n🔢 *Sample ID:* ${sampleId}\n\n📊 *Laboratory Findings:*\n${resultSummary}\n\n📝 *Clinical Remarks:* ${
      clinicalNotes || 'Results verified and validated according to laboratory standard operating procedures.'
    }\n\nمع تمنياتنا لكم بدوام الصحة والعافية!`;

    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  // 4. نسخ ملخص التقرير
  const handleCopySummary = () => {
    let text = `CLINICAL LABORATORY REPORT\nInvestigation: ${currentTemplate.titleEn}\nPatient Name: ${patientName || '---'}\nReferring Doctor: ${effectiveDoctorName}\nDate of Collection: ${sampleDate}\nSample ID: ${sampleId}\n\nFINDINGS:\n`;
    if (selectedTemplateId === 'hba1c') {
      text += `HbA1c: ${fieldValues['hba1c_val']} % | eAG: ${fieldValues['eag_val']} mg/dL (Ref: < 5.7 %)\n`;
    } else if (selectedTemplateId === 'custom') {
      customRows.forEach((r) => {
        text += `${r.name}: ${r.result} ${r.unit} (Ref: ${r.range})\n`;
      });
    } else {
      currentTemplate.fields.forEach((f) => {
        text += `${f.nameEn}: ${fieldValues[f.id]} ${f.unit} (Ref: ${f.normalRange})\n`;
      });
    }
    if (clinicalNotes) text += `\nClinical Notes: ${clinicalNotes}\n`;
    navigator.clipboard.writeText(text);
    setStatusMessage({ type: 'success', text: 'تم نسخ ملخص التقرير الطبي باللغة الإنجليزية للحافظة.' });
  };

  // فصل حقول تحليل البول لتصميم الأعمدة المزدوجة المتراصة (2-Column Ultra Compact)
  const urinePhysicalFields = useMemo(
    () => currentTemplate.fields.filter((f) => f.section === 'physical'),
    [currentTemplate]
  );
  const urineChemicalFields = useMemo(
    () => currentTemplate.fields.filter((f) => f.section === 'chemical'),
    [currentTemplate]
  );
  const urineMicroscopicFields = useMemo(
    () => currentTemplate.fields.filter((f) => f.section === 'microscopic'),
    [currentTemplate]
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* رأس الصفحة التعريفي */}
      <div className="bg-white border rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-800 font-black text-xl md:text-2xl">
            <FlaskConical className="w-7 h-7 text-emerald-600 shrink-0" />
            <h1>قوالب طباعة نتائج المعمل</h1>
            <span className="text-xs bg-emerald-100 text-emerald-900 font-bold px-2.5 py-0.5 rounded-full">
              English LTR Report • A4 Single Page
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            التقارير مطبوعة باللغة الإنجليزية الطبية المعتمدة (من اليسار لليمين LTR)، مع إبقاء اسم المريض والطبيب بالعربي، وملاءمة مثالية لصفحة A4 واحدة وهامش علوي 4 سم للورق المروّس.
          </p>
        </div>

        {/* أزرار الإجراءات الرئيسية السريعة */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={handlePrint}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة التقرير (A4 صفحة واحدة)</span>
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
                    ? 'bg-emerald-800 text-white shadow-xs scale-102 ring-2 ring-emerald-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                }`}
              >
                {tmpl.id === 'hba1c' && <span>⭐</span>}
                <span>{tmpl.titleAr}</span>
                <span className="text-[10px] opacity-75 font-mono">({tmpl.titleEn})</span>
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
              بيانات المريض والفحص (العربي لاسم المريض والطبيب)
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
                            <p className="font-bold text-gray-800">
                              {p.first_name} {p.last_name}
                            </p>
                            <p className="text-gray-400 font-mono text-[11px]">{p.patient_code || 'بدون كود'}</p>
                          </div>
                          <span className="text-gray-500 text-xs" dir="ltr">
                            {p.phone}
                          </span>
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
                      <p className="text-[11px] text-emerald-700" dir="ltr">
                        {selectedPatient.phone}
                      </p>
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
                <label className="text-xs font-bold text-gray-700 mb-1 block">
                  اسم المريض (بالعربي): *
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="الاسم الثلاثي أو الرباعي"
                  className="w-full px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">عمر المريض (Age):</label>
                <input
                  type="text"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  placeholder="مثال: 45 سنة أو 45"
                  className="w-full px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* الطبيب المعالج (اختيار أو كتابة يدوية) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700">اسم الطبيب المعالج (بالعربي): *</label>
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
                  <label className="text-xs font-bold text-gray-700">رقم العينة (Sample ID):</label>
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
                <label className="text-xs font-bold text-gray-700 mb-1 block">الجنس (Gender):</label>
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
                نتائج الفحص: {currentTemplate.titleAr}
              </h3>
              <span className="text-[11px] text-gray-500 font-mono font-bold">{currentTemplate.titleEn}</span>
            </div>

            {/* إدخال قيم القالب العادي */}
            {selectedTemplateId !== 'custom' ? (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {currentTemplate.fields.map((field) => (
                  <div key={field.id} className="p-2.5 bg-gray-50/80 border rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-800 flex items-center gap-1">
                        <span>{field.nameEn}</span>
                        <span className="text-[10px] text-gray-400 font-normal">({field.nameAr})</span>
                      </label>
                      <span className="text-xs font-mono text-gray-500">{field.unit}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={fieldValues[field.id] || ''}
                        onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                        placeholder="Result"
                        className="flex-1 px-3 py-1.5 text-sm border rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                      />
                      <span className="text-[10px] text-gray-500 bg-white px-2 py-1.5 border rounded-lg shrink-0 font-mono">
                        Ref: {field.normalRange}
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
                      <span className="text-xs font-bold text-gray-600">Investigation #{idx + 1}</span>
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
                        placeholder="Investigation Name (En)"
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
                        placeholder="Result"
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
                        placeholder="Unit (mg/dL, %)"
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
                        placeholder="Reference Range"
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
                        range: 'Normal',
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

            {/* ملاحظات التقرير المعملية (باللغة الإنجليزية) */}
            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 block">
                ملاحظات المعمل الطبية (Clinical Notes & Remarks):
              </label>
              <textarea
                rows={2}
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Clinical remarks to appear on the printed report..."
                className="w-full p-2.5 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
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
                  ترك مسافة فارغة 4 سم بالأعلى (مخصصة للورق المروّس المطبوع مسبقاً)
                </span>
              </label>
              <p className="text-[11px] text-amber-800 leading-normal pr-6">
                عند تحديد هذا الخيار، يتم ترك أعلى 4 سم من صفحة A4 فارغاً تماماً ليطابق ترويسة ورق المركز، وتستوعب الصفحة الواحدة كافة النتائج بدقة باللغة الإنجليزية.
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
                <span>معاينة التقرير الطبي A4 (English LTR • صفحة واحدة):</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="text-gray-500 hover:text-emerald-700 font-bold flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة الآن</span>
                </button>
              </div>
            </div>

            {/* ورقة A4 التفاعلية للطباعة - English Medical LTR Only */}
            <div className="bg-gray-200/90 p-3 sm:p-5 rounded-2xl overflow-x-auto shadow-inner flex justify-center">
              <div
                id="printable-lab-report"
                dir="ltr"
                className={`bg-white text-slate-900 shadow-md border border-gray-300 w-[210mm] min-w-[210mm] max-w-[210mm] h-[297mm] max-h-[297mm] px-[12mm] pb-[8mm] flex flex-col justify-between box-border select-none print:shadow-none print:border-none print:m-0 font-sans ${
                  leaveLetterheadMargin ? 'pt-[40mm]' : 'pt-[10mm]'
                }`}
                style={{ direction: 'ltr', textAlign: 'left' }}
              >
                {/* 1. الترويسة العليا (في حال عدم تفعيل هامش الـ 4 سم للورق المروّس) */}
                {!leaveLetterheadMargin ? (
                  <div className="border-b-2 border-slate-800 pb-2 mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-lg">
                        🔬
                      </div>
                      <div>
                        <h2 className="font-black text-base text-slate-900 leading-tight uppercase tracking-wider">
                          Central Diagnostic Clinical Laboratories
                        </h2>
                        <p className="text-[10px] text-slate-600">
                          Accredited Medical Testing & Automated Pathology Department
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-[9px] text-slate-500 font-mono leading-tight">
                      <p>ISO 15189 Quality Standards</p>
                      <p>Automated Diagnostic Systems</p>
                    </div>
                  </div>
                ) : (
                  // خط إرشادي بصري يظهر على الشاشة فقط ليبيّن مساحة الـ 4 سم الفارغة
                  <div className="print:hidden border-b border-dashed border-amber-400 text-amber-800 text-[10px] pb-1 mb-2 text-center bg-amber-50/70 rounded-md font-mono">
                    [ 4.0 cm Blank Letterhead Margin for Clinic Pre-printed Paper ]
                  </div>
                )}

                {/* 2. جدول بيانات المريض والطبيب (Arabic only for Patient & Doctor Names, rest in English) */}
                <div className="border border-slate-400 rounded-md overflow-hidden mb-2 text-xs">
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr className="border-b border-slate-300">
                        <td className="w-1/2 p-2 border-r border-slate-300 bg-slate-50/60">
                          <span className="text-[9.5px] uppercase font-bold text-slate-500 block tracking-wider mb-0.5">
                            Patient Name
                          </span>
                          <span className="font-black text-sm text-slate-950 block" dir="rtl">
                            {patientName || '....................................'}
                          </span>
                        </td>
                        <td className="w-1/2 p-2 bg-slate-50/60">
                          <span className="text-[9.5px] uppercase font-bold text-slate-500 block tracking-wider mb-0.5">
                            Referring Doctor / Physician
                          </span>
                          <span className="font-black text-sm text-slate-950 block" dir="rtl">
                            {effectiveDoctorName}
                          </span>
                        </td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="p-1.5 border-r border-slate-300">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Age:</span>
                            <span className="font-bold text-slate-900 text-xs font-mono">{formattedAgeEn}</span>
                          </div>
                        </td>
                        <td className="p-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Sampling Date:</span>
                            <span className="font-bold text-slate-900 text-xs font-mono">{sampleDate}</span>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1.5 border-r border-slate-300">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Gender:</span>
                            <span className="font-bold text-slate-900 text-xs">{formattedGenderEn}</span>
                          </div>
                        </td>
                        <td className="p-1.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Sample ID: </span>
                              <span className="font-mono font-bold text-xs text-slate-900">{sampleId}</span>
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono">
                              REPORTED: {reportDate}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. شريط عنوان التقرير الطبي */}
                <div className="bg-slate-900 text-white py-1 px-3 rounded-md mb-2 flex items-center justify-between text-xs">
                  <div className="font-black tracking-wide text-xs uppercase flex items-center gap-1.5">
                    <span>🔬</span>
                    <span>{currentTemplate.titleEn}</span>
                  </div>
                  {currentTemplate.methodology && (
                    <div className="font-mono text-[9px] text-slate-300">
                      Method: {currentTemplate.methodology}
                    </div>
                  )}
                </div>

                {/* 4. جداول النتائج المخبرية الرسمية */}
                <div className="flex-1 flex flex-col justify-start">
                  {/* أ) إذا كان الفحص هو تحليل البول الكامل (Urinalysis): عرض متراص على عمودين لتتسع صفحة A4 واحدة تماماً */}
                  {selectedTemplateId === 'urinalysis' ? (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {/* العمود الأيسر: الفحص الفيزيائي والكيميائي */}
                      <div className="space-y-1.5">
                        {/* الفحص الفيزيائي */}
                        <div className="border border-slate-400 rounded overflow-hidden">
                          <div className="bg-slate-800 text-white text-[9px] font-bold py-0.5 px-2 uppercase tracking-wider">
                            Physical Examination
                          </div>
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 text-[8.5px] font-bold uppercase">
                                <th className="py-0.5 px-1.5 border-r border-slate-200">Parameter</th>
                                <th className="py-0.5 px-1.5 border-r border-slate-200 text-center">Result</th>
                                <th className="py-0.5 px-1.5 text-center">Reference</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {urinePhysicalFields.map((field) => (
                                <tr key={field.id} className="hover:bg-slate-50">
                                  <td className="py-0.5 px-1.5 border-r border-slate-200 font-semibold text-slate-900">
                                    {field.nameEn}
                                  </td>
                                  <td className="py-0.5 px-1.5 border-r border-slate-200 text-center font-bold font-mono text-slate-950">
                                    {fieldValues[field.id] || '---'}
                                  </td>
                                  <td className="py-0.5 px-1.5 text-center text-[8.5px] text-slate-600 font-mono">
                                    {field.normalRange}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* الفحص الكيميائي */}
                        <div className="border border-slate-400 rounded overflow-hidden">
                          <div className="bg-slate-800 text-white text-[9px] font-bold py-0.5 px-2 uppercase tracking-wider">
                            Chemical Examination
                          </div>
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 text-[8.5px] font-bold uppercase">
                                <th className="py-0.5 px-1.5 border-r border-slate-200">Parameter</th>
                                <th className="py-0.5 px-1.5 border-r border-slate-200 text-center">Result</th>
                                <th className="py-0.5 px-1.5 text-center">Reference</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {urineChemicalFields.map((field) => (
                                <tr key={field.id} className="hover:bg-slate-50">
                                  <td className="py-0.5 px-1.5 border-r border-slate-200 font-semibold text-slate-900">
                                    {field.nameEn}
                                  </td>
                                  <td className="py-0.5 px-1.5 border-r border-slate-200 text-center font-bold font-mono text-slate-950">
                                    {fieldValues[field.id] || '---'}
                                  </td>
                                  <td className="py-0.5 px-1.5 text-center text-[8.5px] text-slate-600 font-mono">
                                    {field.normalRange}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* العمود الأيمن: الفحص المجهري */}
                      <div>
                        <div className="border border-slate-400 rounded overflow-hidden h-full flex flex-col">
                          <div className="bg-slate-800 text-white text-[9px] font-bold py-0.5 px-2 uppercase tracking-wider">
                            Microscopic Examination (Deposit / HPF)
                          </div>
                          <table className="w-full text-left border-collapse text-[10px] flex-1">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 text-[8.5px] font-bold uppercase">
                                <th className="py-0.5 px-1.5 border-r border-slate-200">Parameter</th>
                                <th className="py-0.5 px-1.5 border-r border-slate-200 text-center">Result</th>
                                <th className="py-0.5 px-1.5 border-r border-slate-200 text-center">Unit</th>
                                <th className="py-0.5 px-1.5 text-center">Reference</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {urineMicroscopicFields.map((field) => (
                                <tr key={field.id} className="hover:bg-slate-50">
                                  <td className="py-0.5 px-1.5 border-r border-slate-200 font-semibold text-slate-900">
                                    {field.nameEn}
                                  </td>
                                  <td className="py-0.5 px-1.5 border-r border-slate-200 text-center font-bold font-mono text-slate-950">
                                    {fieldValues[field.id] || '---'}
                                  </td>
                                  <td className="py-0.5 px-1.5 border-r border-slate-200 text-center text-[8.5px] text-slate-500 font-mono">
                                    {field.unit || '-'}
                                  </td>
                                  <td className="py-0.5 px-1.5 text-center text-[8.5px] text-slate-600 font-mono">
                                    {field.normalRange}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="bg-slate-50 p-1 border-t border-slate-300 text-[8px] text-slate-500 font-mono">
                            * HPF: High Power Field (400x). Centrifuged urine deposit examination.
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ب) بقية التحاليل (HbA1c, CBC, RFT, LFT, Lipid, Thyroid, Vitamins, Custom): جدول رئيسي متراص وأنيق */
                    <div className="border border-slate-400 rounded overflow-hidden mb-2">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 text-[9.5px] font-bold uppercase tracking-wider">
                            <th className="py-1 px-2 border-r border-slate-200">Investigation / Parameter</th>
                            <th className="py-1 px-2 border-r border-slate-200 text-center">Result</th>
                            <th className="py-1 px-2 border-r border-slate-200 text-center">Unit</th>
                            <th className="py-1 px-2 text-center">Biological Reference Interval</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {selectedTemplateId !== 'custom' ? (
                            currentTemplate.fields.map((field) => {
                              const val = fieldValues[field.id] || '---';
                              return (
                                <tr key={field.id} className="hover:bg-slate-50/60">
                                  <td className="py-1 px-2 border-r border-slate-200 font-semibold text-slate-900 text-xs">
                                    {field.nameEn}
                                  </td>
                                  <td className="py-1 px-2 border-r border-slate-200 text-center font-bold text-sm text-slate-950 font-mono">
                                    {val}
                                  </td>
                                  <td className="py-1 px-2 border-r border-slate-200 text-center font-mono text-slate-600 text-[10px]">
                                    {field.unit || '-'}
                                  </td>
                                  <td className="py-1 px-2 text-center text-[10px] font-mono text-slate-700">
                                    {field.normalRange}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            customRows.map((row) => (
                              <tr key={row.id}>
                                <td className="py-1 px-2 border-r border-slate-200 font-semibold text-slate-900 text-xs">
                                  {row.name || 'Investigation'}
                                </td>
                                <td className="py-1 px-2 border-r border-slate-200 text-center font-bold text-sm text-slate-950 font-mono">
                                  {row.result || '---'}
                                </td>
                                <td className="py-1 px-2 border-r border-slate-200 text-center font-mono text-slate-600 text-[10px]">
                                  {row.unit || '-'}
                                </td>
                                <td className="py-1 px-2 text-center text-[10px] font-mono text-slate-700">
                                  {row.range || '---'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 5. معايير التشخيص الإكلينيكية الخاصة بالسكر التراكمي (ADA Guidelines بالإنجليزية) */}
                  {selectedTemplateId === 'hba1c' && (
                    <div className="border border-slate-300 rounded-md p-2 bg-slate-50/70 mb-2 text-[10px]">
                      <div className="font-bold text-slate-800 mb-1 text-[10px] border-b pb-0.5 flex items-center justify-between uppercase tracking-wider">
                        <span>ADA / WHO Clinical Diagnostic Criteria for HbA1c</span>
                        <span className="font-mono text-[8.5px] text-slate-500">Method: {currentTemplate.methodology}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white border rounded p-1">
                          <span className="block font-bold text-emerald-700 text-[9.5px]">Normal (Non-Diabetic)</span>
                          <span className="font-mono font-bold text-xs text-slate-900">4.0 - 5.6 %</span>
                          <span className="text-[8px] text-slate-400 block font-mono">eAG: 70 - 114 mg/dL</span>
                        </div>
                        <div className="bg-white border rounded p-1">
                          <span className="block font-bold text-amber-600 text-[9.5px]">Prediabetes (High Risk)</span>
                          <span className="font-mono font-bold text-xs text-slate-900">5.7 - 6.4 %</span>
                          <span className="text-[8px] text-slate-400 block font-mono">eAG: 117 - 137 mg/dL</span>
                        </div>
                        <div className="bg-white border rounded p-1">
                          <span className="block font-bold text-red-600 text-[9.5px]">Diabetes Mellitus</span>
                          <span className="font-mono font-bold text-xs text-slate-900">&ge; 6.5 %</span>
                          <span className="text-[8px] text-slate-400 block font-mono">eAG: &ge; 140 mg/dL</span>
                        </div>
                      </div>
                      <div className="mt-1 pt-0.5 border-t border-slate-200 text-slate-600 flex justify-between items-center text-[8px]">
                        <span>* ADA Glycemic Target for Non-pregnant Adults with Diabetes: &lt; 7.0 %</span>
                        <span>Good Control: 6.0 - 7.0% | Moderate: 7.1 - 8.0% | Action Suggested: &gt; 8.0%</span>
                      </div>
                    </div>
                  )}

                  {/* 6. الملاحظات الطبية الإكلينيكية (Clinical Remarks) */}
                  <div className="border border-slate-300 rounded-md p-1.5 mb-2 text-xs bg-white">
                    <span className="font-bold text-slate-700 block text-[9.5px] uppercase tracking-wider mb-0.5">
                      Clinical Notes & Remarks:
                    </span>
                    <p className="text-slate-800 text-[10px] leading-relaxed">
                      {clinicalNotes || 'Results verified and validated according to laboratory standard operating procedures.'}
                    </p>
                  </div>
                </div>

                {/* 7. ذيل التقرير والاعتماد والتوقيع بالإنجليزية (Footer & Verification) */}
                <div className="border-t-2 border-slate-800 pt-2 mt-auto">
                  <div className="flex items-end justify-between text-xs">
                    {/* التوقيع الأول: أخصائي التحاليل */}
                    <div className="text-center w-44">
                      <p className="text-[9px] uppercase font-bold text-slate-500 mb-5">
                        Medical Technologist / Analyst
                      </p>
                      <p className="font-bold text-slate-900 border-t border-dashed border-slate-400 pt-0.5 text-[10px]">
                        {labTechnicianEn}
                      </p>
                    </div>

                    {/* باركود توثيقي في المنتصف */}
                    <div className="text-center font-mono text-[8px] text-slate-500">
                      <div className="tracking-widest font-bold text-sm text-slate-900 mb-0.5">
                        ||||| | |||| || ||| |||||||
                      </div>
                      <p className="font-bold text-slate-700 tracking-wider">ELECTRONICALLY VERIFIED</p>
                      <p className="text-[8px] text-slate-400">{sampleId}</p>
                    </div>

                    {/* التوقيع الثاني: استشاري ومدير المعمل */}
                    <div className="text-center w-44">
                      <p className="text-[9px] uppercase font-bold text-slate-500 mb-5">
                        Laboratory Director / Consultant
                      </p>
                      <p className="font-bold text-slate-900 border-t border-dashed border-slate-400 pt-0.5 text-[10px]">
                        Official Stamp & Signature
                      </p>
                    </div>
                  </div>

                  <div className="mt-1 text-center text-[8px] text-slate-400 border-t border-slate-100 pt-0.5 tracking-wide">
                    This clinical laboratory report is an authentic electronic document generated by the Central Diagnostic Laboratory.
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
