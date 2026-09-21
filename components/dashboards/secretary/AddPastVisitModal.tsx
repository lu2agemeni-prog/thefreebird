'use client';

// ============================================================================
// components/dashboards/secretary/AddPastVisitModal.tsx
// إضافة زيارة قديمة (بتاريخ سابق) من دليل المرضى — لا تُضاف إلى النداء
// الآلي (call_queue) خالص، بس تتسجل في سجل الزيارات وتُحتسب في التقارير
// المالية بتاريخها الحقيقي. بقى يدعم كمان: تعديل صف موجود، أو إضافة خدمة
// جديدة لنفس جلسة الزيارة (نفس visit_group_id) لمريض اتسجل بالفعل.
// ============================================================================
import { useState, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle2, Search } from 'lucide-react';
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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

interface AddPastVisitModalProps {
  onClose: () => void;
  onAdded: () => void;
  /** تعديل صف موجود بدل إضافة صف جديد */
  editVisit?: any;
  /** إضافة خدمة جديدة لنفس جلسة زيارة موجودة لنفس المريض */
  addServiceTo?: {
    visitGroupId: string;
    patient: FoundPatient;
    visitDate: string;
    clinicId: string | null;
    doctorId: string | null;
  };
}

export function AddPastVisitModal({ onClose, onAdded, editVisit, addServiceTo }: AddPastVisitModalProps) {
  const { user } = useAuth();
  const isEditing = !!editVisit;

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
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [clinics, setClinics] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);

  const [visitDate, setVisitDate] = useState(editVisit?.visit_date || addServiceTo?.visitDate || todayStr());
  const [clinicId, setClinicId] = useState(editVisit?.clinic_id || addServiceTo?.clinicId || '');
  const [serviceId, setServiceId] = useState(editVisit?.service_id || '');
  const [doctorId, setDoctorId] = useState(editVisit?.doctor_id || addServiceTo?.doctorId || '');
  const [paidAmount, setPaidAmount] = useState(editVisit ? String(editVisit.paid_amount ?? '') : '');
  const [customServiceName, setCustomServiceName] = useState(editVisit?.service_id ? '' : (editVisit?.service_name || ''));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('clinics').select('id, name').eq('is_active', true).then(({ data }) => setClinics(data || []));
    supabase.from('services').select('id, name, price, clinic_id').eq('is_active', true).then(({ data }) => setServices(data || []));
    supabase.from('profiles').select('id, first_name, last_name, doctor:doctors(clinic_id)').eq('role', 'doctor').then(({ data }) => setDoctors(data || []));
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = search.trim();
    if (!q) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const [profilesRes, walkInRes] = await Promise.all([
        supabase.from('profiles').select('id, first_name, last_name, phone').eq('role', 'patient')
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,patient_code.ilike.%${q}%`).limit(6),
        supabase.from('walk_in_patients').select('id, name, phone')
          .or(`name.ilike.%${q}%,phone.ilike.%${q}%,patient_code.ilike.%${q}%`).limit(6),
      ]);
      const registered: FoundPatient[] = (profilesRes.data || []).map(p => ({ id: p.id, name: `${p.first_name || ''} ${p.last_name || ''}`.trim(), phone: p.phone, source: 'registered' }));
      const walkIns: FoundPatient[] = (walkInRes.data || []).map(p => ({ id: p.id, name: p.name, phone: p.phone, source: 'walk_in' }));
      setResults([...registered, ...walkIns]);
      setSearching(false);
    }, 300);
  }, [search]);

  const servicesForClinic = clinicId ? services.filter(s => s.clinic_id === clinicId || !s.clinic_id) : services;
  const doctorsForClinic = clinicId ? doctors.filter((d: any) => d.doctor?.clinic_id === clinicId) : doctors;
  const patientLocked = !!addServiceTo; // إضافة خدمة لنفس الزيارة = نفس المريض والتاريخ، ملهمش داعي يتغيروا

  const handleServiceChange = (id: string) => {
    setServiceId(id);
    setCustomServiceName('');
    const svc = services.find(s => s.id === id);
    if (svc) setPaidAmount(String(svc.price));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!selectedPatient) {
      setSaveError('يرجى اختيار المريض.');
      return;
    }
    if (!visitDate) {
      setSaveError('يرجى تحديد تاريخ الزيارة.');
      return;
    }

    const selectedService = services.find(s => s.id === serviceId);
    const finalServiceName = selectedService?.name || customServiceName.trim() || null;

    setSaving(true);

    if (isEditing) {
      const { error } = await supabase.from('patient_visits').update({
        visit_date: visitDate,
        service_id: serviceId || null,
        service_name: finalServiceName,
        clinic_id: clinicId || null,
        doctor_id: doctorId || null,
        paid_amount: parseFloat(paidAmount) || 0,
      }).eq('id', editVisit.id);
      setSaving(false);
      if (error) {
        setSaveError(getFriendlyErrorMessage(error, 'تعذر حفظ التعديلات.'));
        return;
      }
    } else {
      const { error } = await supabase.from('patient_visits').insert([{
        patient_id: selectedPatient.source === 'registered' ? selectedPatient.id : null,
        walk_in_patient_id: selectedPatient.source === 'walk_in' ? selectedPatient.id : null,
        patient_name: selectedPatient.name,
        visit_date: visitDate,
        service_id: serviceId || null,
        service_name: finalServiceName,
        clinic_id: clinicId || null,
        doctor_id: doctorId || null,
        paid_amount: parseFloat(paidAmount) || 0,
        entered_by: user?.id || null,
        ...(addServiceTo ? { visit_group_id: addServiceTo.visitGroupId } : {}),
      }]);
      setSaving(false);
      if (error) {
        setSaveError(getFriendlyErrorMessage(error, 'تعذر حفظ الزيارة.'));
        return;
      }
    }

    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
          <h3 className="text-xl font-bold text-gray-800">
            {isEditing ? 'تعديل الزيارة' : addServiceTo ? 'إضافة خدمة لنفس الزيارة' : 'إضافة زيارة قديمة'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!isEditing && !addServiceTo && (
            <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg p-2">
              الزيارة دي بتتسجل في سجل الزيارات والتقارير المالية بس، ومش هتظهر في شاشة النداء الآلي أو طابور اليوم.
            </p>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">المريض</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <span className="font-bold text-gray-800">{selectedPatient.name}</span>
                {!patientLocked && !isEditing && (
                  <button type="button" onClick={() => setSelectedPatient(null)} className="text-sm text-red-600 font-bold">تغيير</button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-3.5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو الهاتف أو الكود..."
                  className="w-full pr-9 pl-3 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {searching && <Loader2 className="w-4 h-4 absolute left-3 top-3.5 animate-spin text-gray-400" />}
                {results.length > 0 && (
                  <div className="mt-2 border rounded-xl divide-y overflow-hidden">
                    {results.map(p => (
                      <button
                        key={`${p.source}-${p.id}`}
                        type="button"
                        onClick={() => { setSelectedPatient(p); setSearch(''); setResults([]); }}
                        className="w-full text-right p-3 hover:bg-emerald-50 transition-colors flex items-center justify-between"
                      >
                        <span className="font-bold text-gray-800">{p.name}</span>
                        <span className="text-xs text-gray-400">{p.source === 'walk_in' ? 'زيارة مباشرة' : 'مسجّل بحساب'}</span>
                      </button>
                    ))}
                  </div>
                )}
                {search.trim() && !searching && results.length === 0 && (
                  <p className="text-sm text-gray-400 mt-2">لا يوجد مريض مطابق.</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ الزيارة</label>
            <input
              type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} max={todayStr()}
              className="w-full border rounded-lg p-2.5" required disabled={!!addServiceTo}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">العيادة</label>
              <select value={clinicId} onChange={(e) => { setClinicId(e.target.value); setServiceId(''); }} className="w-full border rounded-lg p-2.5">
                <option value="">-- اختر العيادة --</option>
                {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">الطبيب</label>
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="w-full border rounded-lg p-2.5">
                <option value="">-- بدون تحديد --</option>
                {doctorsForClinic.map((d: any) => <option key={d.id} value={d.id}>د. {d.first_name} {d.last_name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">الخدمة</label>
              <select value={serviceId} onChange={(e) => handleServiceChange(e.target.value)} className="w-full border rounded-lg p-2.5">
                <option value="">-- خدمة مخصصة (اكتبها تحت) --</option>
                {servicesForClinic.map(s => <option key={s.id} value={s.id}>{s.name} ({s.price} ج.م)</option>)}
              </select>
              {!serviceId && (
                <input
                  type="text" value={customServiceName} onChange={(e) => setCustomServiceName(e.target.value)}
                  className="w-full border rounded-lg p-2.5 mt-2" placeholder="اسم خدمة مخصص (اختياري)"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ المدفوع (ج.م)</label>
              <input type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="w-full border rounded-lg p-2.5" placeholder="0" />
            </div>
          </div>

          {saveError && <InlineError message={saveError} />}

          <button type="submit" disabled={saving} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {isEditing ? 'حفظ التعديلات' : 'حفظ الزيارة'}
          </button>
        </form>
      </div>
    </div>
  );
}
