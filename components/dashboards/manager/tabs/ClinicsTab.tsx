'use client';

// ============================================================================
// components/dashboards/manager/tabs/ClinicsTab.tsx
// تبويب "العيادات" — مستخرج من ManagerDashboard.tsx بنفس السلوك بالضبط.
// ============================================================================
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Building, Plus, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { ClinicDetail } from '../ClinicDetail';

const FETCH_CAP = 2000;
const PAGE_SIZE = 10;

export function ClinicsTab() {
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedClinic, setSelectedClinic] = useState<any | null>(null);

  const [newClinicName, setNewClinicName] = useState('');
  const [newClinicDesc, setNewClinicDesc] = useState('');
  const [addingClinic, setAddingClinic] = useState(false);
  const [addClinicError, setAddClinicError] = useState<string | null>(null);

  const fetchClinics = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('clinics').select('*').limit(FETCH_CAP);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل العيادات.'));
    else setClinics(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClinics(); }, [fetchClinics]);
  useEffect(() => { setPage(0); }, [search]);

  const filteredClinics = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clinics;
    return clinics.filter(c => (c.name || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));
  }, [clinics, search]);

  const safePage = Math.min(page, Math.max(0, Math.ceil(filteredClinics.length / PAGE_SIZE) - 1));

  const handleAddClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddClinicError(null);
    if (!newClinicName.trim()) {
      setAddClinicError('يرجى إدخال اسم العيادة.');
      return;
    }
    setAddingClinic(true);
    const { error } = await supabase.from('clinics').insert([{ name: newClinicName.trim(), description: newClinicDesc.trim() || 'تمت إضافتها حديثًا' }]);
    setAddingClinic(false);
    if (error) {
      setAddClinicError(getFriendlyErrorMessage(error, 'تعذر إضافة العيادة.'));
    } else {
      setNewClinicName('');
      setNewClinicDesc('');
      fetchClinics();
    }
  };

  if (selectedClinic) {
    return <ClinicDetail clinic={selectedClinic} onBack={() => setSelectedClinic(null)} onChanged={fetchClinics} />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>العيادات والتخصصات</CardTitle>
          <CardDescription>اضغط على كارت العيادة لعرض تقاريرها وأطبائها وتعديل بياناتها</CardDescription>
        </div>
        <div className="mt-3 max-w-md">
          <SearchInput value={search} onValueChange={setSearch} placeholder="ابحث باسم العيادة أو الوصف..." />
        </div>
      </CardHeader>
      <CardContent>
        {error && <ErrorState message={error} onRetry={fetchClinics} compact />}
        <form onSubmit={handleAddClinic} className="mb-6 flex flex-col md:flex-row gap-3 items-end bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-gray-500 mb-1">اسم العيادة الجديدة</label>
            <input
              type="text"
              value={newClinicName}
              onChange={(e) => setNewClinicName(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm"
              placeholder="مثال: عيادة الأسنان"
              required
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-gray-500 mb-1">الوصف (اختياري)</label>
            <input
              type="text"
              value={newClinicDesc}
              onChange={(e) => setNewClinicDesc(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm"
              placeholder="وصف مختصر للعيادة..."
            />
          </div>
          <button type="submit" disabled={addingClinic} className="bg-emerald-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 h-[42px] whitespace-nowrap">
            {addingClinic ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            إضافة عيادة
          </button>
          {addClinicError && <div className="w-full"><InlineError message={addClinicError} /></div>}
        </form>

        {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredClinics.length === 0 ? (
              <p className="text-gray-500">لا توجد عيادات. اضغط على الزر أعلاه لإضافة عيادة.</p>
            ) : filteredClinics.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE).map((clinic) => (
              <button
                key={clinic.id}
                onClick={() => setSelectedClinic(clinic)}
                className="text-right border p-4 rounded-xl flex items-center justify-between bg-white shadow-sm hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer w-full"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <Building className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{clinic.name}</h4>
                    <p className="text-gray-500 text-sm">{clinic.description || 'بدون وصف'}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${clinic.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {clinic.is_active ? 'نشطة' : 'غير نشطة'}
                </span>
              </button>
            ))}
          </div>
        )}
        {!loading && <Pagination page={safePage} pageSize={PAGE_SIZE} total={filteredClinics.length} onPageChange={setPage} isLoading={loading} />}
      </CardContent>
    </Card>
  );
}
