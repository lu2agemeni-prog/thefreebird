'use client';

// ============================================================================
// components/dashboards/manager/tabs/MedicalRecordsTab.tsx
// تبويب "الملفات الطبية" — بعد التوحيد بقى بيعرض المرضى المسجلين بحساب
// (profiles) ومرضى الزيارة المباشرة (walk_in_patients) مع بعض، بنفس منطق
// SecretaryPatients.tsx (كان تبويب المدير هنا بيتجاهل مرضى الزيارة
// المباشرة تمامًا رغم إنهم غالبًا أغلب المرضى في عيادة صغيرة). كمان بقى
// فيه زرار استيراد المرضى من ملف إكسيل.
// ============================================================================
import { useState, useEffect, useMemo, useCallback } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { BulkPatientImportModal } from '../../shared/BulkPatientImportModal';

const PAGE_SIZE = 10;
const FETCH_CAP = 2000;

interface UnifiedPatient {
  id: string;
  name: string;
  phone: string | null;
  patient_code: string | null;
  created_at: string;
  source: 'registered' | 'walk_in';
}

export function MedicalRecordsTab() {
  const [patients, setPatients] = useState<UnifiedPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showImportModal, setShowImportModal] = useState(false);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [profilesRes, walkInRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'patient').order('created_at', { ascending: false }).limit(FETCH_CAP),
      supabase.from('walk_in_patients').select('*').order('created_at', { ascending: false }).limit(FETCH_CAP),
    ]);

    if (profilesRes.error) {
      setError(getFriendlyErrorMessage(profilesRes.error, 'تعذر تحميل قائمة المرضى.'));
      setLoading(false);
      return;
    }

    const registered: UnifiedPatient[] = (profilesRes.data || []).map(p => ({
      id: p.id,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      phone: p.phone,
      patient_code: p.patient_code,
      created_at: p.created_at,
      source: 'registered' as const,
    }));

    const walkIns: UnifiedPatient[] = (walkInRes.data || []).map(p => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      patient_code: p.patient_code,
      created_at: p.created_at,
      source: 'walk_in' as const,
    }));

    const merged = [...registered, ...walkIns].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setPatients(merged);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);
  useEffect(() => { setPage(0); }, [search]);

  const filteredPatients = useMemo(() => patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.patient_code && p.patient_code.toLowerCase().includes(search.toLowerCase())) ||
    (p.phone && p.phone.includes(search))
  ), [patients, search]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filteredPatients.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>الملفات الطبية للمرضى</CardTitle>
            <CardDescription>المرضى المسجلين بحساب ومرضى الزيارة المباشرة معًا</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="w-full sm:w-72">
              <SearchInput value={search} onValueChange={setSearch} placeholder="ابحث بالاسم، رقم التليفون، أو الكود..." />
            </div>
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-white border border-emerald-200 text-emerald-700 font-bold px-4 py-2.5 rounded-xl hover:bg-emerald-50 flex items-center gap-2 shadow-sm whitespace-nowrap"
            >
              <FileSpreadsheet className="w-5 h-5" /> استيراد من إكسيل
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && <ErrorState message={error} onRetry={fetchPatients} compact />}
        {loading ? (
          <p className="text-gray-500 py-4">جاري تحميل الملفات...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-4 font-semibold text-gray-600">الكود الطبي</th>
                  <th className="p-4 font-semibold text-gray-600">اسم المريض</th>
                  <th className="p-4 font-semibold text-gray-600">رقم الهاتف</th>
                  <th className="p-4 font-semibold text-gray-600">النوع</th>
                  <th className="p-4 font-semibold text-gray-600">تاريخ التسجيل</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((patient) => (
                  <tr key={`${patient.source}-${patient.id}`} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-emerald-600 text-lg">{patient.patient_code || '---'}</td>
                    <td className="p-4">
                      <div className="font-bold text-gray-800">{patient.name || '---'}</div>
                    </td>
                    <td className="p-4 text-gray-600"><span dir="ltr">{patient.phone || 'غير مسجل'}</span></td>
                    <td className="p-4">
                      {patient.source === 'registered' ? (
                        <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">مسجّل بالتطبيق</span>
                      ) : (
                        <span className="text-xs font-bold bg-orange-100 text-orange-800 px-2 py-1 rounded">زيارة مباشرة</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-500 text-sm">{new Date(patient.created_at).toLocaleDateString('ar-EG')}</td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">لا يوجد مرضى مطابقين</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && <Pagination page={safePage} pageSize={PAGE_SIZE} total={filteredPatients.length} onPageChange={setPage} isLoading={loading} />}
      </CardContent>

      {showImportModal && (
        <BulkPatientImportModal
          onClose={() => setShowImportModal(false)}
          onImported={fetchPatients}
        />
      )}
    </Card>
  );
}
