'use client';

// ============================================================================
// components/dashboards/secretary/AddVisitModal.tsx
// المودال الموحد للسكرتارية: يستبدل AddWalkInPatientModal + AddPatientModal +
// AddExistingPatientModal + AddPastVisitModal في نموذج واحد.
//
// الفلسفة:
// - زر واحد فقط في السكرتارية: «إضافة زيارة» (من تبويب دليل المرضى).
// - المستخدم بيكتب أو بيدوّر على المريض → لو مش موجود، ينشئه على طول
//   (مريض زيارة مباشرة - walk_in_patient).
// - بيختار التاريخ (اليوم افتراضيًا، أو تاريخ سابق).
// - لو التاريخ = النهارده، الزيارة بتتحفظ في:
//     • patient_visits (سجل الزيارات → التقارير المالية)
//     • call_queue (طابور النداء الآلي → رقم دور، توكن، شاشة العرض)
//   ولو التاريخ = تاريخ سابق، بتتحفظ في patient_visits بس (تظهر في التقارير
//   المالية بتاريخها الحقيقي ومبتظهرش في النداء).
// - بيسمح بأكتر من خدمة في نفس الزيارة (visit_group_id) عشان المريض اللي
//   بيعمل كشف + تحاليل + أشعة مرة واحدة يتسجل كله في سطر واحد.
// - بيدعم وضعَي تعديل (editVisit) وإضافة خدمة لنفس الزيارة (addServiceTo)
//   المُستخدمين في شاشة سجل الزيارات.
// ============================================================================

import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Loader2, CheckCircle2, Search, UserPlus, Trash2, PlusCircle, Calendar, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';

interface FoundPatient {
  id: string;
  name: string;
  phone: string | null;
  source: 'registered' | 'walk_in';
}

interface ServiceLine {
  id: string; // local key للـ UI
  serviceId: string; // '' لو مخصص أو فاضي
  customName: string;
  price: string;
  saveToCatalog: boolean;
}

function todayStr() {
  // YYYY-MM-DD بتوقيت المحلي-السيرفر. كفاية لاغراض الزيارات.
  return new Date().toISOString().slice(0, 10);
}

function newServiceLine(prefill?: Partial<ServiceLine>): ServiceLine {
  return {
    id: crypto.randomUUID(),
    serviceId: '',
    customName: '',
    price: '',
    saveToCatalog: false,
    ...prefill,
  };
}

interface AddVisitModalProps {
  onClose: () => void;
  /** لتحديث البيانات في الشاشة اللي فتحتنا منها */
  onAdded?: (info?: { tokenNumber?: number; clinicId?: string }) => void;
  /** تعديل صف موجود بدل إنشاء صف جديد */
  editVisit?: any;
  /** إضافة خدمة جديدة لنفس جلسة زيارة موجودة (نفس visit_group_id) */
  addServiceTo?: {
    visitGroupId: string;
    patient: FoundPatient;
    visitDate: string;
    clinicId: string | null;
    doctorId: string | null;
  };
}

export function AddVisitModal({ onClose, onAdded, editVisit, addServiceTo }: AddVisitModalProps) {
  const { user } = useAuth();
  const isEditing = !!editVisit;
  const isAddingService = !!addServiceTo;
  const isAddServiceOnly = isAddingService;

  // ─── بيانات المرضى والعيادات والخدمات اللي بنجيبها من السيرفر ───
  const [clinics, setClinics] = useState<any[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // ─── المريض: بحث / اختيار / إنشاء جديد ───
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FoundPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<FoundPatient | null>(
    addServiceTo
      ? addServiceTo.patient
      : editVisit
      ? { id: editVisit.patient_id || editVisit.walk_in_patient_id, name: editVisit.patient_name, phone: null, source: editVisit.patient_id ? 'registered' : 'walk_in' }
      : null
  );
  // ─── إنشاء مريض جديد داخل المودال ───
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // ─── بيانات الزيارة ───
  const [visitDate, setVisitDate] = useState(editVisit?.visit_date || addServiceTo?.visitDate || todayStr());
  const [clinicId, setClinicId] = useState(editVisit?.clinic_id || addServiceTo?.clinicId || '');
  const [doctorId, setDoctorId] = useState(editVisit?.doctor_id || addServiceTo?.doctorId || '');
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>(
    editVisit
      ? [newServiceLine({
          serviceId: editVisit.service_id || '',
          customName: editVisit.service_id ? '' : (editVisit.service_name || ''),
          price: String(editVisit.paid_amount ?? ''),
        })]
      : addServiceTo
      ? [newServiceLine()]
      : [newServiceLine()]
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── جلب الخيارات ───
  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      setLoadingOptions(true);
      const [clinicsRes, servicesRes, doctorsRes] = await Promise.all([
        supabase.from('clinics').select('id, name, audio_number').eq('is_active', true).order('name'),
        supabase.from('services').select('id, name, price, clinic_id').eq('is_active', true).order('name'),
        supabase.from('doctors').select('profile_id, clinic_id, specialty, profiles(first_name, last_name)'),
      ]);
      if (cancelled) return;
      if (clinicsRes.data) setClinics(clinicsRes.data);
      if (servicesRes.data) setServicesCatalog(servicesRes.data);
      if (doctorsRes.data) setDoctors(doctorsRes.data);
      setLoadingOptions(false);
    }
    loadOptions();
    return () => { cancelled = true; };
  }, []);

  // ─── البحث الفوري ───
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = search.trim();
    if (!q) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const [profilesRes, walkInRes] = await Promise.all([
        supabase.from('profiles').select('id, first_name, last_name, phone').eq('role', 'patient')
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,patient_code.ilike.%${q}%`).limit(8),
        supabase.from('walk_in_patients').select('id, name, phone')
          .or(`name.ilike.%${q}%,phone.ilike.%${q}%,patient_code.ilike.%${q}%`).limit(8),
      ]);
      const registered: FoundPatient[] = (profilesRes.data || []).map(p => ({
        id: p.id, name: `${p.first_name || ''} ${p.last_name || ''}`.trim(), phone: p.phone, source: 'registered',
      }));
      const walkIns: FoundPatient[] = (walkInRes.data || []).map(p => ({
        id: p.id, name: p.name, phone: p.phone, source: 'walk_in',
      }));
      setResults([...registered, ...walkIns]);
      setSearching(false);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const patientLocked = isAddingService; // في وضع إضافة خدمة، المريض/التاريخ/العيادة ثابتين
  const dateClinicLocked = isAddingService;

  const servicesForClinic = useMemo(
    () => (clinicId ? servicesCatalog.filter(s => s.clinic_id === clinicId) : []),
    [clinicId, servicesCatalog]
  );
  const doctorsForClinic = useMemo(
    () => (clinicId ? doctors.filter((d: any) => d.clinic_id === clinicId) : doctors),
    [clinicId, doctors]
  );

  // إجمالي المبلغ اللي المفروض يدفعه المريض (محسوب من السطور)
  const totalPaid = useMemo(
    () => serviceLines.reduce((sum, l) => sum + (parseFloat(l.price) || 0), 0),
    [serviceLines]
  );

  // ─── خدمات الـ UI ───
  const updateLine = (id: string, patch: Partial<ServiceLine>) => {
    setServiceLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  };

  const addLine = () => setServiceLines(prev => [...prev, newServiceLine()]);
  const removeLine = (id: string) => {
    setServiceLines(prev => (prev.length <= 1 ? prev : prev.filter(l => l.id !== id)));
  };

  const handleServiceSelect = (lineId: string, selectedId: string) => {
    if (selectedId === '__other__') {
      updateLine(lineId, { serviceId: '__other__', customName: '', price: '', saveToCatalog: false });
    } else if (selectedId) {
      const svc = servicesCatalog.find(s => s.id === selectedId);
      updateLine(lineId, {
        serviceId: selectedId,
        customName: '',
        price: svc ? String(svc.price) : '',
        saveToCatalog: false,
      });
    } else {
      updateLine(lineId, { serviceId: '', customName: '', price: '', saveToCatalog: false });
    }
  };

  // ─── اختيار / إنشاء المريض ───
  const pickPatient = (p: FoundPatient) => {
    setSelectedPatient(p);
    setSearch('');
    setResults([]);
    setCreatingNew(false);
  };

  const startCreateNew = () => {
    setSelectedPatient(null);
    setSearch('');
    setResults([]);
    setCreatingNew(true);
    // اه，预фил الاسم لو المستخدم كان كاتبه في البحث
    setNewName(search.trim());
  };

  // ─── حلّ سطر الخدمة (custom → service_id محفوظ أو اسم حر) ───
  const resolveLine = async (line: ServiceLine): Promise<{ serviceId: string | null; customName: string | null; price: number }> => {
    const price = parseFloat(line.price) || 0;
    if (line.serviceId === '__other__') {
      if (line.saveToCatalog && line.customName.trim() && clinicId) {
        const { data, error } = await supabase.from('services').insert([{
          clinic_id: clinicId,
          name: line.customName.trim(),
          price,
          is_active: true,
        }]).select().single();
        if (!error && data) {
          return { serviceId: data.id, customName: null, price };
        }
      }
      return { serviceId: null, customName: line.customName.trim() || null, price };
    }
    return { serviceId: line.serviceId || null, customName: null, price };
  };

  // ─── حفظ ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    // 1) تحديد المريض
    let patient = selectedPatient;
    if (!patient) {
      if (!creatingNew) {
        setSaveError('اختر مريضًا أو أنشئ مريضًا جديدًا.');
        return;
      }
      const name = newName.trim();
      if (!name) {
        setSaveError('اكتب اسم المريض الجديد.');
        return;
      }
      // إنشاء walk_in_patient
      const { data: created, error: createErr } = await supabase
        .from('walk_in_patients')
        .insert([{ name, phone: newPhone.trim() || null, created_by: user?.id || null }])
        .select()
        .single();
      if (createErr || !created) {
        setSaveError(getFriendlyErrorMessage(createErr, 'تعذر إنشاء ملف المريض.'));
        return;
      }
      patient = { id: created.id, name: created.name, phone: created.phone, source: 'walk_in' };
    }

    if (!visitDate) {
      setSaveError('حدد تاريخ الزيارة.');
      return;
    }
    if (!clinicId) {
      setSaveError('اختر العيادة.');
      return;
    }
    const isVisitToday = visitDate === todayStr();

    // 2) فحص أن فيه خدمة واحدة على الأقل فيها اسم
    const filledLines = serviceLines.filter(l => l.serviceId || l.customName.trim());
    if (filledLines.length === 0) {
      setSaveError('أضف خدمة واحدة على الأقل.');
      return;
    }

    setSaving(true);

    try {
      // 3) لو بنضيف خدمة لنفس الزيارة: visit_group_id موجود
      let groupId: string;
      if (addServiceTo) {
        groupId = addServiceTo.visitGroupId;
      } else if (editVisit?.visit_group_id) {
        groupId = editVisit.visit_group_id;
      } else {
        groupId = crypto.randomUUID();
      }

      // 4) تعديل: بنحدّث الصف الموجود بدل ما نضيف صفوف جديدة
      if (isEditing) {
        const first = filledLines[0];
        const resolved = await resolveLine(first);
        const { error } = await supabase.from('patient_visits').update({
          visit_date: visitDate,
          service_id: resolved.serviceId,
          service_name: resolved.customName || servicesCatalog.find(s => s.id === resolved.serviceId)?.name || null,
          clinic_id: clinicId || null,
          doctor_id: doctorId || null,
          paid_amount: parseFloat(first.price) || 0,
        }).eq('id', editVisit.id);
        if (error) throw error;
        onAdded?.();
        onClose();
        return;
      }

      // 5) إضافة: نضيف صف لكل خدمة في patient_visits (visit_group_id موحّد)
      const visitsToInsert: any[] = [];
      for (const line of filledLines) {
        const resolved = await resolveLine(line);
        const svcName = resolved.customName
          || servicesCatalog.find(s => s.id === resolved.serviceId)?.name
          || null;
        visitsToInsert.push({
          patient_id: patient.source === 'registered' ? patient.id : null,
          walk_in_patient_id: patient.source === 'walk_in' ? patient.id : null,
          patient_name: patient.name,
          visit_date: visitDate,
          service_id: resolved.serviceId,
          service_name: svcName,
          clinic_id: clinicId || null,
          doctor_id: doctorId || null,
          paid_amount: parseFloat(line.price) || 0,
          entered_by: user?.id || null,
          visit_group_id: groupId,
        });
      }
      const { error: visitErr } = await supabase.from('patient_visits').insert(visitsToInsert);
      if (visitErr) throw visitErr;

      // 6) لو الزيارة النهارده: نضيف سطر رئيسي في call_queue
      //    الخدمات الإضافية (أكتر من واحدة) بتدخل في queue_services.
      if (isVisitToday && !patientLocked) {
        const firstLine = filledLines[0];
        const firstResolved = await resolveLine(firstLine);

        const { data: token, error: rpcErr } = await supabase.rpc('get_next_queue_number', {
          p_clinic_id: clinicId,
        });
        if (rpcErr || token === null || token === undefined) {
          throw rpcErr || new Error('تعذر حجز رقم دور.');
        }

        const { data: queueRow, error: queueErr } = await supabase.from('call_queue').insert([{
          clinic_id: clinicId,
          patient_name: patient.name,
          phone: patient.phone,
          token_number: token as number,
          status: 'waiting',
          patient_id: patient.source === 'registered' ? patient.id : null,
          walk_in_patient_id: patient.source === 'walk_in' ? patient.id : null,
          service_id: firstResolved.serviceId,
          service_custom_name: firstResolved.customName,
          doctor_id: doctorId || null,
          paid_amount: parseFloat(firstLine.price) || 0,
          remaining_amount: 0,
          collected_by: user?.id || null,
        }]).select().single();
        if (queueErr) throw queueErr;

        // أي خدمة تانية (من الثانية للتالتة) بتنضاف في queue_services
        if (queueRow && filledLines.length > 1) {
          const extras = filledLines.slice(1);
          const extrasRows = [];
          for (const line of extras) {
            const r = await resolveLine(line);
            extrasRows.push({
              queue_id: queueRow.id,
              service_id: r.serviceId,
              custom_name: r.customName,
              price: parseFloat(line.price) || 0,
              added_by: user?.id || null,
            });
          }
          if (extrasRows.length > 0) {
            const { error: extrasErr } = await supabase.from('queue_services').insert(extrasRows);
            if (extrasErr) throw extrasErr;
          }
        }

        onAdded?.({ tokenNumber: token as number, clinicId });
      } else {
        onAdded?.();
      }
      onClose();
    } catch (err: any) {
      setSaveError(getFriendlyErrorMessage(err, 'تعذر حفظ الزيارة.'));
    } finally {
      setSaving(false);
    }
  };

  // ─── واجهة المريض (بحث / اختيار / إنشاء) ───
  const renderPatientBlock = () => {
    if (patientLocked) {
      return (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <div>
            <span className="font-bold text-gray-800 block">{selectedPatient?.name}</span>
            <span className="text-xs text-gray-500">إضافة خدمة لنفس الجلسة</span>
          </div>
        </div>
      );
    }

    if (selectedPatient) {
      return (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <div>
            <span className="font-bold text-gray-800 block">{selectedPatient.name}</span>
            {selectedPatient.phone && (
              <span className="text-xs text-gray-500" dir="ltr">{selectedPatient.phone}</span>
            )}
          </div>
          {!isEditing && (
            <button type="button" onClick={() => setSelectedPatient(null)} className="text-sm text-red-600 font-bold">
              تغيير
            </button>
          )}
        </div>
      );
    }

    if (creatingNew) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-blue-800 flex items-center gap-1">
              <UserPlus className="w-4 h-4" /> مريض جديد
            </span>
            {!isEditing && (
              <button type="button" onClick={() => setCreatingNew(false)} className="text-xs text-blue-700 font-bold hover:underline">
                إلغاء والبحث بدلًا من ذلك
              </button>
            )}
          </div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم المريض (إجباري)"
            className="w-full border rounded-lg p-2 text-sm bg-white"
            autoFocus
          />
          <input
            type="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="رقم الهاتف (اختياري)"
            className="w-full border rounded-lg p-2 text-sm bg-white"
            dir="ltr"
          />
        </div>
      );
    }

    return (
      <div>
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3 top-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم، الكود، أو رقم الهاتف..."
            className="w-full pr-9 pl-3 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            autoFocus={!patientLocked}
          />
          {searching && <Loader2 className="w-4 h-4 absolute left-3 top-3.5 animate-spin text-gray-400" />}
        </div>

        {results.length > 0 && (
          <div className="mt-2 border rounded-xl divide-y overflow-hidden max-h-56 overflow-y-auto bg-white">
            {results.map(p => (
              <button
                key={`${p.source}-${p.id}`}
                type="button"
                onClick={() => pickPatient(p)}
                className="w-full text-right p-3 hover:bg-emerald-50 transition-colors flex items-center justify-between"
              >
                <span className="font-bold text-gray-800">{p.name}</span>
                <span className="text-xs text-gray-400">
                  {p.source === 'walk_in' ? 'زيارة مباشرة' : 'مسجّل بحساب'}
                  {p.phone ? ` · ${p.phone}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}

        {search.trim() && !searching && results.length === 0 && (
          <div className="mt-2 p-3 border border-dashed border-gray-200 rounded-xl text-center bg-gray-50">
            <p className="text-sm text-gray-500 mb-2">لا يوجد مريض بهذا الاسم.</p>
            <button
              type="button"
              onClick={startCreateNew}
              className="text-sm font-bold text-emerald-700 hover:underline flex items-center gap-1 mx-auto"
            >
              <UserPlus className="w-4 h-4" /> إنشاء ملف لـ «{search.trim()}»
            </button>
          </div>
        )}

        {!search.trim() && (
          <p className="text-xs text-gray-400 mt-2">
            ابحث باسم المريض أو رقمه، أو اكتب اسمًا جديدًا لإنشاء ملف زيارة مباشرة.
          </p>
        )}
      </div>
    );
  };

  const isVisitForToday = visitDate === todayStr();

  const modalTitle = isEditing
    ? 'تعديل الزيارة'
    : isAddingService
    ? 'إضافة خدمة لنفس الزيارة'
    : 'إضافة زيارة';

  const submitLabel = isEditing
    ? 'حفظ التعديلات'
    : isVisitForToday
    ? 'حفظ وإضافة لطابور النداء'
    : 'حفظ الزيارة';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            {modalTitle}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loadingOptions ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {!isEditing && !isAddingService && (
              <div className={`flex items-start gap-2 text-xs border rounded-lg p-2.5 ${isVisitForToday ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {isVisitForToday
                    ? 'التاريخ المختار = اليوم. الزيارة هتنزل في طابور النداء الآلي وتسجل في التقارير المالية بنفس الوقت.'
                    : 'التاريخ المختار = تاريخ سابق. الزيارة هتتسجل في سجل الزيارات والتقارير المالية بس، ومش هتظهر في النداء الآلي.'}
                </span>
              </div>
            )}

            {/* المريض */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">المريض</label>
              {renderPatientBlock()}
            </div>

            {/* التاريخ والعيادة والطبيب */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ الزيارة</label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  max={todayStr()}
                  className="w-full border rounded-lg p-2.5 bg-white"
                  required
                  disabled={dateClinicLocked}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">العيادة *</label>
                <select
                  value={clinicId}
                  onChange={(e) => {
                    setClinicId(e.target.value);
                    // لو غيرنا العيادة، نمسح اختيار الخدمة عشان الخدمات بتختلف
                    setServiceLines(prev => prev.map(l => ({ ...l, serviceId: '', customName: '', price: '' })));
                  }}
                  className="w-full border rounded-lg p-2.5 bg-white"
                  required
                  disabled={dateClinicLocked}
                >
                  <option value="">-- اختر العيادة --</option>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الطبيب</label>
                <select
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="w-full border rounded-lg p-2.5 bg-white"
                  disabled={!clinicId}
                >
                  <option value="">-- بدون تحديد --</option>
                  {doctorsForClinic.map((d: any) => (
                    <option key={d.profile_id} value={d.profile_id}>
                      د. {d.profiles?.first_name} {d.profiles?.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* الخدمات (سطور متعددة) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-gray-700">الخدمات والمبالغ</label>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <PlusCircle className="w-4 h-4" /> إضافة خدمة أخرى
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {serviceLines.map((line, idx) => {
                  const isOther = line.serviceId === '__other__';
                  const availableServices = servicesForClinic;
                  return (
                    <div key={line.id} className="border rounded-xl p-3 bg-gray-50 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 shrink-0 w-6">#{idx + 1}</span>
                        <select
                          value={line.serviceId}
                          onChange={(e) => handleServiceSelect(line.id, e.target.value)}
                          className="flex-1 border rounded-lg p-2 text-sm bg-white"
                          disabled={!clinicId}
                        >
                          <option value="">-- بدون خدمة --</option>
                          {availableServices.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.price} ج.م)</option>
                          ))}
                          <option value="__other__">خدمة أخرى (مخصصة)...</option>
                        </select>
                        {serviceLines.length > 1 && !isEditing && (
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="text-red-400 hover:text-red-600 p-1"
                            title="حذف السطر"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {isOther && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mr-8">
                          <input
                            type="text"
                            placeholder="اسم الخدمة المخصصة"
                            value={line.customName}
                            onChange={(e) => updateLine(line.id, { customName: e.target.value })}
                            className="border rounded-lg p-2 text-sm bg-white"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="السعر"
                            value={line.price}
                            onChange={(e) => updateLine(line.id, { price: e.target.value })}
                            className="border rounded-lg p-2 text-sm bg-white"
                          />
                          <label className="md:col-span-2 flex items-center gap-2 text-xs text-gray-600">
                            <input
                              type="checkbox"
                              checked={line.saveToCatalog}
                              onChange={(e) => updateLine(line.id, { saveToCatalog: e.target.checked })}
                            />
                            حفظ في قائمة خدمات هذه العيادة (عشان تختارها بسرعة في المرات الجاية)
                          </label>
                        </div>
                      )}

                      {!isOther && (
                        <div className="flex items-center justify-end mr-8">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-500">المبلغ (ج.م):</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.price}
                              onChange={(e) => updateLine(line.id, { price: e.target.value })}
                              className="w-28 border rounded-lg p-1.5 text-sm bg-white text-left"
                              dir="ltr"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!isEditing && serviceLines.length > 1 && (
                <div className="flex justify-between items-center mt-2 px-3 text-sm">
                  <span className="text-gray-500">إجمالي الخدمات</span>
                  <span className="font-bold text-emerald-700" dir="ltr">{totalPaid.toLocaleString()} ج.م</span>
                </div>
              )}
            </div>

            {saveError && <InlineError message={saveError} />}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              {submitLabel}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
