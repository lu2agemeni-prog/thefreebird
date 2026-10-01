'use client';

// ============================================================================
// components/dashboards/manager/tabs/DashboardOverviewTab.tsx
// تبويب "لوحة القيادة" — الكروت الأربعة بقت كلها بأرقام حقيقية بدل
// "قريباً"/أصفار ثابتة (إجمالي الأطباء، العيادات النشطة، مرضى اليوم،
// إيرادات اليوم).
// ============================================================================
import { useState, useEffect } from 'react';
import { Stethoscope, Building, Users, Calculator, BellRing, ArrowLeft, CheckCircle2 } from 'lucide-react';
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

interface DashboardOverviewTabProps {
  onNavigateTab?: (tabId: string) => void;
}

export function DashboardOverviewTab({ onNavigateTab }: DashboardOverviewTabProps) {
  const [doctorsCount, setDoctorsCount] = useState<number | null>(null);
  const [clinicsCount, setClinicsCount] = useState<number | null>(null);
  const [patientsToday, setPatientsToday] = useState<number | null>(null);
  const [revenueToday, setRevenueToday] = useState<number | null>(null);
  const [upcoming24hCount, setUpcoming24hCount] = useState<number | null>(null);

  useEffect(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'doctor')
      .then(({ count }) => setDoctorsCount(count ?? 0));

    supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('is_active', true)
      .then(({ count }) => setClinicsCount(count ?? 0));

    supabase.from('call_queue').select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString())
      .then(({ count }) => setPatientsToday(count ?? 0));

    supabase.from('appointments').select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'confirmed'])
      .gte('appointment_date', now.toISOString())
      .lte('appointment_date', next24h.toISOString())
      .then(({ count }) => setUpcoming24hCount(count ?? 0));

    supabase.from('transactions').select('amount, clinic_id, created_at').eq('type', 'income')
      .gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString())
      .then(({ data }) => {
        const rows = data || [];
        const validRows: any[] = [];
        rows.forEach((t) => {
          const curTime = t.created_at ? new Date(t.created_at).getTime() : 0;
          const isTwin = validRows.some((prev) => {
            if (Number(prev.amount) !== Number(t.amount)) return false;
            if (prev.clinic_id !== t.clinic_id) return false;
            const prevTime = prev.created_at ? new Date(prev.created_at).getTime() : 0;
            return Math.abs(curTime - prevTime) <= 15000;
          });
          if (!isTwin) validRows.push(t);
        });
        setRevenueToday(validRows.reduce((sum, r: any) => sum + Number(r.amount || 0), 0));
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="إجمالي الأطباء" value={doctorsCount === null ? '...' : doctorsCount.toString()} icon={<Stethoscope />} />
        <StatCard title="العيادات النشطة" value={clinicsCount === null ? '...' : clinicsCount.toString()} icon={<Building />} />
        <StatCard title="مرضى اليوم" value={patientsToday === null ? '...' : patientsToday.toString()} icon={<Users />} />
        <StatCard title="إيرادات اليوم" value={revenueToday === null ? '...' : `${revenueToday.toLocaleString()} ج.م`} icon={<Calculator />} />
      </div>

      {/* بطاقة التذكيرات الآلية للمواعيد (24 ساعة) */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-800 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-white/10 backdrop-blur-xs rounded-2xl border border-white/20 text-emerald-300">
            <BellRing className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-black">نظام تذكير المواعيد الآلي (SMS & Push)</h3>
              <span className="text-[11px] bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-bold">
                24 ساعة قبل الكشف
              </span>
            </div>
            <p className="text-sm text-emerald-100/90 leading-relaxed max-w-xl">
              إرسال تنبيهات تلقائية للمرضى عبر الإشعارات وتطبيق الهاتف ورسائل الـ SMS قبل 24 ساعة من موعد الحجز لتقليل التخلف عن الحضور بنسبة تتجاوز 40%.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <div className="bg-white/10 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-white/15 text-center min-w-[120px]">
            <span className="block text-[11px] text-emerald-200 font-semibold">مواعيد الـ 24 ساعة القادمة</span>
            <span className="text-2xl font-black text-white">
              {upcoming24hCount === null ? '...' : upcoming24hCount}
            </span>
          </div>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('appointment_reminders')}
              className="flex items-center gap-2 bg-white text-emerald-900 hover:bg-emerald-50 px-5 py-3 rounded-xl font-bold text-sm shadow-sm cursor-pointer transition-all hover:scale-[1.02]"
            >
              <span>إدارة وإرسال التذكيرات</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
