'use client';

// ============================================================================
// components/dashboards/manager/QueueMediaManager.tsx
// إدارة وسائط شاشة النداء الآلي + إعلانات ومواعيد عمل الأطباء:
// - تحديد ميديا كل طبيب (صورة + مقطع صوتي عبر رابط أو رفع مباشر لـ Supabase Bucket).
// - تحديد فترة الإعلان (مثلاً 30 ثانية) على شاشة العرض.
// - تحديد مواعيد العمل بالمركز لكل طبيب باليوم والتوقيت (من كذا إلى كذا).
// - التحديد التلقائي للتواجد خلال أوقات العمل مع إمكانية التعديل اليدوي الفوري.
// - إدارة الوسائط العامة للمركز (صور/فيديوهات) وترتيب ظهورها.
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Video,
  Stethoscope,
  Volume2,
  VolumeX,
  Play,
  Square,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Upload,
  Link as LinkIcon,
  Sparkles,
  Sliders,
  Building,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Radio,
} from 'lucide-react';
import {
  DoctorMediaMeta,
  DoctorShift,
  DAYS_OF_WEEK,
  DEFAULT_AD_DURATION,
  parseDoctorMediaMeta,
  serializeDoctorMediaMeta,
  calculateDoctorPresence,
  syncDoctorsPresenceWithDatabase,
  getCairoCurrentTime,
  createDefaultSchedules,
  extractWorkingDaysFromSchedules,
  toggleDoctorPresenceUnified,
  resetDoctorPresenceToScheduleUnified,
} from '@/lib/doctor-schedules';
import {
  QueueLayoutConfig,
  DEFAULT_QUEUE_LAYOUT_CONFIG,
  fetchQueueLayoutConfig,
  saveQueueLayoutConfig,
} from '@/lib/queue-layout-config';
import { QueueLayoutSettingsModal } from '@/components/queue/QueueLayoutSettingsModal';

export function QueueMediaManager() {
  const [activeTab, setActiveTab] = useState<'doctors' | 'general' | 'preview'>('doctors');

  // بيانات الوسائط العامة
  const [generalMedia, setGeneralMedia] = useState<any[]>([]);
  const [loadingGeneral, setLoadingGeneral] = useState(true);

  // بيانات الأطباء
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctorClinicFilter, setDoctorClinicFilter] = useState('all');

  // رسائل التنبيه والعمليات
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // نافذة تعديل بيانات ومواعيد الطبيب
  const [editingDoctor, setEditingDoctor] = useState<any | null>(null);
  const [editMeta, setEditMeta] = useState<DoctorMediaMeta>({
    ad_duration_seconds: DEFAULT_AD_DURATION,
    schedules: createDefaultSchedules(),
  });
  const [photoInputMode, setPhotoInputMode] = useState<'url' | 'upload'>('upload');
  const [audioInputMode, setAudioInputMode] = useState<'url' | 'upload'>('upload');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [savingDoctor, setSavingDoctor] = useState(false);

  // تشغيل المقطع الصوتي للاختبار داخل اللوحة
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioPlayerRef = React.useRef<HTMLAudioElement | null>(null);

  // إضافة وسائط عامة جديدة
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaOrder, setNewMediaOrder] = useState('0');
  const [uploadingGeneralFile, setUploadingGeneralFile] = useState(false);
  const [submittingGeneral, setSubmittingGeneral] = useState(false);

  // تخصيص تخطيط وألوان الشاشة
  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState<QueueLayoutConfig>(DEFAULT_QUEUE_LAYOUT_CONFIG);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [layoutSaveSuccess, setLayoutSaveSuccess] = useState(false);

  // جلب الوسائط العامة
  const fetchGeneralMedia = useCallback(async () => {
    setLoadingGeneral(true);
    const { data, error } = await supabase
      .from('queue_media')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل قائمة الوسائط العامة.'));
    } else {
      setGeneralMedia(data || []);
    }
    setLoadingGeneral(false);
  }, []);

  // جلب بيانات الأطباء والعيادات
  const fetchDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    const { data, error } = await supabase
      .from('doctors')
      .select(`
        profile_id,
        clinic_id,
        specialty,
        bio,
        working_days,
        is_present,
        presence_updated_at,
        profiles(first_name, last_name, avatar_url, phone),
        clinics(id, name)
      `);

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل بيانات الأطباء ومواعيد العمل.'));
    } else {
      const list = data || [];
      setDoctors(list);
      // مزامنة حالة التواجد التلقائية فور الجلب
      syncDoctorsPresenceWithDatabase(supabase, list);
    }
    setLoadingDoctors(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchGeneralMedia();
      fetchDoctors();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchGeneralMedia, fetchDoctors]);

  // إيقاف أي صوت عند تفكيك المكون
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  // تشغيل أو إيقاف المقطع الصوتي للاختبار
  const handleTogglePlayAudio = (audioUrl: string) => {
    if (!audioUrl) return;

    if (playingAudioUrl === audioUrl) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      setPlayingAudioUrl(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      setPlayingAudioUrl(audioUrl);
      audio.play().catch((err) => {
        console.warn('Audio play failed:', err);
        setPlayingAudioUrl(null);
      });
      audio.onended = () => {
        setPlayingAudioUrl(null);
        audioPlayerRef.current = null;
      };
    }
  };

  // فتح مودال تعديل ميديا ومواعيد الطبيب
  const handleOpenEditDoctor = (doctor: any) => {
    setEditingDoctor(doctor);
    const meta = parseDoctorMediaMeta(doctor.bio, doctor.working_days);
    // لو مفيش صورة مسجلة في الميتا بس مسجلة في avatar_url للطبيب، نستخدمها كافتراضي
    if (!meta.photo_url && doctor.profiles?.avatar_url) {
      meta.photo_url = doctor.profiles.avatar_url;
    }
    setEditMeta(meta);
    setActionError(null);
  };

  // رفع صورة الطبيب إلى Supabase Bucket ('news')
  const handleUploadDoctorPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (JPEG, PNG, WebP).');
      return;
    }

    setUploadingPhoto(true);
    setActionError(null);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const cleanName = `doc-photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

      const { error: upErr } = await supabase.storage.from('news').upload(cleanName, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from('news').getPublicUrl(cleanName);
      if (data?.publicUrl) {
        setEditMeta((prev) => ({ ...prev, photo_url: data.publicUrl }));
      }
    } catch (err: any) {
      setActionError(getFriendlyErrorMessage(err, 'تعذر رفع صورة الطبيب إلى سحابة التخزين.'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  // رفع المقطع الصوتي للطبيب إلى Supabase Bucket ('news')
  const handleUploadDoctorAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|aac)$/i)) {
      alert('يرجى اختيار ملف صوتي صالح بصيغة MP3 أو WAV أو M4A أو OGG.');
      return;
    }

    setUploadingAudio(true);
    setActionError(null);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      const cleanName = `doc-audio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

      const { error: upErr } = await supabase.storage.from('news').upload(cleanName, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from('news').getPublicUrl(cleanName);
      if (data?.publicUrl) {
        setEditMeta((prev) => ({ ...prev, audio_url: data.publicUrl }));
      }
    } catch (err: any) {
      setActionError(getFriendlyErrorMessage(err, 'تعذر رفع المقطع الصوتي إلى سحابة التخزين.'));
    } finally {
      setUploadingAudio(false);
    }
  };

  // تطبيق توقيت موحد لكافة الأيام النشطة
  const handleApplyTimeToAllDays = (sourceShift: DoctorShift) => {
    setEditMeta((prev) => ({
      ...prev,
      schedules: prev.schedules.map((s) => ({
        ...s,
        startTime: sourceShift.startTime,
        endTime: sourceShift.endTime,
      })),
    }));
  };

  // تطبيق دوام جاهز (صباحي / مسائي)
  const handleApplyPresetShift = (type: 'morning' | 'evening' | 'fullday') => {
    const times =
      type === 'morning'
        ? { start: '09:00', end: '15:00' }
        : type === 'evening'
        ? { start: '16:00', end: '22:00' }
        : { start: '10:00', end: '20:00' };

    setEditMeta((prev) => ({
      ...prev,
      schedules: prev.schedules.map((s) => ({
        ...s,
        startTime: times.start,
        endTime: times.end,
        enabled: s.day !== 5, // استثناء الجمعة افتراضياً
      })),
    }));
  };

  // حفظ تعديلات الطبيب ومزامنة المواعيد مع أيام العمل وأوقات الشيفتات
  const handleSaveDoctorMeta = async () => {
    if (!editingDoctor) return;

    setSavingDoctor(true);
    setActionError(null);
    try {
      const bioPayload = serializeDoctorMediaMeta(editMeta);
      const workingDays = extractWorkingDaysFromSchedules(editMeta.schedules);

      // تحديث حالة الطبيب محلياً
      const updatedDoctor = { ...editingDoctor, bio: bioPayload };
      const { isPresent } = calculateDoctorPresence(updatedDoctor);

      // تحديث موحد للبيو وأيام العمل وحالة التواجد والتوقيت معاً في عملية واحدة
      const { error: updErr } = await supabase
        .from('doctors')
        .update({
          bio: bioPayload,
          working_days: workingDays,
          is_present: isPresent,
          presence_updated_at: new Date().toISOString(),
        })
        .eq('profile_id', editingDoctor.profile_id);

      if (updErr) throw updErr;

      setSuccessBanner(`تم حفظ إعدادات ميديا ومواعيد د. ${editingDoctor.profiles?.first_name || ''} بنجاح ومزامنة أيام العمل.`);
      setTimeout(() => setSuccessBanner(null), 5000);
      setEditingDoctor(null);
      fetchDoctors();
    } catch (err: any) {
      setActionError(getFriendlyErrorMessage(err, 'تعذر حفظ تعديلات الطبيب.'));
    } finally {
      setSavingDoctor(false);
    }
  };

  // تبديل التواجد يدوياً للطبيب من الجدول مباشرة عبر مصدر الحقيقة الموحد
  const handleToggleManualPresence = async (doctor: any) => {
    setActionError(null);
    const res = await toggleDoctorPresenceUnified(supabase, doctor.profile_id, !doctor.is_present);
    if (!res.success) {
      setActionError(res.error || 'تعذر تحديث حالة تواجد الطبيب يدوياً.');
    } else {
      fetchDoctors();
    }
  };

  // استعادة التواجد التلقائي وفق جدول المواعيد الرسمي
  const handleResetSchedulePresence = async (doctor: any) => {
    setActionError(null);
    const res = await resetDoctorPresenceToScheduleUnified(supabase, doctor.profile_id);
    if (!res.success) {
      setActionError(res.error || 'تعذر استعادة التواجد وفق الجدول.');
    } else {
      fetchDoctors();
    }
  };

  // مزامنة حالة تواجد كافة الأطباء يدوياً الآن
  const handleSyncAllPresence = async () => {
    setSyncing(true);
    setActionError(null);
    try {
      const count = await syncDoctorsPresenceWithDatabase(supabase, doctors);
      setSuccessBanner(
        count > 0
          ? `تم تحديث ومزامنة حالة تواجد ${count} طبيب تلقائياً وفق فترات العمل الحالية.`
          : 'حالة تواجد كافة الأطباء متطابقة تماماً مع جداول العمل الحالية.'
      );
      setTimeout(() => setSuccessBanner(null), 5000);
      fetchDoctors();
    } catch {
      setActionError('تعذر مزامنة فترات العمل.');
    } finally {
      setSyncing(false);
    }
  };

  // إضافة وسائط عامة جديدة
  const handleAddGeneralMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMediaUrl.trim()) return;

    setSubmittingGeneral(true);
    setActionError(null);
    try {
      const { error } = await supabase.from('queue_media').insert([
        {
          media_type: newMediaType,
          url: newMediaUrl.trim(),
          display_order: parseInt(newMediaOrder, 10) || 0,
          is_active: true,
        },
      ]);
      if (error) throw error;

      setNewMediaUrl('');
      setNewMediaOrder('0');
      fetchGeneralMedia();
    } catch (err: any) {
      setActionError(getFriendlyErrorMessage(err, 'تعذر إضافة الوسائط العامة.'));
    } finally {
      setSubmittingGeneral(false);
    }
  };

  // رفع ملف وسائط عامة إلى Supabase Bucket
  const handleUploadGeneralFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingGeneralFile(true);
    setActionError(null);
    try {
      const isVid = file.type.startsWith('video/');
      const ext = file.name.split('.').pop() || (isVid ? 'mp4' : 'jpg');
      const cleanName = `general-media-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage.from('news').upload(cleanName, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from('news').getPublicUrl(cleanName);
      if (data?.publicUrl) {
        setNewMediaUrl(data.publicUrl);
        setNewMediaType(isVid ? 'video' : 'image');
      }
    } catch (err: any) {
      setActionError(getFriendlyErrorMessage(err, 'تعذر رفع الملف إلى التخزين السحابي.'));
    } finally {
      setUploadingGeneralFile(false);
    }
  };

  // تبديل تفعيل وسيط عام
  const handleToggleGeneralMedia = async (id: string, current: boolean) => {
    setActionError(null);
    const { error } = await supabase.from('queue_media').update({ is_active: !current }).eq('id', id);
    if (error) {
      setActionError(getFriendlyErrorMessage(error, 'تعذر تحديث الوسائط.'));
    } else {
      fetchGeneralMedia();
    }
  };

  // حذف وسيط عام
  const handleDeleteGeneralMedia = async (id: string) => {
    if (!confirm('هل تريد بالتأكيد حذف هذا الوسيط من شاشة العرض؟')) return;
    setActionError(null);
    const { error } = await supabase.from('queue_media').delete().eq('id', id);
    if (error) {
      setActionError(getFriendlyErrorMessage(error, 'تعذر حذف الوسائط.'));
    } else {
      fetchGeneralMedia();
    }
  };

  // تصفية الأطباء حسب البحث والعيادة
  const filteredDoctors = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();
    return doctors.filter((d) => {
      const name = `${d.profiles?.first_name || ''} ${d.profiles?.last_name || ''}`.toLowerCase();
      const spec = (d.specialty || '').toLowerCase();
      const clinicName = (d.clinics?.name || '').toLowerCase();

      const matchesSearch = !q || name.includes(q) || spec.includes(q) || clinicName.includes(q);
      const matchesClinic = doctorClinicFilter === 'all' || d.clinic_id === doctorClinicFilter;

      return matchesSearch && matchesClinic;
    });
  }, [doctors, doctorSearch, doctorClinicFilter]);

  // قائمة العيادات الفريدة للفلتر
  const clinicOptions = useMemo(() => {
    const map = new Map<string, string>();
    doctors.forEach((d) => {
      if (d.clinics?.id && d.clinics?.name) {
        map.set(d.clinics.id, d.clinics.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [doctors]);

  if (loadError) {
    return <ErrorState message={loadError} onRetry={() => { fetchGeneralMedia(); fetchDoctors(); }} />;
  }

  return (
    <div className="space-y-6">
      {/* الرأس الرئيسي */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 p-5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <ImageIcon className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-800">وسائط وإعلانات شاشة النداء الآلي</h2>
            <p className="text-xs text-gray-500 mt-1">
              إدارة صور ومقاطع صوت ومواعيد عمل الأطباء وتحديد فترات التواجد التلقائية وإعلانات المركز
            </p>
          </div>
        </div>

        {/* أزرار الإجراءات والشاشة */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={async () => {
              const loaded = await fetchQueueLayoutConfig();
              setLayoutConfig(loaded);
              setShowLayoutModal(true);
            }}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-850 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>تخصيص تخطيط وألوان الشاشة</span>
          </button>

          <a
            href="/queue"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>فتح شاشة النداء (عرض الشاشة الكبيرة)</span>
          </a>
        </div>
      </div>

      {/* رسائل التنبيه والإشعارات */}
      {successBanner && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-bold shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}
      {actionError && <InlineError message={actionError} />}

      {/* شريط التبويب الرئيسي */}
      <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200/80 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('doctors')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'doctors' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Stethoscope className="w-4 h-4 text-emerald-600" />
          <span>ميديا وإعلانات الأطباء ومواعيد العمل ({doctors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'general' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-emerald-600" />
          <span>الوسائط العامة للمركز ({generalMedia.length})</span>
        </button>
      </div>

      {/* التبويب 1: ميديا وإعلانات الأطباء ومواعيد العمل */}
      {activeTab === 'doctors' && (
        <div className="space-y-4">
          {/* شريط الفلترة وأزرار المزامنة */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <input
                type="text"
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                placeholder="بحث باسم الطبيب، التخصص، العيادة..."
                className="border rounded-xl px-3 py-2 text-xs w-full sm:w-64 outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
              />

              <select
                value={doctorClinicFilter}
                onChange={(e) => setDoctorClinicFilter(e.target.value)}
                className="border rounded-xl px-3 py-2 text-xs bg-gray-50 font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">كل العيادات</option>
                {clinicOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncAllPresence}
                disabled={syncing}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer transition-colors shadow-2xs"
                title="مزامنة وتحديث حالة تواجد جميع الأطباء تلقائياً وفق أوقات العمل في هذه اللحظة"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-emerald-600' : ''}`} />
                <span>مزامنة التواجد التلقائي الآن</span>
              </button>
            </div>
          </div>

          {/* شبكة بطاقات الأطباء */}
          {loadingDoctors ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-500 text-xs font-bold">
              لا يوجد أطباء مطابقون للبحث والفلترة.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDoctors.map((doc) => {
                const docName = `د. ${doc.profiles?.first_name || ''} ${doc.profiles?.last_name || ''}`.trim();
                const clinicName = doc.clinics?.name || 'غير محدد';
                const meta = parseDoctorMediaMeta(doc.bio, doc.working_days);
                const photo = meta.photo_url || doc.profiles?.avatar_url;
                const audio = meta.audio_url;
                const presenceStatus = calculateDoctorPresence(doc);
                const isPlayingThisAudio = playingAudioUrl === audio;

                // حصر الأيام النشطة في المواعيد
                const activeDays = (meta.schedules || []).filter((s) => s.enabled);

                return (
                  <Card key={doc.profile_id} className="border border-gray-200 hover:border-emerald-300 transition-all shadow-xs overflow-hidden flex flex-col justify-between">
                    <CardContent className="p-4 space-y-3">
                      {/* رأس البطاقة: الصورة والاسم والتواجد */}
                      <div className="flex items-start gap-3">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo}
                            alt={docName}
                            className="w-16 h-16 rounded-xl object-cover border border-gray-200 shadow-2xs shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                            <Stethoscope className="w-7 h-7" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 text-sm truncate">{docName}</h4>
                          <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3" />
                            <span>{clinicName}</span>
                          </p>
                          {doc.specialty && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{doc.specialty}</p>}

                          {/* شارة التواجد الفعلي */}
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                presenceStatus.isPresent
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  presenceStatus.isPresent ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                                }`}
                              />
                              <span>{presenceStatus.isPresent ? 'متواجد حالياً' : 'غير متواجد'}</span>
                            </span>

                            {presenceStatus.source === 'manual' && (
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-semibold border border-amber-200">
                                يدوي
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ملخص إعدادات الميديا لشاشة النداء */}
                      <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">صورة الإعلان:</span>
                          <span className={`font-bold ${photo ? 'text-emerald-700' : 'text-gray-400'}`}>
                            {photo ? 'جاهزة ومرفوعة' : 'غير محددة'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">المقطع الصوتي:</span>
                          {audio ? (
                            <button
                              type="button"
                              onClick={() => handleTogglePlayAudio(audio)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                            >
                              {isPlayingThisAudio ? <Square className="w-3 h-3 text-rose-600 fill-rose-600" /> : <Play className="w-3 h-3" />}
                              <span>{isPlayingThisAudio ? 'إيقاف' : 'استماع للمقطع'}</span>
                            </button>
                          ) : (
                            <span className="text-gray-400 font-semibold text-[11px]">غير مضاف</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">مدة الإعلان بالشاشة:</span>
                          <span className="font-mono font-bold text-gray-800">
                            {meta.ad_duration_seconds || DEFAULT_AD_DURATION} ثانية
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">فترات العمل الأسبوعية:</span>
                          <span className="font-bold text-gray-700">
                            {activeDays.length > 0 ? `${activeDays.length} أيام أسبوعياً` : 'غير مجدولة'}
                          </span>
                        </div>
                      </div>
                    </CardContent>

                    {/* أزرار الإجراءات */}
                    <div className="p-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleManualPresence(doc)}
                        className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center ${
                          doc.is_present
                            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                        }`}
                        title="تغيير حالة التواجد يدوياً فوراً وتجاوز الجدولة المؤقتة"
                      >
                        {doc.is_present ? 'تبديل إلى (غير متواجد)' : 'تبديل إلى (متواجد الآن)'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditDoctor(doc)}
                        className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-3.5 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                        <span>تعديل الميديا والمواعيد</span>
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* التبويب 2: الوسائط العامة لشاشة النداء */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* إضافة وسائط عامة */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                إضافة وسائط عامة (إعلانات المركز وفيديوهات توعوية)
              </CardTitle>
              <CardDescription className="text-xs">
                تظهر هذه الوسائط بالتبادل على الشاشة العامة بجانب إعلانات الأطباء المتواجدين
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddGeneralMedia} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">نوع الوسيط</label>
                    <select
                      value={newMediaType}
                      onChange={(e) => setNewMediaType(e.target.value as 'image' | 'video')}
                      className="w-full border rounded-xl p-2.5 text-xs bg-white font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="image">صورة (Image)</option>
                      <option value="video">فيديو (Video)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">رابط الوسيط أو رفع ملف</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        required
                        value={newMediaUrl}
                        onChange={(e) => setNewMediaUrl(e.target.value)}
                        placeholder="https://... رابط الصورة أو الفيديو"
                        className="flex-1 border rounded-xl p-2.5 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                        dir="ltr"
                      />
                      <label className="shrink-0 flex items-center gap-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 font-bold px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors">
                        {uploadingGeneralFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span>{uploadingGeneralFile ? 'جاري الرفع...' : 'رفع ملف'}</span>
                        <input
                          type="file"
                          accept={newMediaType === 'video' ? 'video/*' : 'image/*'}
                          className="hidden"
                          onChange={handleUploadGeneralFile}
                          disabled={uploadingGeneralFile}
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">ترتيب العرض</label>
                    <input
                      type="number"
                      value={newMediaOrder}
                      onChange={(e) => setNewMediaOrder(e.target.value)}
                      placeholder="0"
                      className="w-full border rounded-xl p-2.5 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submittingGeneral || !newMediaUrl.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {submittingGeneral ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>إضافة الوسيط لشاشة العرض</span>
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* قائمة الوسائط العامة الحالية */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-800 text-sm">الوسائط العامة المضافة ({generalMedia.length})</h3>
            {loadingGeneral ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : generalMedia.length === 0 ? (
              <div className="text-center py-8 bg-white border rounded-xl text-gray-400 text-xs">
                لا توجد وسائط عامة مضافة بعد.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {generalMedia.map((m) => (
                  <div key={m.id} className="border border-gray-200 bg-white rounded-xl overflow-hidden shadow-xs space-y-2">
                    <div className="bg-gray-900 aspect-video flex items-center justify-center relative overflow-hidden">
                      {m.media_type === 'video' ? (
                        <video src={m.url} className="w-full h-full object-contain" muted controls />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.url} alt="" className="w-full h-full object-contain" />
                      )}
                      <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-xs">
                        {m.media_type === 'video' ? 'فيديو' : 'صورة'}
                      </span>
                    </div>

                    <div className="p-3 flex items-center justify-between text-xs border-t border-gray-100">
                      <span className="font-mono text-gray-500">ترتيب: #{m.display_order}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleGeneralMedia(m.id, m.is_active)}
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            m.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'
                          }`}
                          title={m.is_active ? 'تعطيل العرض' : 'تفعيل العرض'}
                        >
                          {m.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGeneralMedia(m.id)}
                          className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* مودال تعديل ميديا وفترات عمل الطبيب */}
      {editingDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* رأس المودال */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/70 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-gray-800 text-base">
                    إعدادات ميديا ومواعيد: د. {editingDoctor.profiles?.first_name || ''} {editingDoctor.profiles?.last_name || ''}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    العيادة: {editingDoctor.clinics?.name || 'غير محدد'} | التخصص: {editingDoctor.specialty || 'طبيب متخصص'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDoctor(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* محتوى النموذج */}
            <div className="p-5 space-y-6 overflow-y-auto flex-1">
              {/* القسم 1: صورة ومقطع صوت الطبيب ومدة الإعلان */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/80 space-y-4">
                <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>1. صورة الطبيب والمقطع الصوتي لشاشة النداء</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* صورة الطبيب */}
                  <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-700">صورة الطبيب (الإعلان)</label>
                      <div className="flex text-[11px] gap-1">
                        <button
                          type="button"
                          onClick={() => setPhotoInputMode('upload')}
                          className={`px-2 py-0.5 rounded font-bold ${
                            photoInputMode === 'upload' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          رفع ملف
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhotoInputMode('url')}
                          className={`px-2 py-0.5 rounded font-bold ${
                            photoInputMode === 'url' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          رابط مباشر
                        </button>
                      </div>
                    </div>

                    {photoInputMode === 'upload' ? (
                      <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-xl cursor-pointer bg-gray-50/50 hover:bg-emerald-50/30 transition-colors">
                        {uploadingPhoto ? (
                          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                        ) : (
                          <Upload className="w-6 h-6 text-gray-400" />
                        )}
                        <span className="text-xs font-bold text-gray-600 mt-1">
                          {uploadingPhoto ? 'جاري الرفع للسحابة...' : 'اختر صورة من جهازك'}
                        </span>
                        <span className="text-[10px] text-gray-400">JPG, PNG, WebP</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleUploadDoctorPhoto}
                          disabled={uploadingPhoto}
                        />
                      </label>
                    ) : (
                      <input
                        type="url"
                        value={editMeta.photo_url || ''}
                        onChange={(e) => setEditMeta({ ...editMeta, photo_url: e.target.value })}
                        placeholder="https://... رابط الصورة المباشر"
                        className="w-full border rounded-xl p-2 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                        dir="ltr"
                      />
                    )}

                    {editMeta.photo_url && (
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={editMeta.photo_url}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover border"
                        />
                        <span className="text-[11px] text-emerald-700 font-bold truncate flex-1">
                          تم تعيين الصورة بنجاح
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditMeta({ ...editMeta, photo_url: '' })}
                          className="text-rose-500 hover:text-rose-700 p-1"
                          title="حذف الصورة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* المقطع الصوتي */}
                  <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-700">المقطع الصوتي للطبيب</label>
                      <div className="flex text-[11px] gap-1">
                        <button
                          type="button"
                          onClick={() => setAudioInputMode('upload')}
                          className={`px-2 py-0.5 rounded font-bold ${
                            audioInputMode === 'upload' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          رفع ملف صوتي
                        </button>
                        <button
                          type="button"
                          onClick={() => setAudioInputMode('url')}
                          className={`px-2 py-0.5 rounded font-bold ${
                            audioInputMode === 'url' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          رابط مباشر
                        </button>
                      </div>
                    </div>

                    {audioInputMode === 'upload' ? (
                      <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-xl cursor-pointer bg-gray-50/50 hover:bg-emerald-50/30 transition-colors">
                        {uploadingAudio ? (
                          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                        ) : (
                          <Volume2 className="w-6 h-6 text-gray-400" />
                        )}
                        <span className="text-xs font-bold text-gray-600 mt-1">
                          {uploadingAudio ? 'جاري الرفع للسحابة...' : 'اختر ملف صوتي (MP3/WAV)'}
                        </span>
                        <span className="text-[10px] text-gray-400">يُشغّل مرة واحدة عند ظهور الطبيب</span>
                        <input
                          type="file"
                          accept="audio/*,.mp3,.wav,.m4a,.ogg"
                          className="hidden"
                          onChange={handleUploadDoctorAudio}
                          disabled={uploadingAudio}
                        />
                      </label>
                    ) : (
                      <input
                        type="url"
                        value={editMeta.audio_url || ''}
                        onChange={(e) => setEditMeta({ ...editMeta, audio_url: e.target.value })}
                        placeholder="https://... أو /audio/doctor1.mp3"
                        className="w-full border rounded-xl p-2 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                        dir="ltr"
                      />
                    )}

                    {editMeta.audio_url && (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => handleTogglePlayAudio(editMeta.audio_url!)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          {playingAudioUrl === editMeta.audio_url ? (
                            <Square className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          <span>{playingAudioUrl === editMeta.audio_url ? 'إيقاف التشغيل' : 'اختبار الصوت الآن'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditMeta({ ...editMeta, audio_url: '' })}
                          className="text-rose-500 hover:text-rose-700 p-1"
                          title="حذف المقطع الصوتي"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* مدة الإعلان على الشاشة */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-800 block">
                      فترة عرض إعلان الطبيب على شاشة النداء
                    </label>
                    <p className="text-[11px] text-gray-500">
                      المدة الزمنية بالثواني التي تظل فيها صورة الطبيب معروضة مع تشغيل صوته مرة واحدة
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={10}
                      max={180}
                      step={5}
                      value={editMeta.ad_duration_seconds || DEFAULT_AD_DURATION}
                      onChange={(e) =>
                        setEditMeta({
                          ...editMeta,
                          ad_duration_seconds: Math.max(5, parseInt(e.target.value, 10) || DEFAULT_AD_DURATION),
                        })
                      }
                      className="w-20 border rounded-xl p-2 text-xs font-mono font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-gray-600">ثانية</span>
                  </div>
                </div>
              </div>

              {/* القسم 2: مواعيد العمل بالمركز باليوم والتوقيت والتواجد التلقائي */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span>2. مواعيد العمل بالمركز (تحديد التواجد التلقائي)</span>
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      يتم تحديد الطبيب كـ &quot;متواجد&quot; تلقائياً خلال هذه الساعات، ويرجع تلقائياً لـ &quot;غير متواجد&quot; بعدها
                    </p>
                  </div>

                  {/* أزرار الضبط السريع */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-gray-400 ml-1">تطبيق جاهز:</span>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetShift('morning')}
                      className="px-2 py-0.5 rounded bg-white hover:bg-gray-100 border text-gray-700 font-bold"
                    >
                      صباحي (09-15)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetShift('evening')}
                      className="px-2 py-0.5 rounded bg-white hover:bg-gray-100 border text-gray-700 font-bold"
                    >
                      مسائي (16-22)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetShift('fullday')}
                      className="px-2 py-0.5 rounded bg-white hover:bg-gray-100 border text-gray-700 font-bold"
                    >
                      دوام كامل (10-20)
                    </button>
                  </div>
                </div>

                {/* جدول أيام الأسبوع */}
                <div className="space-y-2">
                  {DAYS_OF_WEEK.map((d) => {
                    const shift = (editMeta.schedules || []).find((s) => s.day === d.day) || {
                      id: `shift-${d.day}`,
                      day: d.day,
                      dayName: d.name,
                      startTime: '10:00',
                      endTime: '18:00',
                      enabled: false,
                    };

                    const handleToggleDay = (enabled: boolean) => {
                      const updated = (editMeta.schedules || []).map((s) =>
                        s.day === d.day ? { ...s, enabled } : s
                      );
                      setEditMeta({ ...editMeta, schedules: updated });
                    };

                    const handleTimeChange = (field: 'startTime' | 'endTime', val: string) => {
                      const updated = (editMeta.schedules || []).map((s) =>
                        s.day === d.day ? { ...s, [field]: val } : s
                      );
                      setEditMeta({ ...editMeta, schedules: updated });
                    };

                    return (
                      <div
                        key={d.day}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                          shift.enabled ? 'bg-white border-emerald-200 shadow-2xs' : 'bg-gray-100/60 border-gray-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3 w-36">
                          <input
                            type="checkbox"
                            id={`shift-day-${d.day}`}
                            checked={shift.enabled}
                            onChange={(e) => handleToggleDay(e.target.checked)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <label
                            htmlFor={`shift-day-${d.day}`}
                            className="font-bold text-gray-800 text-xs cursor-pointer select-none"
                          >
                            يوم {d.name}
                          </label>
                        </div>

                        {shift.enabled ? (
                          <div className="flex items-center gap-2 flex-1 justify-end">
                            <span className="text-[11px] text-gray-500 font-semibold">من:</span>
                            <input
                              type="time"
                              value={shift.startTime}
                              onChange={(e) => handleTimeChange('startTime', e.target.value)}
                              className="border rounded-lg px-2 py-1 text-xs font-mono font-bold bg-white outline-none focus:ring-1 focus:ring-emerald-500"
                            />

                            <span className="text-[11px] text-gray-500 font-semibold">إلى:</span>
                            <input
                              type="time"
                              value={shift.endTime}
                              onChange={(e) => handleTimeChange('endTime', e.target.value)}
                              className="border rounded-lg px-2 py-1 text-xs font-mono font-bold bg-white outline-none focus:ring-1 focus:ring-emerald-500"
                            />

                            <button
                              type="button"
                              onClick={() => handleApplyTimeToAllDays(shift)}
                              className="text-[10px] text-emerald-700 hover:underline font-bold px-2 py-1"
                              title="نسخ نفس التوقيت لكافة أيام الأسبوع"
                            >
                              تطبيق على الكل
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 font-semibold mr-auto">
                            عطلة / لا يوجد دوام
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* أزرار الحفظ والإغلاق */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEditingDoctor(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleSaveDoctorMeta}
                disabled={savingDoctor}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {savingDoctor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>حفظ التعديلات واعتماد المواعيد</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تخصيص تخطيط وألوان الشاشة */}
      <QueueLayoutSettingsModal
        isOpen={showLayoutModal}
        onClose={() => setShowLayoutModal(false)}
        config={layoutConfig}
        onChange={setLayoutConfig}
        onSaveToDB={async () => {
          setIsSavingLayout(true);
          setLayoutSaveSuccess(false);
          const res = await saveQueueLayoutConfig(layoutConfig);
          setIsSavingLayout(false);
          if (res.success) {
            setLayoutSaveSuccess(true);
            setTimeout(() => setLayoutSaveSuccess(false), 4000);
          } else {
            alert(res.error || 'تعذر حفظ الإعدادات');
          }
        }}
        onResetToDefaults={() => {
          if (confirm('هل ترغب حقاً في استعادة الإعدادات الأصلية للشاشة؟')) {
            setLayoutConfig({ ...DEFAULT_QUEUE_LAYOUT_CONFIG });
          }
        }}
        isSaving={isSavingLayout}
        saveSuccess={layoutSaveSuccess}
      />
    </div>
  );
}
