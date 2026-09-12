'use client';

// ============================================================================
// components/dashboards/manager/tabs/MedicalRecordsTab.tsx
// تبويب "الملفات الطبية" — مستخرج من ManagerDashboard.tsx، وبقى بيستخدم
// /api/manager/profiles?role=patient بترقيم حقيقي بدل سحب 2000 صف.
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { authFetchJson } from '@/lib/api-client';

const PAGE_SIZE = 10;

export function MedicalRecordsTab() {
  const [patients, setPatients] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), role: 'patient' });
    if (search.trim()) params.set('q', search.trim());
    const { data, error } = await authFetchJson(`/api/manager/profiles?${params.toString()}`);
    if (error) setError(error);
    else {
      setPatients(data.rows || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);
  useEffect(() => { setPage(0); }, [search]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>الملفات الطبية للمرضى</CardTitle>
            <CardDescription>بحث واستعراض ملفات المرضى المسجلين</CardDescription>
          </div>
          <div className="w-full md:w-80">
            <SearchInput value={search} onValueChange={setSearch} placeholder="ابحث بالاسم، رقم التليفون، أو الكود..." />
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
                  <th className="p-4 font-semibold text-gray-600">تاريخ التسجيل</th>
                  <th className="p-4 font-semibold text-gray-600">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-emerald-600 text-lg">{patient.patient_code || '---'}</td>
                    <td className="p-4">
                      <div className="font-bold text-gray-800">{patient.first_name} {patient.last_name}</div>
                    </td>
                    <td className="p-4 text-gray-600"><span dir="ltr">{patient.phone || 'غير مسجل'}</span></td>
                    <td className="p-4 text-gray-500 text-sm">{new Date(patient.created_at).toLocaleDateString('ar-EG')}</td>
                    <td className="p-4">
                      <button className="text-emerald-600 hover:text-emerald-800 text-sm font-bold bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
                        عرض الملف
                      </button>
                    </td>
                  </tr>
                ))}
                {patients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">لا يوجد مرضى مطابقين</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} isLoading={loading} />}
      </CardContent>
    </Card>
  );
}
