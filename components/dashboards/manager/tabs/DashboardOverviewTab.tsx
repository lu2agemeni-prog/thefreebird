'use client';

// ============================================================================
// components/dashboards/manager/tabs/DashboardOverviewTab.tsx
// تبويب "لوحة القيادة" — مستخرج من ManagerDashboard.tsx بنفس السلوك بالضبط
// (كانت بس بتعرض عدد العيادات؛ باقي الكروت "قريبًا"/ثابتة زي ما هي).
// عدد العيادات بقى بـ count: 'exact', head: true بدل جلب كل الصفوف كاملة
// بس عشان .length.
// ============================================================================
import { useState, useEffect } from 'react';
import { Stethoscope, Building, Users, Calculator } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">{icon}</div>
      </CardContent>
    </Card>
  );
}

export function DashboardOverviewTab() {
  const [clinicsCount, setClinicsCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('clinics').select('*', { count: 'exact', head: true }).then(({ count }) => {
      setClinicsCount(count ?? 0);
    });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard title="إجمالي الأطباء" value="قريباً" icon={<Stethoscope />} />
      <StatCard title="العيادات النشطة" value={clinicsCount === null ? '...' : clinicsCount.toString()} icon={<Building />} />
      <StatCard title="مرضى اليوم" value="0" icon={<Users />} />
      <StatCard title="إيرادات اليوم" value="0 ج.م" icon={<Calculator />} />
    </div>
  );
}
