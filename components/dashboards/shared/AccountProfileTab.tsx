'use client';

// ============================================================================
// components/dashboards/shared/AccountProfileTab.tsx
// تبويب "الملف الشخصي" لأي دور مفيش له صفحة بروفايل مخصصة (مدير/سكرتارية/
// محاسب) — بيانات الحساب الأساسية + قسم حذف الحساب.
// ============================================================================
import Image from 'next/image';
import { User, Phone, Shield } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { AccountDangerZone } from '@/components/AccountDangerZone';

function getRoleLabel(role: string) {
  switch (role) {
    case 'manager': return 'مدير';
    case 'secretary': return 'سكرتارية';
    case 'accountant': return 'محاسب';
    case 'doctor': return 'طبيب';
    case 'patient': return 'مريض';
    default: return role;
  }
}

export function AccountProfileTab() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>الملف الشخصي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            {user?.avatar_url ? (
              <Image src={user.avatar_url} alt="" width={64} height={64} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-2xl font-bold">
                {user?.first_name?.[0]}
              </div>
            )}
            <div>
              <p className="text-lg font-bold text-gray-900">{user?.first_name} {user?.last_name}</p>
              <p className="text-sm text-gray-500">{getRoleLabel(user?.role || '')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg text-gray-500"><User className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-gray-400">الاسم الكامل</p>
                <p className="font-bold text-gray-800">{user?.first_name} {user?.last_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg text-gray-500"><Phone className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-gray-400">رقم الهاتف</p>
                <p className="font-bold text-gray-800" dir="ltr">{user?.phone || 'غير مسجل'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg text-gray-500"><Shield className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-gray-400">الدور</p>
                <p className="font-bold text-gray-800">{getRoleLabel(user?.role || '')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AccountDangerZone />
    </div>
  );
}
