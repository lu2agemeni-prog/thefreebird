'use client';

// ============================================================================
// components/dashboards/manager/tabs/PatientGuideTab.tsx
// تبويب "دليل المرضى" في حساب المدير.
//
// الوظيفة:
//   1. استعراض كل المرضى (مسجّلين بالتطبيق + زيارات مباشرة) في جدول
//      موحّد مع بحث وتصفّح.
//   2. زر «استيراد من إكسيل» — كان موجود في السكرتارية واتنقل هنا (المدير
//      هو اللي بيستورد البيانات التاريخية الكبيرة مرة واحدة).
//   3. شاشة «سجل الزيارات» مع تعديل/حذف/ضم خدمة لنفس الجلسة.
//   4. زر «إضافة زيارة» للمدير — نفس المودال الموحد اللي بتستخدمه السكرتارية
//      (AddVisitModal). المدير بيقدر يدخل بيانات يومية لوحده لو احتاج.
//
// الـ API تحت /api/manager/patients-import كان فعلاً مفعّل للمدير والسكرتارية
// معًا، فالنقل هنا مجرد نقل للواجهة (UI) — قاعدة البيانات والصلاحيات
// زي ما هي.
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Loader2, CalendarPlus, FileSpreadsheet, Database } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { AddVisitModal } from '../../secretary/AddVisitModal';
import { BulkPatientImportModal } from '../../shared/BulkPatientImportModal';
import { PatientVisitsHistory } from '../../secretary/PatientVisitsHistory';

const PAGE_SIZE = 15;
const FETCH_CAP = 2000;

interface UnifiedPatient {
  id: string;
  name: string;
  phone: string | null;
  patient_code: string | null;
  created_at: string;
  source: 'registered' | 'walk_in';
}

export function PatientGuideTab() {
  const [view, setView] = useState<'list' | 'history'>('list');
  const [patients, setPatients] = useState<UnifiedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showAddVisitModal, setShowAddVisitModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // إحصائيات سريعة فوق الجدول
  const stats = useMemo(() => {
    const total = patients.length;
    const registered = patients.filter(p => p.source === 'registered').length;
    const walkIns = patients.filter(p => p.source === 'walk_in').length;
    return { total, registered, walkIns };
  }, [patients]);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoadError(null);
    setLoading(true);

    const [profilesRes, walkInRes] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, phone, patient_code, created_at').eq('role', 'patient').order('created_at', { ascending: false }).limit(FETCH_CAP),
      supabase.from('walk_in_patients').select('id, name, phone, patient_code, created_at').order('created_at', { ascending: false }).limit(FETCH_CAP),
    ]);

    if (profilesRes.error) {
      setLoadError(getFriendlyErrorMessage(profilesRes.error, 'تعذر تحميل قائمة المرضى.'));
      setLoading(false);
      return;
    }

    const registered: UnifiedPatient[] = (profilesRes.data || []).map(p => ({
      id: p.id,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      phone: p.phone,
      patient_code: p.patient_code,
      created_at: p.created_at,
      source: 'registered' as const,
    }));

    const walkIns: UnifiedPatient[] = (walkInRes.data || []).map(p => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      patient_code: p.patient_code,
      created_at: p.created_at,
      source: 'walk_in' as const,
    }));

    const merged = [...registered, ...walkIns].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setPatients(merged);
    setLoading(false);
  };

  const filteredPatients = useMemo(() => patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.patient_code && p.patient_code.toLowerCase().includes(search.toLowerCase())) ||
    (p.phone && p.phone.includes(search))
  ), [patients, search]);

  useEffect(() => { setPage(0); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filteredPatients.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* العنوان + الأزرار */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-emerald-600" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">دليل المرضى</h2>
            <p className="text-sm text-gray-500 max-w-2xl">
              نقطة الدخول الموحدة لإدارة بيانات المرضى. استورد ملفات إكسيل، تصفّح الملفات، أو سجّل زيارات (يومية أو تاريخية).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-white border border-emerald-200 text-emerald-700 font-bold px-4 py-2.5 rounded-xl hover:bg-emerald-50 flex items-center gap-2 shadow-sm"
          >
            <FileSpreadsheet className="w-5 h-5" /> استيراد من إكسيل
          </button>
          <button
            onClick={() => setShowAddVisitModal(true)}
            className="bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-emerald-700 flex items-center gap-2 shadow-sm"
          >
            <CalendarPlus className="w-5 h-5" /> إضافة زيارة
          </button>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold">إجمالي المرضى</p>
              <p className="text-2xl font-black text-gray-800" dir="ltr">{stats.total.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold">مسجّلون بالتطبيق</p>
              <p className="text-2xl font-black text-gray-800" dir="ltr">{stats.registered.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold">زيارات مباشرة</p>
              <p className="text-2xl font-black text-gray-800" dir="ltr">{stats.walkIns.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* تبويبات فرعية: قائمة المرضى / سجل الزيارات */}
      <div className="flex gap-2">
        <button onClick={() => setView('list')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${view === 'list' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>قائمة المرضى</button>
        <button onClick={() => setView('history')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${view === 'history' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>سجل الزيارات</button>
      </div>

      {view === 'history' ? <PatientVisitsHistory /> : (
      <>
      <div className="mb-4 max-w-md">
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
                      <th className="p-4 font-semibold text-gray-600">النوع</th>
                      <th className="p-4 font-semibold text-gray-600">تاريخ التسجيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map(p => (
                      <tr key={`${p.source}-${p.id}`} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-bold text-sm">
                            {p.patient_code || 'غير محدد'}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-gray-800">
                          {p.name || '---'}
                        </td>
                        <td className="p-4 text-gray-600" dir="ltr">
                          {p.phone || '---'}
                        </td>
                        <td className="p-4">
                          {p.source === 'registered' ? (
                            <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">مسجّل بالتطبيق</span>
                          ) : (
                            <span className="text-xs font-bold bg-orange-100 text-orange-800 px-2 py-1 rounded">زيارة مباشرة</span>
                          )}
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
      </>
      )}

      {showAddVisitModal && (
        <AddVisitModal
          onClose={() => setShowAddVisitModal(false)}
          onAdded={() => {
            setShowAddVisitModal(false);
            fetchPatients();
          }}
        />
      )}

      {showImportModal && (
        <BulkPatientImportModal
          onClose={() => setShowImportModal(false)}
          onImported={fetchPatients}
        />
      )}
    </div>
  );
}
