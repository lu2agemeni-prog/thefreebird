'use client';

// ============================================================================
// components/dashboards/secretary/PatientVisitsHistory.tsx
// سجل الزيارات القديمة — مجمّعة حسب جلسة الزيارة (visit_group_id)، مع
// إمكانية تعديل/حذف كل خدمة لوحدها، وإضافة خدمة جديدة لنفس الزيارة.
// ============================================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarClock, Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { AddPastVisitModal } from './AddPastVisitModal';

const PAGE_SIZE = 8;
const FETCH_CAP = 1000;

interface VisitRow {
  id: string;
  patient_id: string | null;
  walk_in_patient_id: string | null;
  patient_name: string;
  visit_date: string;
  service_id: string | null;
  service_name: string | null;
  clinic_id: string | null;
  doctor_id: string | null;
  paid_amount: number;
  visit_group_id: string;
  clinics?: { name: string } | null;
  doctor?: { first_name: string; last_name: string } | null;
}

export function PatientVisitsHistory() {
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const [editingVisit, setEditingVisit] = useState<VisitRow | null>(null);
  const [addingServiceToGroup, setAddingServiceToGroup] = useState<{
    visitGroupId: string; patient: any; visitDate: string; clinicId: string | null; doctorId: string | null;
  } | null>(null);

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('patient_visits')
      .select('*, clinics(name), doctor:doctor_id(first_name, last_name)')
      .order('visit_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل سجل الزيارات.'));
    else setVisits((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);
  useEffect(() => { setPage(0); }, [search]);

  // تجميع الصفوف حسب جلسة الزيارة (نفس visit_group_id = نفس زيارة، خدمات متعددة)
  const groups = useMemo(() => {
    const map = new Map<string, VisitRow[]>();
    visits.forEach(v => {
      const key = v.visit_group_id || v.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    });
    return Array.from(map.entries()).map(([groupId, rows]) => ({ groupId, rows, first: rows[0] }));
  }, [visits]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g => g.first.patient_name.toLowerCase().includes(q));
  }, [groups, search]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageGroups = filteredGroups.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذه الخدمة من الزيارة؟')) return;
    await supabase.from('patient_visits').delete().eq('id', id);
    fetchVisits();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5 text-emerald-600" /> سجل الزيارات القديمة</CardTitle>
          </div>
          <div className="w-full md:w-72">
            <SearchInput value={search} onValueChange={setSearch} placeholder="ابحث باسم المريض..." />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && <ErrorState message={error} onRetry={fetchVisits} compact />}
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : pageGroups.length === 0 ? (
          <p className="text-center text-gray-500 py-8">لا توجد زيارات قديمة مسجلة بعد.</p>
        ) : (
          <div className="space-y-4">
            {pageGroups.map(({ groupId, rows, first }) => {
              const total = rows.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
              return (
                <div key={groupId} className="border rounded-xl overflow-hidden">
                  <div className="bg-gray-50 border-b p-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-gray-800">{first.patient_name}</span>
                      <span className="text-xs text-gray-400 mr-2">{new Date(first.visit_date).toLocaleDateString('ar-EG')}</span>
                      {first.clinics?.name && <span className="text-xs text-gray-400 mr-2">— {first.clinics.name}</span>}
                      {first.doctor && <span className="text-xs text-gray-400 mr-2">— د. {first.doctor.first_name} {first.doctor.last_name}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600" dir="ltr">{total.toLocaleString()} ج.م</span>
                      <button
                        onClick={() => setAddingServiceToGroup({
                          visitGroupId: groupId,
                          patient: { id: first.patient_id || first.walk_in_patient_id, name: first.patient_name, phone: null, source: first.patient_id ? 'registered' : 'walk_in' },
                          visitDate: first.visit_date,
                          clinicId: first.clinic_id,
                          doctorId: first.doctor_id,
                        })}
                        className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100"
                      >
                        <Plus className="w-3.5 h-3.5" /> إضافة خدمة لنفس الزيارة
                      </button>
                    </div>
                  </div>
                  <div className="divide-y">
                    {rows.map(r => (
                      <div key={r.id} className="p-3 flex items-center justify-between text-sm">
                        <span className="text-gray-700">{r.service_name || 'بدون تحديد خدمة'}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold" dir="ltr">{r.paid_amount} ج.م</span>
                          <button onClick={() => setEditingVisit(r)} className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                            <Pencil className="w-4 h-4" /> تعديل
                          </button>
                          <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700 font-bold flex items-center gap-1">
                            <Trash2 className="w-4 h-4" /> حذف
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!loading && <Pagination page={safePage} pageSize={PAGE_SIZE} total={filteredGroups.length} onPageChange={setPage} isLoading={loading} />}
      </CardContent>

      {editingVisit && (
        <AddPastVisitModal
          editVisit={editingVisit}
          onClose={() => setEditingVisit(null)}
          onAdded={fetchVisits}
        />
      )}

      {addingServiceToGroup && (
        <AddPastVisitModal
          addServiceTo={addingServiceToGroup}
          onClose={() => setAddingServiceToGroup(null)}
          onAdded={fetchVisits}
        />
      )}
    </Card>
  );
}
