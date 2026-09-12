'use client';

// ============================================================================
// components/dashboards/manager/tabs/StaffManagementTab.tsx
// تبويب "صلاحيات المستخدمين" — مستخرج من ManagerDashboard.tsx.
// كان بيجيب لحد 2000 صف من profiles ويفلتر/يرقّم في المتصفح؛ دلوقتي بيستخدم
// /api/manager/profiles اللي بيعمل بحث وترقيم حقيقي على السيرفر (.range()).
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { supabase } from '@/lib/supabase';
import { authFetchJson } from '@/lib/api-client';
import { getFriendlyErrorMessage } from '@/lib/errors';

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

export function StaffManagementTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search.trim()) params.set('q', search.trim());
    const { data, error } = await authFetchJson(`/api/manager/profiles?${params.toString()}`);
    if (error) setError(error);
    else {
      setUsers(data.rows || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(0); }, [search]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (!error) {
      setUsers(users.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
    } else {
      setError(getFriendlyErrorMessage(error, 'تعذر تحديث الصلاحية.'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>إدارة صلاحيات المستخدمين</CardTitle>
        <CardDescription>التحكم في أدوار جميع المسجلين في النظام (مدير، طبيب، سكرتارية، محاسب، مريض)</CardDescription>
        <div className="mt-3 max-w-md">
          <SearchInput value={search} onValueChange={setSearch} placeholder="ابحث بالاسم أو الهاتف..." />
        </div>
      </CardHeader>
      <CardContent>
        {error && <ErrorState message={error} onRetry={fetchUsers} compact />}
        {loading ? (
          <p className="text-gray-500 py-4">جاري تحميل المستخدمين...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-4 font-semibold text-gray-600">الاسم</th>
                  <th className="p-4 font-semibold text-gray-600">معرف الحساب (ID)</th>
                  <th className="p-4 font-semibold text-gray-600">الدور الحالي</th>
                  <th className="p-4 font-semibold text-gray-600">تغيير الصلاحية</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium flex items-center gap-3">
                      {user.avatar_url ? (
                        <Image src={user.avatar_url} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                          {user.first_name?.[0]}
                        </div>
                      )}
                      {user.first_name} {user.last_name}
                    </td>
                    <td className="p-4 text-sm text-gray-500 font-mono">{user.id.substring(0, 8)}...</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        user.role === 'manager' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'doctor' ? 'bg-emerald-100 text-emerald-700' :
                        user.role === 'secretary' ? 'bg-orange-100 text-orange-700' :
                        user.role === 'accountant' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="p-4">
                      <select
                        value={user.role || 'patient'}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                      >
                        <option value="patient">مريض</option>
                        <option value="doctor">طبيب</option>
                        <option value="secretary">سكرتارية</option>
                        <option value="accountant">مسئول مالي</option>
                        <option value="manager">مدير</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">لا يوجد مستخدمين مطابقين</td>
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
