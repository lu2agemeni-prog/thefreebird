'use client';

// ============================================================================
// components/dashboards/doctor/DoctorPrescriptions.tsx
// اختيار مريض وإصدار روشتة له + عرض الروشتات اللي أصدرها الطبيب من قبل.
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search-input';
import { ErrorState } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { FileText, Loader2, Plus, Pill, FlaskConical, ScanLine, Star } from 'lucide-react';
import { PrescriptionModal } from './PrescriptionModal';

export function DoctorPrescriptions() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoadError(null);
    setLoading(true);
    const [patientsRes, prescriptionsRes] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, patient_code, phone').eq('role', 'patient'),
      supabase.from('prescriptions').select('*, patient:patient_id(first_name, last_name)').eq('doctor_id', user?.id).order('created_at', { ascending: false }),
    ]);

    if (patientsRes.error) {
      setLoadError(getFriendlyErrorMessage(patientsRes.error, 'تعذر تحميل قائمة المرضى.'));
      setLoading(false);
      return;
    }
    setPatients(patientsRes.data || []);
    if (prescriptionsRes.data) setPrescriptions(prescriptionsRes.data);
    setLoading(false);
  };

  const filteredPatients = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return patients.filter(p =>
      `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase().includes(q) ||
      (p.patient_code || '').toLowerCase().includes(q) ||
      (p.phone || '').includes(search)
    ).slice(0, 8);
  }, [patients, search]);

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">الروشتات</h2>
      </div>

      {savedToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm font-bold">
          تم حفظ الروشتة وإرسال إشعار للمريض بنجاح.
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <h3 className="font-bold text-gray-700 mb-3">إصدار روشتة جديدة</h3>
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="ابحث باسم المريض أو الكود أو رقم الهاتف..."
          />
          {filteredPatients.length > 0 && (
            <div className="mt-3 border rounded-xl divide-y">
              {filteredPatients.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPatient({ id: p.id, name: `${p.first_name || ''} ${p.last_name || ''}`.trim() });
                    setSearch('');
                  }}
                  className="w-full text-right p-3 hover:bg-gray-50 flex items-center justify-between"
                >
                  <span className="font-bold text-gray-800">{p.first_name} {p.last_name}</span>
                  <span className="text-xs text-gray-400 font-mono">{p.patient_code}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-bold text-gray-700 mb-3">الروشتات السابقة ({prescriptions.length})</h3>
          {prescriptions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">لم تُصدر أي روشتات بعد</p>
          ) : (
            <div className="space-y-3">
              {prescriptions.map(p => (
                <div key={p.id} className="border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-800">
                      {p.patient?.first_name} {p.patient?.last_name}
                    </span>
                    <span className="text-xs text-gray-400" dir="ltr">
                      {new Date(p.created_at).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {p.medications?.length > 0 && (
                      <span className="flex items-center gap-1"><Pill className="w-3 h-3" /> {p.medications.length} دواء</span>
                    )}
                    {p.lab_tests?.length > 0 && (
                      <span className="flex items-center gap-1"><FlaskConical className="w-3 h-3" /> {p.lab_tests.length} تحليل</span>
                    )}
                    {p.radiology?.length > 0 && (
                      <span className="flex items-center gap-1"><ScanLine className="w-3 h-3" /> {p.radiology.length} أشعة</span>
                    )}
                    {p.rating && (
                      <span className="flex items-center gap-1 text-amber-500 font-bold">
                        <Star className="w-3 h-3 fill-amber-400" /> {p.rating}/5
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPatient && (
        <PrescriptionModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
          onSaved={() => {
            setSelectedPatient(null);
            setSavedToast(true);
            setTimeout(() => setSavedToast(false), 5000);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
