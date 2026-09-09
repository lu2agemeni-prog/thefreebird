'use client';

// ============================================================================
// components/dashboards/doctor/DoctorPrescriptions.tsx
// اختيار مريض وإصدار روشتة له + عرض الروشتات اللي أصدرها الطبيب من قبل.
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search-input';
import { ErrorState } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { FileText, Loader2, Plus, Pill, FlaskConical, ScanLine, Star, Pencil, Ban } from 'lucide-react';
import { PrescriptionModal } from './PrescriptionModal';

export function DoctorPrescriptions() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [editingPrescription, setEditingPrescription] = useState<any | null>(null);
  const [savedToast, setSavedToast] = useState<'created' | 'edited' | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  // بحث فوري من السيرفر (بعد توقف الكتابة لـ 300ms) بدل تحميل كل المرضى دفعة واحدة
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = search.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, patient_code, phone')
        .eq('role', 'patient')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,patient_code.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8);
      setSearchResults(data || []);
      setSearching(false);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const fetchPrescriptions = async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*, patient:patient_id(first_name, last_name)')
      .eq('doctor_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل الروشتات السابقة.'));
      setLoading(false);
      return;
    }
    if (data) setPrescriptions(data);
    setLoading(false);
  };

  const handleCancel = async (id: string) => {
    if (!confirm('هل أنت متأكد من إلغاء هذه الروشتة؟ سيظل المريض يرى أنها ملغاة.')) return;
    setCancellingId(id);
    const { error } = await supabase.from('prescriptions').update({ cancelled_at: new Date().toISOString() }).eq('id', id);
    setCancellingId(null);
    if (!error) fetchPrescriptions();
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchPrescriptions} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">الروشتات</h2>
      </div>

      {savedToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm font-bold">
          {savedToast === 'edited' ? 'تم حفظ التعديلات بنجاح.' : 'تم حفظ الروشتة وإرسال إشعار للمريض بنجاح.'}
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
          {searching && (
            <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
              <Loader2 className="w-4 h-4 animate-spin" /> جارٍ البحث...
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="mt-3 border rounded-xl divide-y">
              {searchResults.map(p => (
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
                <div key={p.id} className={`border rounded-xl p-4 ${p.cancelled_at ? 'opacity-60 bg-gray-50' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-800 flex items-center gap-2">
                      {p.patient?.first_name} {p.patient?.last_name}
                      {p.cancelled_at && (
                        <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">ملغاة</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-400" dir="ltr">
                      {new Date(p.created_at).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
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
                  {!p.cancelled_at && (
                    <div className="flex gap-3 pt-2 border-t">
                      <button
                        onClick={() => setEditingPrescription(p)}
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" /> تعديل
                      </button>
                      <button
                        onClick={() => handleCancel(p.id)}
                        disabled={cancellingId === p.id}
                        className="text-xs font-bold text-red-500 hover:underline flex items-center gap-1 disabled:opacity-50"
                      >
                        <Ban className="w-3 h-3" /> إلغاء
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(selectedPatient || editingPrescription) && (
        <PrescriptionModal
          patient={
            editingPrescription
              ? { id: editingPrescription.patient_id, name: `${editingPrescription.patient?.first_name || ''} ${editingPrescription.patient?.last_name || ''}`.trim() }
              : selectedPatient!
          }
          existing={editingPrescription || undefined}
          onClose={() => { setSelectedPatient(null); setEditingPrescription(null); }}
          onSaved={() => {
            const wasEditing = !!editingPrescription;
            setSelectedPatient(null);
            setEditingPrescription(null);
            setSavedToast(wasEditing ? 'edited' : 'created');
            setTimeout(() => setSavedToast(null), 5000);
            fetchPrescriptions();
          }}
        />
      )}
    </div>
  );
}