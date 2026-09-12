'use client';

// ============================================================================
// components/dashboards/manager/tabs/DoctorsTab.tsx
// تبويب "الأطباء" — مستخرج من ManagerDashboard.tsx بنفس السلوك بالضبط
// (جدول doctors/clinics صغير نسبيًا وRLS عليه "viewable by everyone"، فمفيش
// داعي حقيقي لترقيم سيرفر هنا زي profiles/transactions).
// ============================================================================
import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { UserPlus, Link2, X, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { DoctorDetail } from '../DoctorDetail';

const FETCH_CAP = 2000;
const PAGE_SIZE = 10;

function getRoleLabel(role: string) {
  switch (role) {
    case 'manager': return 'مدير';
    case 'doctor': return 'طبيب';
    case 'secretary': return 'سكرتارية';
    case 'accountant': return 'محاسب';
    case 'patient': return 'مريض';
    default: return role;
  }
}

export function DoctorsTab() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedDoctor, setSelectedDoctor] = useState<any | null>(null);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('profiles').select('*, doctor:doctors(*)').eq('role', 'doctor').limit(FETCH_CAP);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل قائمة الأطباء.'));
    else setDoctors(data || []);
    setLoading(false);
  }, []);

  const fetchClinics = useCallback(async () => {
    const { data } = await supabase.from('clinics').select('*').limit(FETCH_CAP);
    setClinics(data || []);
  }, []);

  useEffect(() => { fetchDoctors(); fetchClinics(); }, [fetchDoctors, fetchClinics]);
  useEffect(() => { setPage(0); }, [search]);

  const filteredDoctors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter(d => `${d.first_name} ${d.last_name}`.toLowerCase().includes(q) || (d.phone && d.phone.toLowerCase().includes(q)));
  }, [doctors, search]);

  const safePage = Math.min(page, Math.max(0, Math.ceil(filteredDoctors.length / PAGE_SIZE) - 1));

  // ==== إضافة طبيب جديد + ربطه بحساب مستخدم ====
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [linkableUsers, setLinkableUsers] = useState<any[]>([]);
  const [linkableSearch, setLinkableSearch] = useState('');
  const [linkUsersLoading, setLinkUsersLoading] = useState(false);
  const [addDoctorUserId, setAddDoctorUserId] = useState('');
  const [addDoctorSpecialty, setAddDoctorSpecialty] = useState('');
  const [addDoctorFee, setAddDoctorFee] = useState('');
  const [addDoctorClinicId, setAddDoctorClinicId] = useState('');
  const [addingDoctor, setAddingDoctor] = useState(false);
  const [addDoctorError, setAddDoctorError] = useState<string | null>(null);
  const [addDoctorOk, setAddDoctorOk] = useState<string | null>(null);

  const filteredLinkableUsers = useMemo(() => {
    const q = linkableSearch.trim().toLowerCase();
    if (!q) return linkableUsers;
    return linkableUsers.filter(u =>
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) || (u.phone && u.phone.toLowerCase().includes(q))
    );
  }, [linkableUsers, linkableSearch]);

  const fetchLinkableUsers = async () => {
    setLinkUsersLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, phone, role')
      .neq('role', 'doctor')
      .order('created_at', { ascending: false })
      .limit(500);
    setLinkUsersLoading(false);
    if (error) setAddDoctorError(getFriendlyErrorMessage(error, 'تعذر تحميل الحسابات المتاحة.'));
    else setLinkableUsers(data || []);
  };

  const openAddDoctor = () => {
    setShowAddDoctor(true);
    setAddDoctorError(null);
    setAddDoctorOk(null);
    setAddDoctorUserId('');
    setAddDoctorSpecialty('');
    setAddDoctorFee('');
    setAddDoctorClinicId('');
    fetchLinkableUsers();
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddDoctorError(null);
    setAddDoctorOk(null);
    if (!addDoctorUserId) {
      setAddDoctorError('يرجى اختيار حساب المستخدم الذي سيصبح طبيبًا.');
      return;
    }
    setAddingDoctor(true);
    try {
      const { error: roleErr } = await supabase.from('profiles').update({ role: 'doctor' }).eq('id', addDoctorUserId);
      if (roleErr) throw roleErr;

      const { error: docErr } = await supabase.from('doctors').upsert([{
        profile_id: addDoctorUserId,
        specialty: addDoctorSpecialty.trim() || null,
        consultation_fee: addDoctorFee && !isNaN(Number(addDoctorFee)) ? Number(addDoctorFee) : null,
        clinic_id: addDoctorClinicId || null,
      }]);
      if (docErr) throw docErr;

      if (addDoctorClinicId) {
        const { error: linkErr } = await supabase
          .from('doctor_clinics')
          .insert([{ doctor_id: addDoctorUserId, clinic_id: addDoctorClinicId, is_primary: true }]);
        if (linkErr && linkErr.code !== 'PGRST106' && linkErr.code !== '42P01') {
          console.warn('doctor_clinics insert skipped:', linkErr.message);
        }
      }

      setAddDoctorOk('تمت إضافة الطبيب وربطه بالحساب بنجاح. اضغط على كارته لملء بقية البيانات.');
      fetchDoctors();
    } catch (err) {
      setAddDoctorError(getFriendlyErrorMessage(err, 'تعذر إضافة الطبيب.'));
    } finally {
      setAddingDoctor(false);
    }
  };

  if (selectedDoctor) {
    return (
      <DoctorDetail
        doctor={selectedDoctor}
        clinics={clinics}
        onBack={() => setSelectedDoctor(null)}
        onChanged={fetchDoctors}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>أطباء المركز</CardTitle>
            <CardDescription>اضغط على كارت الطبيب لتعديل بياناته وتخصيص عياداته وعرض تقاريره</CardDescription>
          </div>
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="w-full md:w-64">
              <SearchInput value={search} onValueChange={setSearch} placeholder="ابحث باسم الطبيب أو الهاتف..." />
            </div>
            <button onClick={openAddDoctor} className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 whitespace-nowrap">
              <UserPlus className="w-5 h-5" />
              إضافة طبيب + ربط حساب
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && <ErrorState message={error} onRetry={fetchDoctors} compact />}

        {showAddDoctor && (
          <form onSubmit={handleAddDoctor} className="mb-6 bg-emerald-50/60 border border-emerald-100 p-4 rounded-xl space-y-4">
            <h4 className="font-bold text-emerald-800 flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              إضافة طبيب جديد وربطه بحساب مستخدم
            </h4>
            <p className="text-xs text-gray-500">
              اختر حسابًا قائمًا (مريض / سكرتارية / محاسب) وسيتمت ترقيته إلى دور "طبيب" وإنشاء ملفه الطبي.
              لإنشاء حساب جديد تمامًا: أنشئه من صفحة الدخول ثم عُد هنا لربطه.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الحساب المرشح للترقية</label>
                <select value={addDoctorUserId} onChange={(e) => setAddDoctorUserId(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm" required>
                  <option value="">-- اختر حساب المستخدم --</option>
                  {filteredLinkableUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} — {getRoleLabel(u.role || 'patient')} — {u.phone || 'بدون هاتف'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">بحث سريع (تصفية القائمة)</label>
                <input
                  type="text"
                  value={linkableSearch}
                  onChange={(e) => setLinkableSearch(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-sm"
                  placeholder="ابحث بالاسم أو رقم الهاتف..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">التخصص</label>
                <input type="text" value={addDoctorSpecialty} onChange={(e) => setAddDoctorSpecialty(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm" placeholder="مثال: باطنة" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">سعر الكشف (ج.م)</label>
                <input type="number" min="0" value={addDoctorFee} onChange={(e) => setAddDoctorFee(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm" placeholder="250" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">العيادة الأساسية (اختياري)</label>
                <select value={addDoctorClinicId} onChange={(e) => setAddDoctorClinicId(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm">
                  <option value="">-- بدون عيادة --</option>
                  {clinics.map(clinic => (
                    <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {linkUsersLoading && <p className="text-sm text-gray-500">جاري تحميل الحسابات...</p>}
            {addDoctorError && <InlineError message={addDoctorError} />}
            {addDoctorOk && (
              <p className="text-sm text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2">
                {addDoctorOk}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={addingDoctor} className="bg-emerald-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50">
                {addingDoctor ? <Loader2 className="w-5 h-5 animate-spin" /> : <Link2 className="w-5 h-5" />}
                إضافة وربط
              </button>
              <button type="button" onClick={() => setShowAddDoctor(false)} className="border border-gray-200 text-gray-600 font-bold px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                <X className="w-5 h-5" /> إلغاء
              </button>
            </div>
          </form>
        )}

        {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDoctors.length === 0 ? (
              <p className="text-gray-500">لا يوجد أطباء مسجلين. استخدم زر "إضافة طبيب + ربط حساب" بالأعلى.</p>
            ) : filteredDoctors.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE).map((doc) => (
              <button
                key={doc.id}
                onClick={() => setSelectedDoctor(doc)}
                className="text-right border p-4 rounded-xl flex items-center gap-4 bg-white shadow-sm hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer"
              >
                {doc.avatar_url ? (
                  <Image src={doc.avatar_url} alt="" width={64} height={64} className="w-16 h-16 rounded-full object-cover" unoptimized={false} />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xl font-bold">
                    {doc.first_name?.[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-lg">د. {doc.first_name} {doc.last_name}</h4>
                  <p className="text-gray-500 text-sm truncate">{doc.doctor?.specialty || doc.phone || 'بدون تخصص'}</p>
                  <span className="inline-block mt-2 text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">
                    {doc.doctor ? 'ملف طبي مكتمل' : 'يلزم إكمال الملف'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
        {!loading && <Pagination page={safePage} pageSize={PAGE_SIZE} total={filteredDoctors.length} onPageChange={setPage} isLoading={loading} />}
      </CardContent>
    </Card>
  );
}
