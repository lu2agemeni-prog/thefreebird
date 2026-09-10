'use client';

// ============================================================================
// components/dashboards/secretary/AddPatientModal.tsx
// نموذج إضافة مريض من الاستقبال: بيتسجل في ملفات المرضى (walk_in_patients)
// وبينضاف مباشرة لطابور النداء الآلي (call_queue) بنفس العملية.
// ============================================================================

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { X, Loader2, UserPlus } from 'lucide-react';
import { InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { ServicePicker, EMPTY_SERVICE_VALUE, resolveServiceSelection, type ServicePickerValue } from './ServicePicker';

interface AddPatientModalProps {
  onClose: () => void;
  onAdded: (tokenNumber: number, clinicId: string) => void;
}

export function AddPatientModal({ onClose, onAdded }: AddPatientModalProps) {
  const { user } = useAuth();
  const [clinics, setClinics] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [serviceValue, setServiceValue] = useState<ServicePickerValue>(EMPTY_SERVICE_VALUE);
  const [doctorId, setDoctorId] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [remainingAmount, setRemainingAmount] = useState('0');

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      setLoadError(null);
      const [clinicsRes, servicesRes, doctorsRes] = await Promise.all([
        supabase.from('clinics').select('*').eq('is_active', true),
        supabase.from('services').select('*').eq('is_active', true),
        supabase.from('doctors').select('profile_id, clinic_id, specialty, profiles(first_name, last_name)'),
      ]);

      if (clinicsRes.error) {
        setLoadError(getFriendlyErrorMessage(clinicsRes.error, 'تعذر تحميل قائمة العيادات.'));
      } else {
        setClinics(clinicsRes.data || []);
      }
      if (servicesRes.data) setServices(servicesRes.data);
      if (doctorsRes.data) setDoctors(doctorsRes.data);
      setLoadingOptions(false);
    };
    fetchOptions();
  }, []);

  // فلترة الأطباء حسب العيادة المختارة (الخدمات بتتفلتر جوه ServicePicker)
  const filteredDoctors = doctors.filter(d => !clinicId || d.clinic_id === clinicId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !clinicId) return;

    setSubmitting(true);
    setSubmitError(null);

    // 1) سجّل المريض في ملفات المرضى (بدون حساب دخول)
    const { data: walkIn, error: walkInError } = await supabase
      .from('walk_in_patients')
      .insert([{ name: name.trim(), phone: phone.trim() || null, created_by: user?.id || null }])
      .select()
      .single();

    if (walkInError || !walkIn) {
      setSubmitting(false);
      setSubmitError(getFriendlyErrorMessage(walkInError, 'تعذر تسجيل بيانات المريض.'));
      return;
    }

    // 2) رقم الدور التالي لنفس العيادة (RPC ذرّي يمنع تكرار الرقم)
    const { data: token, error: rpcError } = await supabase.rpc('get_next_queue_number', {
      p_clinic_id: clinicId,
    });

    if (rpcError || token === null || token === undefined) {
      setSubmitting(false);
      setSubmitError(getFriendlyErrorMessage(rpcError, 'تعذر حجز رقم دور للمريض.'));
      return;
    }

    // 3) خدمة من القائمة، أو خدمة مخصّصة (تتحفظ في القائمة لو طلبت كده)
    const resolvedService = await resolveServiceSelection(supabase, clinicId, serviceValue);

    // 4) أضفه لطابور النداء الآلي بكل التفاصيل
    const { error: queueError } = await supabase.from('call_queue').insert([{
      clinic_id: clinicId,
      patient_name: name.trim(),
      phone: phone.trim() || null,
      token_number: token,
      status: 'waiting',
      walk_in_patient_id: walkIn.id,
      service_id: resolvedService.serviceId,
      service_custom_name: resolvedService.customName,
      doctor_id: doctorId || null,
      paid_amount: parseFloat(paidAmount) || 0,
      remaining_amount: parseFloat(remainingAmount) || 0,
      collected_by: user?.id || null,
    }]);

    setSubmitting(false);

    if (queueError) {
      setSubmitError(getFriendlyErrorMessage(queueError, 'تم تسجيل المريض لكن تعذرت إضافته لطابور النداء.'));
      return;
    }

    onAdded(token as number, clinicId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            إضافة مريض جديد
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loadingOptions ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : loadError ? (
          <div className="p-6"><InlineError message={loadError} /></div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">اسم المريض *</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded-lg p-3"
                placeholder="الاسم ثلاثي"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">رقم التليفون</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border rounded-lg p-3"
                placeholder="رقم الموبايل"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">العيادة *</label>
              <select
                required
                value={clinicId}
                onChange={(e) => { setClinicId(e.target.value); setServiceValue(EMPTY_SERVICE_VALUE); setDoctorId(''); }}
                className="w-full border rounded-lg p-3 bg-white"
              >
                <option value="">-- اختر العيادة --</option>
                {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">الخدمة</label>
              <ServicePicker
                clinicId={clinicId}
                services={services}
                value={serviceValue}
                onChange={setServiceValue}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">الطبيب</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full border rounded-lg p-3 bg-white"
                disabled={!clinicId}
              >
                <option value="">-- بدون تحديد --</option>
                {filteredDoctors.map(d => (
                  <option key={d.profile_id} value={d.profile_id}>
                    {d.profiles?.first_name} {d.profiles?.last_name} {d.specialty ? `— ${d.specialty}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">المدفوع</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full border rounded-lg p-3"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">المتبقي</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={remainingAmount}
                  onChange={(e) => setRemainingAmount(e.target.value)}
                  className="w-full border rounded-lg p-3"
                />
              </div>
            </div>

            {submitError && <InlineError message={submitError} />}

            <button
              type="submit"
              disabled={submitting || !name.trim() || !clinicId}
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
              إضافة المريض وتسجيله في النداء
            </button>
          </form>
        )}
      </div>
    </div>
  );
}