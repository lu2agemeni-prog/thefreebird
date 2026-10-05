'use client';

// ============================================================================
// components/dashboards/manager/tabs/DoctorsTab.tsx
// جدول وإدارة أطباء المركز — مصدر الحقيقة الموحد للمواعيد وحالة التواجد:
// - عرض حالة التواجد الحية لكل طبيب (متواجد الآن / غير متواجد / تعديل يدوي).
// - عرض مواعيد وساعات العمل المجدولة بدقة لكل طبيب.
// - إمكانية تغيير حالة التواجد يدوياً بضغطة زر مباشرة من الجدول.
// - إمكانية استعادة التواجد التلقائي وفق جدول المواعيد الرسمي.
// - اشتراك لحظي في تغييرات جدول الأطباء لتتطابق شاشة النداء الآلي وجدول الأطباء لحظياً.
// ============================================================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import {
  UserPlus,
  Link2,
  X,
  Loader2,
  Calendar,
  Clock,
  UserCheck,
  UserX,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  Building,
  CheckCircle2,
  Stethoscope,
  Filter,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { DoctorDetail } from '../DoctorDetail';
import {
  calculateDoctorPresence,
  formatDoctorScheduleSummary,
  toggleDoctorPresenceUnified,
  resetDoctorPresenceToScheduleUnified,
  syncDoctorsPresenceWithDatabase,
  parseDoctorMediaMeta,
} from '@/lib/doctor-schedules';

const FETCH_CAP = 2000;
const PAGE_SIZE = 12;

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
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [page, setPage] = useState(0);
  const [selectedDoctor, setSelectedDoctor] = useState<any | null>(null);

  // عمليات التواجد المباشرة
  const [presenceBusyId, setPresenceBusyId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // استخراج سجل doctor ككائن دائماً سواء أرجعه Supabase ككائن أو مصفوفة
  const getDoctorRecord = (profile: any) => {
    if (!profile) return null;
    if (Array.isArray(profile.doctor)) return profile.doctor[0] || null;
    return profile.doctor || null;
  };

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('*, doctor:doctors(*)')
      .eq('role', 'doctor')
      .limit(FETCH_CAP);

    if (error) {
      setError(getFriendlyErrorMessage(error, 'تعذر تحميل قائمة الأطباء.'));
    } else {
      const list = data || [];
      setDoctors(list);

      // مزامنة حالة التواجد التلقائية فور الجلب عبر مصدر الحقيقة الموحد
      const docRows = list
        .map((p) => {
          const doc = Array.isArray(p.doctor) ? p.doctor[0] : p.doctor;
          return doc ? { ...doc, profile_id: p.id } : null;
        })
        .filter(Boolean);

      if (docRows.length > 0) {
        syncDoctorsPresenceWithDatabase(supabase, docRows);
      }
    }
    setLoading(false);
  }, []);

  const fetchClinics = useCallback(async () => {
    const { data } = await supabase.from('clinics').select('*').limit(FETCH_CAP);
    setClinics(data || []);
  }, []);

  useEffect(() => {
    const t1 = setTimeout(fetchDoctors, 0);
    const t2 = setTimeout(fetchClinics, 0);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [fetchDoctors, fetchClinics]);

  // الاشتراك اللحظي في تحديثات جدول doctors و profiles لضمان توحيد مصدر الحقيقة لحظياً
  useEffect(() => {
    const channel = supabase
      .channel('unified_doctors_tab_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, () => {
        fetchDoctors();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchDoctors();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDoctors]);

  useEffect(() => {
    const t = setTimeout(() => setPage(0), 0);
    return () => clearTimeout(t);
  }, [search, presenceFilter]);

  // تبديل حالة التواجد يدوياً للطبيب
  const handleTogglePresence = async (e: React.MouseEvent, profileId: string, currentPresence: boolean) => {
    e.stopPropagation();
    setPresenceBusyId(profileId);
    setFeedbackMsg(null);

    const res = await toggleDoctorPresenceUnified(supabase, profileId, !currentPresence);
    setPresenceBusyId(null);

    if (!res.success) {
      setFeedbackMsg({ text: res.error || 'تعذر تغيير حالة التواجد.', type: 'error' });
    } else {
      setFeedbackMsg({
        text: `تم ${!currentPresence ? 'تسجيل الطبيب كمتواجد الآن' : 'تسجيل الطبيب كغير متواجد'} بنجاح وتحديث شاشة النداء الآلي.`,
        type: 'success',
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
      fetchDoctors();
    }
  };

  // استعادة التواجد التلقائي وفق جدول المواعيد الرسمي
  const handleResetToSchedule = async (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    setPresenceBusyId(profileId);
    setFeedbackMsg(null);

    const res = await resetDoctorPresenceToScheduleUnified(supabase, profileId);
    setPresenceBusyId(null);

    if (!res.success) {
      setFeedbackMsg({ text: res.error || 'تعذر استعادة التواجد وفق الجدول.', type: 'error' });
    } else {
      setFeedbackMsg({
        text: 'تمت استعادة التواجد التلقائي للطبيب وفق جدول المواعيد الرسمي وتحديث النداء الآلي.',
        type: 'success',
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
      fetchDoctors();
    }
  };

  // المزامنة الجماعية لكافة الأطباء وفق التوقيت الحالي وجداول العمل
  const handleSyncAllDoctors = async () => {
    setSyncingAll(true);
    setFeedbackMsg(null);
    try {
      const docRows = doctors
        .map((p) => {
          const doc = getDoctorRecord(p);
          return doc ? { ...doc, profile_id: p.id } : null;
        })
        .filter(Boolean);

      const count = await syncDoctorsPresenceWithDatabase(supabase, docRows);
      setFeedbackMsg({
        text: count > 0
          ? `تم تحديث ومزامنة حالة تواجد ${count} طبيب تلقائياً وفق جداول العمل وتحديث كافة الشاشات.`
          : 'حالة تواجد كافة الأطباء مطابقة ومحدثة بالكامل مع جداول العمل الحالية.',
        type: 'success',
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
      fetchDoctors();
    } catch (err: any) {
      setFeedbackMsg({ text: err?.message || 'تعذر مزامنة الأطباء.', type: 'error' });
    } finally {
      setSyncingAll(false);
    }
  };

  // تصفية الأطباء بالبحث وحالة التواجد
  const filteredDoctors = useMemo(() => {
    const q = search.trim().toLowerCase();

    return doctors.filter((p) => {
      const doc = getDoctorRecord(p);
      const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      const specialty = (doc?.specialty || '').toLowerCase();

      const matchesSearch = !q || fullName.includes(q) || phone.includes(q) || specialty.includes(q);
      if (!matchesSearch) return false;

      if (presenceFilter === 'all') return true;

      const presence = calculateDoctorPresence(doc || { is_present: false, bio: null });
      if (presenceFilter === 'present') return presence.isPresent;
      if (presenceFilter === 'absent') return !presence.isPresent;

      return true;
    });
  }, [doctors, search, presenceFilter]);

  // إحصائيات التواجد الحالية
  const stats = useMemo(() => {
    let presentCount = 0;
    let absentCount = 0;

    doctors.forEach((p) => {
      const doc = getDoctorRecord(p);
      const presence = calculateDoctorPresence(doc || { is_present: false, bio: null });
      if (presence.isPresent) presentCount++;
      else absentCount++;
    });

    return { total: doctors.length, presentCount, absentCount };
  }, [doctors]);

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
    return linkableUsers.filter(
      (u) =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        (u.phone && u.phone.toLowerCase().includes(q))
    );
  }, [linkableUsers, linkableSearch]);

  async function fetchLinkableUsers() {
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
  }

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
      const { error: roleErr } = await supabase
        .from('profiles')
        .update({ role: 'doctor' })
        .eq('id', addDoctorUserId);
      if (roleErr) throw roleErr;

      const { error: docErr } = await supabase.from('doctors').upsert([
        {
          profile_id: addDoctorUserId,
          specialty: addDoctorSpecialty.trim() || null,
          consultation_fee:
            addDoctorFee && !isNaN(Number(addDoctorFee)) ? Number(addDoctorFee) : null,
          clinic_id: addDoctorClinicId || null,
        },
      ]);
      if (docErr) throw docErr;

      if (addDoctorClinicId) {
        const { error: linkErr } = await supabase
          .from('doctor_clinics')
          .insert([{ doctor_id: addDoctorUserId, clinic_id: addDoctorClinicId, is_primary: true }]);
        if (linkErr && linkErr.code !== 'PGRST106' && linkErr.code !== '42P01') {
          console.warn('doctor_clinics insert skipped:', linkErr.message);
        }
      }

      setAddDoctorOk('تمت إضافة الطبيب وربطه بالحساب بنجاح. اضغط على كارت الطبيب لملء مواعيده.');
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
        doctor={{
          ...selectedDoctor,
          doctor: getDoctorRecord(selectedDoctor),
        }}
        clinics={clinics}
        onBack={() => {
          setSelectedDoctor(null);
          fetchDoctors();
        }}
        onChanged={fetchDoctors}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* بطاقة توحيد مصدر الحقيقة للمواعيد والتواجد */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-5 md:p-6 shadow-lg border border-emerald-700/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-1 rounded-full font-bold border border-emerald-400/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> مصدر الحقيقة الموحد للمواعيد والتواجد
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black">جدول الأطباء وحالة التواجد الحية</h2>
          <p className="text-xs md:text-sm text-emerald-200/80 max-w-2xl leading-relaxed">
            مواعيد وساعات العمل وحالة التواجد (متواجد / غير متواجد) موحدة تماماً ومتصلة لحظياً بين جدول الأطباء
            وشاشة النداء الآلي ولوحة السكرتارية. أي تغيير هنا ينعكس فوراً على الشاشات وقوائم الانتظار.
          </p>
        </div>

        {/* إحصائيات سريعة وزر المزامنة الجماعية */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-center min-w-[70px]">
            <div className="text-xs text-emerald-200">الإجمالي</div>
            <div className="text-lg font-black">{stats.total}</div>
          </div>
          <div className="bg-emerald-500/20 backdrop-blur-md px-3 py-2 rounded-xl border border-emerald-400/30 text-center min-w-[70px]">
            <div className="text-xs text-emerald-300">متواجد الآن</div>
            <div className="text-lg font-black text-emerald-300">{stats.presentCount}</div>
          </div>
          <div className="bg-slate-700/40 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-center min-w-[70px]">
            <div className="text-xs text-gray-300">غير متواجد</div>
            <div className="text-lg font-black text-gray-200">{stats.absentCount}</div>
          </div>
          <button
            onClick={handleSyncAllDoctors}
            disabled={syncingAll}
            title="مزامنة وتدقيق تواجد كافة الأطباء مع جداول العمل الحالية وتحديث الشاشات"
            className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 text-xs md:text-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`} />
            مزامنة التواجد الآن
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl text-sm font-bold flex items-center gap-2 border transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <X className="w-5 h-5 shrink-0 text-red-600" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-emerald-600" />
                أطباء المركز والمواعيد
              </CardTitle>
              <CardDescription>
                اضغط على أي طبيب لتعديل مواعيد العمل وساعات الشيفت وتخصيص العيادات
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
              <div className="w-full sm:w-64">
                <SearchInput
                  value={search}
                  onValueChange={setSearch}
                  placeholder="ابحث بالطبيب، التخصص، أو الهاتف..."
                />
              </div>
              <button
                onClick={openAddDoctor}
                className="bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap text-sm cursor-pointer shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                إضافة طبيب + ربط حساب
              </button>
            </div>
          </div>

          {/* فلاتر حالة التواجد السريعة */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> تصفية حسب التواجد:
            </span>
            <button
              onClick={() => setPresenceFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                presenceFilter === 'all'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              الكل ({stats.total})
            </button>
            <button
              onClick={() => setPresenceFilter('present')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                presenceFilter === 'present'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              المتواجدون الآن ({stats.presentCount})
            </button>
            <button
              onClick={() => setPresenceFilter('absent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                presenceFilter === 'absent'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              غير المتواجدين ({stats.absentCount})
            </button>
          </div>
        </CardHeader>

        <CardContent>
          {error && <ErrorState message={error} onRetry={fetchDoctors} compact />}

          {showAddDoctor && (
            <form
              onSubmit={handleAddDoctor}
              className="mb-6 bg-emerald-50/60 border border-emerald-100 p-4 rounded-xl space-y-4"
            >
              <h4 className="font-bold text-emerald-800 flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                إضافة طبيب جديد وربطه بحساب مستخدم
              </h4>
              <p className="text-xs text-gray-500">
                اختر حسابًا قائمًا وسيتم ترقيته إلى دور &quot;طبيب&quot; وإدراجه بجدول الأطباء والمواعيد الموحد.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    الحساب المرشح للترقية
                  </label>
                  <select
                    value={addDoctorUserId}
                    onChange={(e) => setAddDoctorUserId(e.target.value)}
                    className="w-full border rounded-lg p-2.5 text-sm"
                    required
                  >
                    <option value="">-- اختر حساب المستخدم --</option>
                    {filteredLinkableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} — {getRoleLabel(u.role || 'patient')} —{' '}
                        {u.phone || 'بدون هاتف'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    بحث سريع (تصفية القائمة)
                  </label>
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
                  <input
                    type="text"
                    value={addDoctorSpecialty}
                    onChange={(e) => setAddDoctorSpecialty(e.target.value)}
                    className="w-full border rounded-lg p-2.5 text-sm"
                    placeholder="مثال: باطنة"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">سعر الكشف (ج.م)</label>
                  <input
                    type="number"
                    min="0"
                    value={addDoctorFee}
                    onChange={(e) => setAddDoctorFee(e.target.value)}
                    className="w-full border rounded-lg p-2.5 text-sm"
                    placeholder="250"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    العيادة الأساسية (اختياري)
                  </label>
                  <select
                    value={addDoctorClinicId}
                    onChange={(e) => setAddDoctorClinicId(e.target.value)}
                    className="w-full border rounded-lg p-2.5 text-sm"
                  >
                    <option value="">-- بدون عيادة --</option>
                    {clinics.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>
                        {clinic.name}
                      </option>
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
                <button
                  type="submit"
                  disabled={addingDoctor}
                  className="bg-emerald-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {addingDoctor ? <Loader2 className="w-5 h-5 animate-spin" /> : <Link2 className="w-5 h-5" />}
                  إضافة وربط
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddDoctor(false)}
                  className="border border-gray-200 text-gray-600 font-bold px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <X className="w-5 h-5" /> إلغاء
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-16 gap-3 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span>جاري تحميل بيانات الأطباء ومواعيد العمل وحالة التواجد...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDoctors.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Stethoscope className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="font-bold text-gray-700">لا يوجد أطباء مطابقين لشروط البحث أو الفلتر.</p>
                  <p className="text-xs text-gray-400 mt-1">
                    جرب تغيير كلمة البحث أو فلاتر التواجد أو أضف طبيباً جديداً.
                  </p>
                </div>
              ) : (
                filteredDoctors
                  .slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
                  .map((docProfile) => {
                    const docRecord = getDoctorRecord(docProfile);
                    const presence = calculateDoctorPresence(
                      docRecord || { is_present: false, bio: null }
                    );
                    const meta = parseDoctorMediaMeta(docRecord?.bio, docRecord?.working_days);
                    const scheduleSummary = formatDoctorScheduleSummary(
                      meta.schedules,
                      docRecord?.working_days
                    );
                    const isBusy = presenceBusyId === docProfile.id;

                    // البحث عن اسم العيادة
                    const primaryClinic = clinics.find((c) => c.id === docRecord?.clinic_id);

                    return (
                      <div
                        key={docProfile.id}
                        onClick={() => setSelectedDoctor(docProfile)}
                        className={`text-right border rounded-2xl p-4 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative group ${
                          presence.isPresent
                            ? 'border-emerald-200 hover:border-emerald-400 bg-gradient-to-b from-emerald-50/20 to-white'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {/* الجزء العلوي: الصورة + الاسم + التخصص */}
                        <div>
                          <div className="flex items-start gap-3.5 mb-3">
                            <div className="relative shrink-0">
                              {docProfile.avatar_url ? (
                                <Image
                                  src={docProfile.avatar_url}
                                  alt=""
                                  width={56}
                                  height={56}
                                  className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-100 shadow-sm"
                                  unoptimized={false}
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-200 text-emerald-800 font-black text-xl flex items-center justify-center border-2 border-emerald-100 shadow-sm">
                                  {docProfile.first_name?.[0] || 'ط'}
                                </div>
                              )}
                              {/* نقطة حالة التواجد الحية على الصورة */}
                              <span
                                className={`absolute -bottom-1 -left-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                                  presence.isPresent ? 'bg-emerald-500' : 'bg-gray-400'
                                }`}
                                title={presence.reasonText}
                              >
                                {presence.isPresent && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                )}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <h4 className="font-black text-base text-gray-900 group-hover:text-emerald-700 transition-colors truncate">
                                د. {docProfile.first_name} {docProfile.last_name}
                              </h4>
                              <p className="text-gray-500 text-xs truncate mt-0.5">
                                {docRecord?.specialty || 'طبيب عام'}
                                {docProfile.phone ? ` • ${docProfile.phone}` : ''}
                              </p>
                              {primaryClinic && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md mt-1">
                                  <Building className="w-3 h-3 text-emerald-600" />
                                  {primaryClinic.name}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* حالة التواجد الموحدة (The Single Source of Truth) */}
                          <div className="mb-3 p-2.5 rounded-xl border bg-gray-50/70 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-gray-500">حالة التواجد الحالية:</span>
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-xs ${
                                  presence.isPresent
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    presence.isPresent ? 'bg-emerald-600 animate-pulse' : 'bg-gray-400'
                                  }`}
                                />
                                {presence.isPresent ? 'متواجد الآن' : 'غير متواجد'}
                              </span>
                            </div>

                            <div className="text-[11px] text-gray-600 leading-tight truncate" title={presence.reasonText}>
                              {presence.reasonText}
                            </div>
                          </div>

                          {/* جدول المواعيد وساعات العمل */}
                          <div className="text-xs text-gray-600 bg-emerald-50/40 border border-emerald-100/60 p-2.5 rounded-xl mb-3 flex items-start gap-2">
                            <Calendar className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-bold text-gray-500 mb-0.5">جدول المواعيد وساعات العمل:</div>
                              <div className="font-bold text-gray-800 text-[11px] truncate" title={scheduleSummary}>
                                {scheduleSummary}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* الجزء السفلي: أزرار التحكم السريع الموحدة */}
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {/* زر التبديل السريع للتواجد */}
                            <button
                              type="button"
                              onClick={(e) => handleTogglePresence(e, docProfile.id, presence.isPresent)}
                              disabled={isBusy}
                              title="تبديل حالة التواجد يدوياً فوراً وتحديث النداء الآلي"
                              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                                presence.isPresent
                                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                  : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                              }`}
                            >
                              {isBusy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : presence.isPresent ? (
                                <UserX className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                              <span>{presence.isPresent ? 'تسجيل غياب' : 'تسجيل حضور'}</span>
                            </button>

                            {/* زر استعادة الجدولة التلقائية إذا وجد تعديل يدوي */}
                            {presence.source === 'manual' && (
                              <button
                                type="button"
                                onClick={(e) => handleResetToSchedule(e, docProfile.id)}
                                disabled={isBusy}
                                title="إلغاء التعديل اليدوي والعودة للجدول التلقائي"
                                className="text-[11px] font-bold px-2 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>الجدول</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1 text-xs text-emerald-600 font-bold group-hover:translate-x-[-2px] transition-transform">
                            <span>تعديل المواعيد</span>
                            <ChevronLeft className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          )}
          {!loading && (
            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={filteredDoctors.length}
              onPageChange={setPage}
              isLoading={loading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
