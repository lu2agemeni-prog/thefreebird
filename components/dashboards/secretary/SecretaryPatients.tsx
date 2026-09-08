'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Loader2 } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { getFriendlyErrorMessage } from '@/lib/errors';

const PAGE_SIZE = 10;
const FETCH_CAP = 2000;

export function SecretaryPatients() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'patient')
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP);

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل قائمة المرضى.'));
    } else if (data) {
      setPatients(data);
    }
    setLoading(false);
  };

  const filteredPatients = useMemo(() => patients.filter(p =>
    (p.first_name + ' ' + p.last_name).toLowerCase().includes(search.toLowerCase()) ||
    (p.patient_code && p.patient_code.toLowerCase().includes(search.toLowerCase())) ||
    (p.phone && p.phone.includes(search))
  ), [patients, search]);

  useEffect(() => { setPage(0); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filteredPatients.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">دليل المرضى المسجلين</h2>
      </div>

      <div className="mb-6 max-w-md">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="بحث بالاسم، الكود، أو رقم الهاتف..."
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
          ) : loadError ? (
            <div className="p-6"><ErrorState message={loadError} onRetry={fetchPatients} compact /></div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-bold">
              {search ? 'لا توجد نتائج مطابقة للبحث.' : 'لا يوجد مرضى مسجلون بعد'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="p-4 font-semibold text-gray-600">كود المريض</th>
                      <th className="p-4 font-semibold text-gray-600">الاسم</th>
                      <th className="p-4 font-semibold text-gray-600">رقم الهاتف</th>
                      <th className="p-4 font-semibold text-gray-600">تاريخ التسجيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map(p => (
                      <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-bold text-sm">
                            {p.patient_code || 'غير محدد'}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-gray-800">
                          {p.first_name} {p.last_name}
                        </td>
                        <td className="p-4 text-gray-600" dir="ltr">
                          {p.phone || '---'}
                        </td>
                        <td className="p-4 text-gray-500 text-sm" dir="ltr">
                          {new Date(p.created_at).toLocaleDateString('ar-EG')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={safePage}
                pageSize={PAGE_SIZE}
                total={filteredPatients.length}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
