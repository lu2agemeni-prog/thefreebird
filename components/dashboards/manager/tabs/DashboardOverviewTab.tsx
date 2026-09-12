'use client';

// ============================================================================
// components/dashboards/manager/tabs/DashboardOverviewTab.tsx
// تبويب "لوحة القيادة" — الكروت الأربعة بقت كلها بأرقام حقيقية بدل
// "قريباً"/أصفار ثابتة (إجمالي الأطباء، العيادات النشطة، مرضى اليوم،
// إيرادات اليوم).
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
  const [doctorsCount, setDoctorsCount] = useState<number | null>(null);
  const [clinicsCount, setClinicsCount] = useState<number | null>(null);
  const [patientsToday, setPatientsToday] = useState<number | null>(null);
  const [revenueToday, setRevenueToday] = useState<number | null>(null);

  useEffect(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'doctor')
      .then(({ count }) => setDoctorsCount(count ?? 0));

    supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('is_active', true)
      .then(({ count }) => setClinicsCount(count ?? 0));

    supabase.from('call_queue').select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString())
      .then(({ count }) => setPatientsToday(count ?? 0));

    supabase.from('transactions').select('amount').eq('type', 'income')
      .gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString())
      .then(({ data }) => setRevenueToday((data || []).reduce((sum, r: any) => sum + Number(r.amount || 0), 0)));
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard title="إجمالي الأطباء" value={doctorsCount === null ? '...' : doctorsCount.toString()} icon={<Stethoscope />} />
      <StatCard title="العيادات النشطة" value={clinicsCount === null ? '...' : clinicsCount.toString()} icon={<Building />} />
      <StatCard title="مرضى اليوم" value={patientsToday === null ? '...' : patientsToday.toString()} icon={<Users />} />
      <StatCard title="إيرادات اليوم" value={revenueToday === null ? '...' : `${revenueToday.toLocaleString()} ج.م`} icon={<Calculator />} />
    </div>
  );
}
