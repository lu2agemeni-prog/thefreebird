'use client';

// ============================================================================
// components/dashboards/secretary/AddExistingPatientModal.tsx
// البحث عن مريض موجود بالفعل (مسجّل بالتطبيق أو زيارة سابقة) وإضافته
// مباشرة لطابور النداء الآلي، من غير ما نكرر تسجيله في ملفات المرضى.
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Loader2, UserCheck, Search } from 'lucide-react';
import { InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { ServicePicker, EMPTY_SERVICE_VALUE, resolveServiceSelection, type ServicePickerValue } from './ServicePicker';

interface FoundPatient {
  id: string;
  name: string;
  phone: string | null;
  source: 'registered' | 'walk_in';
}

interface AddExistingPatientModalProps {
  onClose: () => void;
  onAdded: (tokenNumber: number, clinicId: string) => void;
}

export function AddExistingPatientModal({ onClose, onAdded }: AddExistingPatientModalProps) {
  const [clinics, setClinics] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FoundPatient[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selected, setSelected] = useState<FoundPatient | null>(null);
  const [clinicId, setClinicId] = useState('');
  const [serviceValue, setServiceValue] = useState<ServicePickerValue>(EMPTY_SERVICE_VALUE);
  const [doctorId, setDoctorId] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [remainingAmount, setRemainingAmount] = useState('0');

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

  // بحث فوري من السيرفر في المسجّلين وزيارات الاستقبال السابقة معًا
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
        supabase.from('profiles').select('id, first_name, last_name, phone')
          .eq('role', 'patient')
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,patient_code.ilike.%${q}%`)
          .limit(6),
        supabase.from('walk_in_patients').select('id, name, phone')
          .or(`name.ilike.%${q}%,phone.ilike.%${q}%,patient_code.ilike.%${q}%`)
          .limit(6),
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

  const filteredDoctors = doctors.filter(d => !clinicId || d.clinic_id === clinicId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !clinicId) return;

    setSubmitting(true);
    setSubmitError(null);

    const { data: token, error: rpcError } = await supabase.rpc('get_next_queue_number', {
      p_clinic_id: clinicId,
    });

    if (rpcError || token === null || token === undefined) {
      setSubmitting(false);
      setSubmitError(getFriendlyErrorMessage(rpcError, 'تعذر حجز رقم دور للمريض.'));
      return;
    }

    const resolvedService = await resolveServiceSelection(supabase, clinicId, serviceValue);

    const { error: queueError } = await supabase.from('call_queue').insert([{
      clinic_id: clinicId,
      patient_name: selected.name,
      phone: selected.phone,
      token_number: token,
      status: 'waiting',
      patient_id: selected.source === 'registered' ? selected.id : null,
      walk_in_patient_id: selected.source === 'walk_in' ? selected.id : null,
      service_id: resolvedService.serviceId,
      service_custom_name: resolvedService.customName,
      doctor_id: doctorId || null,
      paid_amount: parseFloat(paidAmount) || 0,
      remaining_amount: parseFloat(remainingAmount) || 0,
    }]);

    setSubmitting(false);

    if (queueError) {
      setSubmitError(getFriendlyErrorMessage(queueError, 'تعذر إضافة المريض لطابور النداء.'));
      return;
    }

    onAdded(token as number, clinicId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            إضافة مريض مسجّل للنداء
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loadingOptions ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : loadError ? (
          <div className="p-6"><InlineError message={loadError} /></div>
        ) : !selected ? (
          <div className="p-5">
            <label className="block text-sm font-bold text-gray-700 mb-1">ابحث عن المريض</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="الاسم، الكود، أو رقم الهاتف..."
                className="w-full border rounded-lg py-3 pr-9 pl-3"
              />
            </div>
            {searching && (
              <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
                <Loader2 className="w-4 h-4 animate-spin" /> جارٍ البحث...
              </div>
            )}
            {results.length > 0 && (
              <div className="mt-3 border rounded-xl divide-y">
                {results.map(r => (
                  <button
                    key={`${r.source}-${r.id}`}
                    onClick={() => setSelected(r)}
                    className="w-full text-right p-3 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="font-bold text-gray-800">{r.name || '---'}</span>
                    <span className="text-xs text-gray-400">
                      {r.source === 'registered' ? 'مسجّل بالتطبيق' : 'زيارة سابقة'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {search.trim() && !searching && results.length === 0 && (
              <p className="text-sm text-gray-400 mt-3 text-center">لا يوجد مرضى مطابقين للبحث</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="font-bold text-gray-800">{selected.name}</div>
                {selected.phone && <div className="text-xs text-gray-500" dir="ltr">{selected.phone}</div>}
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-xs text-blue-600 font-bold hover:underline">
                تغيير
              </button>
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
              <ServicePicker clinicId={clinicId} services={services} value={serviceValue} onChange={setServiceValue} />
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
                  type="number" min="0" step="0.01"
                  value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full border rounded-lg p-3"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">المتبقي</label>
                <input
                  type="number" min="0" step="0.01"
                  value={remainingAmount} onChange={(e) => setRemainingAmount(e.target.value)}
                  className="w-full border rounded-lg p-3"
                />
              </div>
            </div>

            {submitError && <InlineError message={submitError} />}

            <button
              type="submit"
              disabled={submitting || !clinicId}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />}
              إضافة للنداء الآلي
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
