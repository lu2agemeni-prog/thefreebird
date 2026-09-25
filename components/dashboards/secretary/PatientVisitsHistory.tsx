'use client';

// ============================================================================
// components/dashboards/secretary/PatientVisitsHistory.tsx
// سجل الزيارات — مجمّعة حسب جلسة الزيارة (visit_group_id)، مع إمكانية
// تعديل/حذف كل خدمة لوحدها، وإضافة خدمة جديدة لنفس الجلسة.
//
// الفلاتر المتاحة:
//   • بحث بالاسم (الافتراضي).
//   • فلتر العيادة (dropdown).
//   • فلتر الطبيب (dropdown).
//
// الترتيب: حسب تاريخ الزيارة (visit_date) تنازليًا، ثم تاريخ التسجيل
// (created_at) تنازليًا — زي ما طلب المستخدم. ده مهم خصوصًا في التقارير
// القديمة: لو دخلت زيارات بترتيب مختلف عن الإدخال، التاريخ الصح هو
// تاريخ الزيارة.
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarClock, Pencil, Trash2, Plus, Loader2, Building, Stethoscope, Calendar, ChevronRight, ChevronLeft, CalendarDays, CalendarRange } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { AddVisitModal } from './AddVisitModal';

const PAGE_SIZE = 8;
const FETCH_CAP = 1000;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDateStr(dateStr: string, deltaDays: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('ar-EG', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

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
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [clinicFilter, setClinicFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  // وضع التصفح: يوم واحد بالتنقل بين الأيام (الافتراضي)، أو نطاق تاريخ مخصص
  const [browseMode, setBrowseMode] = useState<'day' | 'range'>('day');
  const [selectedDay, setSelectedDay] = useState(todayStr());
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [page, setPage] = useState(0);

  // التنقل بين الأيام — بيحدّث dateFrom/dateTo مع بعض عشان يفضل الفلتر
  // الفعلي (المُستخدم في filteredGroups) مصدر واحد للحقيقة
  const goToDay = (day: string) => {
    setSelectedDay(day);
    setDateFrom(day);
    setDateTo(day);
  };
  const shiftDay = (delta: number) => goToDay(shiftDateStr(selectedDay, delta));
  const switchToDayMode = () => { setBrowseMode('day'); goToDay(todayStr()); };
  const switchToRangeMode = () => { setBrowseMode('range'); setDateFrom(''); setDateTo(''); };

  const [editingVisit, setEditingVisit] = useState<VisitRow | null>(null);
  const [addingServiceToGroup, setAddingServiceToGroup] = useState<{
    visitGroupId: string; patient: any; visitDate: string; clinicId: string | null; doctorId: string | null;
  } | null>(null);

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    setError(null);
    // الترتيب: حسب تاريخ الزيارة (الأهم) ثم تاريخ التسجيل
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

  const fetchFiltersOptions = useCallback(async () => {
    const [clinicsRes, docsRes] = await Promise.all([
      supabase.from('clinics').select('id, name').order('name'),
      supabase.from('profiles').select('id, first_name, last_name').eq('role', 'doctor').order('first_name'),
    ]);
    if (clinicsRes.data) setClinics(clinicsRes.data);
    if (docsRes.data) {
      setDoctors(docsRes.data.map((d: any) => ({
        id: d.id,
        name: `د. ${d.first_name || ''} ${d.last_name || ''}`.trim(),
      })));
    }
  }, []);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);
  useEffect(() => { fetchFiltersOptions(); }, [fetchFiltersOptions]);
  useEffect(() => { setPage(0); }, [search, clinicFilter, doctorFilter, dateFrom, dateTo]);

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
    return groups.filter(g => {
      // فلتر الاسم
      if (q && !g.first.patient_name.toLowerCase().includes(q)) return false;
      // فلتر العيادة
      if (clinicFilter && g.first.clinic_id !== clinicFilter) return false;
      // فلتر الطبيب
      if (doctorFilter && g.first.doctor_id !== doctorFilter) return false;
      // فلتر التاريخ (من - إلى)
      const visitDateOnly = (g.first.visit_date || '').slice(0, 10);
      if (dateFrom && visitDateOnly < dateFrom) return false;
      if (dateTo && visitDateOnly > dateTo) return false;
      return true;
    });
  }, [groups, search, clinicFilter, doctorFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageGroups = filteredGroups.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // عدّاد الفلاتر النشطة عشان يبان للمستخدم إن فيه فلتر شغّال (نطاق
  // التاريخ في وضع التصفح اليومي مش "فلتر" — هو أصل الشاشة)
  const activeFiltersCount = (clinicFilter ? 1 : 0) + (doctorFilter ? 1 : 0) + (browseMode === 'range' && (dateFrom || dateTo) ? 1 : 0);

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذه الخدمة من الزيارة؟')) return;
    await supabase.from('patient_visits').delete().eq('id', id);
    fetchVisits();
  };

  const resetFilters = () => {
    setSearch('');
    setClinicFilter('');
    setDoctorFilter('');
    switchToDayMode();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-emerald-600" /> سجل الزيارات
            </CardTitle>
            <div className="w-full md:w-72">
              <SearchInput value={search} onValueChange={setSearch} placeholder="ابحث باسم المريض..." />
            </div>
          </div>

          {/* شريط الفلاتر */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center flex-wrap">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
              <Building className="w-4 h-4" />
              <select
                value={clinicFilter}
                onChange={(e) => setClinicFilter(e.target.value)}
                className="border rounded-lg p-2 text-sm bg-white min-w-[180px]"
              >
                <option value="">كل العيادات</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
              <Stethoscope className="w-4 h-4" />
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="border rounded-lg p-2 text-sm bg-white min-w-[180px]"
              >
                <option value="">كل الأطباء</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {activeFiltersCount > 0 && (
              <button
                onClick={resetFilters}
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                مسح الفلاتر ({activeFiltersCount})
              </button>
            )}
          </div>

          {/* وضع التصفح: يوم واحد (افتراضي) أو نطاق مخصص */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center flex-wrap border-t pt-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              <button
                onClick={switchToDayMode}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${browseMode === 'day' ? 'bg-white shadow text-emerald-700' : 'text-gray-500'}`}
              >
                <CalendarDays className="w-3.5 h-3.5" /> تصفح يومي
              </button>
              <button
                onClick={switchToRangeMode}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${browseMode === 'range' ? 'bg-white shadow text-emerald-700' : 'text-gray-500'}`}
              >
                <CalendarRange className="w-3.5 h-3.5" /> نطاق مخصص
              </button>
            </div>

            {browseMode === 'day' ? (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => shiftDay(-1)}
                  className="p-2 rounded-lg border bg-white hover:bg-gray-50 text-gray-600"
                  title="اليوم السابق"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => goToDay(e.target.value)}
                  className="border rounded-lg p-2 text-sm bg-white"
                />
                <button
                  onClick={() => shiftDay(1)}
                  className="p-2 rounded-lg border bg-white hover:bg-gray-50 text-gray-600"
                  title="اليوم التالي"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {selectedDay !== todayStr() && (
                  <button
                    onClick={() => goToDay(todayStr())}
                    className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100"
                  >
                    اليوم
                  </button>
                )}
                <span className="text-sm font-bold text-gray-700">{formatDayLabel(selectedDay)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
                <Calendar className="w-4 h-4" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  max={dateTo || undefined}
                  className="border rounded-lg p-2 text-sm bg-white"
                  title="من تاريخ"
                />
                <span className="text-gray-400">إلى</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom || undefined}
                  className="border rounded-lg p-2 text-sm bg-white"
                  title="إلى تاريخ"
                />
              </div>
            )}

            <span className="text-xs text-gray-400 md:mr-auto">
              الترتيب: حسب تاريخ الزيارة (الأحدث أولًا)
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && <ErrorState message={error} onRetry={fetchVisits} compact />}
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : pageGroups.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {search || clinicFilter || doctorFilter
              ? 'لا توجد زيارات مطابقة للفلاتر المحددة.'
              : browseMode === 'day'
              ? `لا توجد زيارات مسجلة في ${formatDayLabel(selectedDay)}.`
              : dateFrom || dateTo
              ? 'لا توجد زيارات مطابقة للفلاتر المحددة.'
              : 'لا توجد زيارات مسجلة بعد.'}
          </p>
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
        <AddVisitModal
          editVisit={editingVisit}
          onClose={() => setEditingVisit(null)}
          onAdded={fetchVisits}
        />
      )}

      {addingServiceToGroup && (
        <AddVisitModal
          addServiceTo={addingServiceToGroup}
          onClose={() => setAddingServiceToGroup(null)}
          onAdded={fetchVisits}
        />
      )}
    </Card>
  );
}