'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Sidebar, SidebarItem } from './Sidebar';
import { 
  Settings, Users, Building, Calculator, 
  Stethoscope, CreditCard, Activity, QrCode, Shield,
  BarChart, FileText, Download, CheckCircle, MessageSquare, Newspaper, List,
  Loader2, Plus, X, Send
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { SecretaryCallQueue } from './secretary/SecretaryCallQueue';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { ErrorState, InlineError } from '../ui/error-state';
import { Pagination } from '../ui/pagination';
import { SearchInput } from '../ui/search-input';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  toAppointmentStatus, APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_COLORS,
  toComplaintStatus, COMPLAINT_STATUS_LABELS, COMPLAINT_STATUS_COLORS,
  toComplaintType, COMPLAINT_TYPE_LABELS,
  toCallQueueStatus, CALL_QUEUE_STATUS_LABELS, CALL_QUEUE_STATUS_COLORS,
  toTransactionType, TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS,
} from '@/lib/types';

const FETCH_CAP = 2000;
const PAGE_SIZE = 10;

const managerNav: SidebarItem[] = [
  { name: 'لوحة القيادة', id: 'dashboard', icon: Activity },
  { name: 'الملفات الطبية', id: 'medical_records', icon: FileText },
  { name: 'الأطباء', id: 'doctors', icon: Stethoscope },
  { name: 'العيادات', id: 'clinics', icon: Building },
  { name: 'صلاحيات المستخدمين', id: 'staff_management', icon: Shield },
  { name: 'الخدمات والأسعار', id: 'services', icon: List },
  { name: 'النداء الآلي', id: 'call_queue', icon: Activity },
  { name: 'الماليات والأرباح', id: 'financials', icon: Calculator },
  { name: 'الأخبار الطبية', id: 'medical_news', icon: Newspaper },
  { name: 'التقارير الشاملة', id: 'reports', icon: BarChart },
  { name: 'QR Codes', id: 'qrcodes', icon: QrCode },
];

export function ManagerDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Data States
  const [users, setUsers] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [reportTab, setReportTab] = useState('clinics');
  const [loading, setLoading] = useState(false);
  const [loadErrors, setLoadErrors] = useState<Record<string, string | null>>({});

  // حالة الخطأ مع إعادة المحاولة لكل جدول
  const setTableError = (table: string, msg: string | null) => {
    setLoadErrors(prev => ({ ...prev, [table]: msg }));
  };
  const tableError = (table: string): string | null => loadErrors[table] || null;

  // Search states — كان البحث في تبويب واحد فقط من 11
  const [searchQuery, setSearchQuery] = useState('');       // medical_records
  const [doctorsSearch, setDoctorsSearch] = useState('');
  const [clinicsSearch, setClinicsSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [queueSearch, setQueueSearch] = useState('');
  const [finSearch, setFinSearch] = useState('');
  const [reportSearch, setReportSearch] = useState('');

  // Pagination states (client-side)
  const [patientsPage, setPatientsPage] = useState(0);
  const [staffPage, setStaffPage] = useState(0);
  const [doctorsPage, setDoctorsPage] = useState(0);
  const [clinicsPage, setClinicsPage] = useState(0);
  const [queuePage, setQueuePage] = useState(0);
  const [finPage, setFinPage] = useState(0);
  const [reportPage, setReportPage] = useState(0);

  useEffect(() => {
    setPatientsPage(0);
  }, [searchQuery]);
  useEffect(() => { setStaffPage(0); }, [staffSearch]);
  useEffect(() => { setDoctorsPage(0); }, [doctorsSearch]);
  useEffect(() => { setClinicsPage(0); }, [clinicsSearch]);
  useEffect(() => { setQueuePage(0); }, [queueSearch]);
  useEffect(() => { setFinPage(0); }, [finSearch]);
  useEffect(() => { setReportPage(0); }, [reportSearch, reportTab]);

  // ==== تصفية البحث + فهرسة صفحة مأمونة (كان البحث في تبويب واحد فقط من 11 ولا ترقيم إطلاقًا) ====
  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(p => {
      const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
      return fullName.includes(q)
        || (p.phone && p.phone.toLowerCase().includes(q))
        || (p.patient_code && p.patient_code.toLowerCase().includes(q));
    });
  }, [patients, searchQuery]);

  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => {
      const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
      return fullName.includes(q)
        || (u.email && u.email.toLowerCase().includes(q))
        || (u.role && u.role.toLowerCase().includes(q))
        || (u.id && u.id.toLowerCase().includes(q));
    });
  }, [users, staffSearch]);

  const filteredDoctors = useMemo(() => {
    const q = doctorsSearch.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter(d => `${d.first_name} ${d.last_name}`.toLowerCase().includes(q) || (d.email && d.email.toLowerCase().includes(q)));
  }, [doctors, doctorsSearch]);

  const filteredClinics = useMemo(() => {
    const q = clinicsSearch.trim().toLowerCase();
    if (!q) return clinics;
    return clinics.filter(c => (c.name || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));
  }, [clinics, clinicsSearch]);

  const filteredQueue = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter(item => (item.patient_name || '').toLowerCase().includes(q)
      || (item.clinics?.name || '').toLowerCase().includes(q)
      || String(item.token_number || '').includes(q));
  }, [queue, queueSearch]);

  const filteredTransactions = useMemo(() => {
    const q = finSearch.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(t => {
      const byUser = t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}`.toLowerCase() : '';
      return (t.description || '').toLowerCase().includes(q)
        || (t.category || '').toLowerCase().includes(q)
        || (t.type || '').toLowerCase().includes(q)
        || byUser.includes(q);
    });
  }, [transactions, finSearch]);

  const filteredAppointments = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter(a => {
      const patient = a.patient ? `${a.patient.first_name} ${a.patient.last_name}`.toLowerCase() : '';
      const doctor = a.doctor?.profiles ? `${a.doctor.profiles.first_name} ${a.doctor.profiles.last_name}`.toLowerCase() : '';
      const clinic = (a.clinics?.name || '').toLowerCase();
      return patient.includes(q) || doctor.includes(q) || clinic.includes(q) || (a.status || '').toLowerCase().includes(q);
    });
  }, [appointments, reportSearch]);

  const filteredReportTransactions = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(t => {
      const byUser = t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}`.toLowerCase() : '';
      return (t.description || '').toLowerCase().includes(q)
        || (t.category || '').toLowerCase().includes(q)
        || (t.type || '').toLowerCase().includes(q)
        || byUser.includes(q);
    });
  }, [transactions, reportSearch]);

  const filteredComplaints = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    if (!q) return complaints;
    return complaints.filter(c => {
      const byUser = c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}`.toLowerCase() : '';
      return (c.message || '').toLowerCase().includes(q)
        || (c.status || '').toLowerCase().includes(q)
        || (c.type || '').toLowerCase().includes(q)
        || (c.admin_reply || '').toLowerCase().includes(q)
        || byUser.includes(q);
    });
  }, [complaints, reportSearch]);

  const filteredConsultations = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    if (!q) return consultations;
    return consultations.filter(c => {
      const patient = c.patient ? `${c.patient.first_name} ${c.patient.last_name}`.toLowerCase() : '';
      const doctor = c.doctor?.profiles ? `${c.doctor.profiles.first_name} ${c.doctor.profiles.last_name}`.toLowerCase() : '';
      return (c.message || '').toLowerCase().includes(q) || (c.reply || '').toLowerCase().includes(q)
        || patient.includes(q) || doctor.includes(q);
    });
  }, [consultations, reportSearch]);

  // فهارس صفحة محمية من الخروج عن المدى بعد التصفية
  const patientsSafePage = Math.min(patientsPage, Math.max(0, Math.ceil(filteredPatients.length / PAGE_SIZE) - 1));
  const staffSafePage = Math.min(staffPage, Math.max(0, Math.ceil(filteredStaff.length / PAGE_SIZE) - 1));
  const doctorsSafePage = Math.min(doctorsPage, Math.max(0, Math.ceil(filteredDoctors.length / PAGE_SIZE) - 1));
  const clinicsSafePage = Math.min(clinicsPage, Math.max(0, Math.ceil(filteredClinics.length / PAGE_SIZE) - 1));
  const queueSafePage = Math.min(queuePage, Math.max(0, Math.ceil(filteredQueue.length / PAGE_SIZE) - 1));
  const finSafePage = Math.min(finPage, Math.max(0, Math.ceil(filteredTransactions.length / PAGE_SIZE) - 1));
  const appointmentsSafePage = Math.min(reportPage, Math.max(0, Math.ceil(filteredAppointments.length / PAGE_SIZE) - 1));
  const reportFinSafePage = Math.min(reportPage, Math.max(0, Math.ceil(filteredReportTransactions.length / PAGE_SIZE) - 1));
  const complaintsSafePage = Math.min(reportPage, Math.max(0, Math.ceil(filteredComplaints.length / PAGE_SIZE) - 1));
  const consultationsSafePage = Math.min(reportPage, Math.max(0, Math.ceil(filteredConsultations.length / PAGE_SIZE) - 1));

  // Services Form State
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceClinicId, setServiceClinicId] = useState('');

  // News Form State
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsImage, setNewsImage] = useState('');
  const [newsDoctor, setNewsDoctor] = useState('');

  useEffect(() => {
    if (activeTab === 'staff_management') fetchUsers();
    if (activeTab === 'medical_records') fetchPatients();
    if (activeTab === 'doctors' || activeTab === 'medical_news') fetchDoctors();
    if (activeTab === 'clinics' || activeTab === 'dashboard' || activeTab === 'services') fetchClinics();
    if (activeTab === 'services') fetchServices();
    if (activeTab === 'call_queue') fetchQueue();
    if (activeTab === 'financials') fetchTransactions();
    if (activeTab === 'medical_news') fetchNews();
    
    if (activeTab === 'reports') {
      if (reportTab === 'clinics') { fetchAppointments(); fetchClinics(); fetchDoctors(); }
      if (reportTab === 'financials') { fetchTransactions(); fetchUsers(); }
      if (reportTab === 'complaints') fetchComplaints();
      if (reportTab === 'consultations') fetchConsultations();
    }
  }, [activeTab, reportTab]);

  const fetchUsers = async () => {
    setLoading(true);
    setTableError('users', null);
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(FETCH_CAP);
    if (error) setTableError('users', getFriendlyErrorMessage(error, 'تعذر تحميل المستخدمين.'));
    else setUsers(data || []);
    setLoading(false);
  };

  const fetchPatients = async () => {
    setLoading(true);
    setTableError('patients', null);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'patient')
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP);
    if (error) setTableError('patients', getFriendlyErrorMessage(error, 'تعذر تحميل ملفات المرضى.'));
    else setPatients(data || []);
    setLoading(false);
  };

  const fetchDoctors = async () => {
    setLoading(true);
    setTableError('doctors', null);
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'doctor').limit(FETCH_CAP);
    if (error) setTableError('doctors', getFriendlyErrorMessage(error, 'تعذر تحميل قائمة الأطباء.'));
    else setDoctors(data || []);
    setLoading(false);
  };

  const fetchClinics = async () => {
    setLoading(true);
    setTableError('clinics', null);
    const { data, error } = await supabase.from('clinics').select('*').limit(FETCH_CAP);
    if (error) setTableError('clinics', getFriendlyErrorMessage(error, 'تعذر تحميل العيادات.'));
    else setClinics(data || []);
    setLoading(false);
  };

  const fetchQueue = async () => {
    setLoading(true);
    setTableError('queue', null);
    const { data, error } = await supabase.from('call_queue').select('*, clinics(name)').order('updated_at', { ascending: false }).limit(FETCH_CAP);
    if (error) setTableError('queue', getFriendlyErrorMessage(error, 'تعذر تحميل طابور النداء.'));
    else setQueue(data || []);
    setLoading(false);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    setTableError('transactions', null);
    const { data, error } = await supabase.from('transactions').select('*, profiles(first_name, last_name)').order('created_at', { ascending: false }).limit(FETCH_CAP);
    if (error) setTableError('transactions', getFriendlyErrorMessage(error, 'تعذر تحميل المعاملات المالية.'));
    else setTransactions(data || []);
    setLoading(false);
  };

  const fetchAppointments = async () => {
    setLoading(true);
    setTableError('appointments', null);
    const { data, error } = await supabase.from('appointments').select('*, patient:patient_id(first_name, last_name), doctor:doctor_id(profiles(first_name, last_name)), clinics(name)').order('created_at', { ascending: false }).limit(FETCH_CAP);
    if (error) setTableError('appointments', getFriendlyErrorMessage(error, 'تعذر تحميل المواعيد.'));
    else setAppointments(data || []);
    setLoading(false);
  };

  const fetchComplaints = async () => {
    setLoading(true);
    setTableError('complaints', null);
    const { data, error } = await supabase.from('complaints').select('*, profiles(first_name, last_name)').order('created_at', { ascending: false }).limit(FETCH_CAP);
    if (error) setTableError('complaints', getFriendlyErrorMessage(error, 'تعذر تحميل الشكاوى.'));
    else setComplaints(data || []);
    setLoading(false);
  };

  const fetchConsultations = async () => {
    setLoading(true);
    setTableError('consultations', null);
    const { data, error } = await supabase.from('consultations').select('*, patient:patient_id(first_name, last_name), doctor:doctor_id(profiles(first_name, last_name))').order('created_at', { ascending: false }).limit(FETCH_CAP);
    if (error) setTableError('consultations', getFriendlyErrorMessage(error, 'تعذر تحميل الاستشارات.'));
    else setConsultations(data || []);
    setLoading(false);
  };

  const fetchNews = async () => {
    setLoading(true);
    setTableError('news', null);
    const { data, error } = await supabase.from('medical_news').select('*, doctor:doctor_id(first_name, last_name)').order('created_at', { ascending: false }).limit(FETCH_CAP);
    if (error) setTableError('news', getFriendlyErrorMessage(error, 'تعذر تحميل الأخبار الطبية.'));
    else setNews(data || []);
    setLoading(false);
  };

  const fetchServices = async () => {
    setLoading(true);
    setTableError('services', null);
    const { data, error } = await supabase.from('services').select('*, clinic:clinic_id(name)').order('name', { ascending: true }).limit(FETCH_CAP);
    if (error) setTableError('services', getFriendlyErrorMessage(error, 'تعذر تحميل الخدمات.'));
    else setServices(data || []);
    setLoading(false);
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName || !servicePrice || !serviceClinicId) return alert('الرجاء إدخال اسم الخدمة والسعر والعيادة');
    
    const { error } = await supabase.from('services').insert([{
      name: serviceName,
      price: parseFloat(servicePrice),
      clinic_id: serviceClinicId === 'general' ? null : serviceClinicId
    }]);

    if (!error) {
      alert('تم إضافة الخدمة بنجاح');
      setServiceName('');
      setServicePrice('');
      setServiceClinicId('');
      fetchServices();
    } else {
      console.error(error);
      alert('حدث خطأ أثناء إضافة الخدمة');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه الخدمة؟')) {
      await supabase.from('services').delete().eq('id', id);
      fetchServices();
    }
  };

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitle || !newsContent) return alert('الرجاء إدخال العنوان والمحتوى');
    
    const { error } = await supabase.from('medical_news').insert([{
      title: newsTitle,
      content: newsContent,
      image_url: newsImage || null,
      doctor_id: newsDoctor || null
    }]);

    if (!error) {
      alert('تم نشر الخبر الطبي بنجاح!');
      setNewsTitle('');
      setNewsContent('');
      setNewsImage('');
      setNewsDoctor('');
      fetchNews();
    } else {
      alert('حدث خطأ أثناء النشر.');
    }
  };

  const handleDeleteNews = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الخبر؟')) {
      await supabase.from('medical_news').delete().eq('id', id);
      fetchNews();
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      alert('لا توجد بيانات لتصديرها');
      return;
    }
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => 
      Object.values(row).map(val => {
        if (val === null || val === undefined) return '""';
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

// ===== الرد على الشكاوى — نموذج داخلي يكتب admin_reply فعلًا (كان prompt() لا يكتب شيئًا) =====
  const [replyComplaintId, setReplyComplaintId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyOk, setReplyOk] = useState<string | null>(null);

  const openReplyForm = (id: string, existing: string = '') => {
    setReplyComplaintId(id);
    setReplyText(existing);
    setReplyError(null);
    setReplyOk(null);
  };

  const submitReply = async () => {
    if (!replyComplaintId) return;
    if (!replyText.trim() || replyText.trim().length < 5) {
      setReplyError('يرجى كتابة رد لا يقل عن 5 أحرف.');
      return;
    }
    setReplySaving(true);
    setReplyError(null);
    // الكتابة الفعلية لعمود admin_reply + إغلاق الشكوى — تُشغّل إشعار notify_complaint_reply للمريض
    const { error } = await supabase
      .from('complaints')
      .update({ admin_reply: replyText.trim(), status: 'resolved' })
      .eq('id', replyComplaintId);
    setReplySaving(false);
    if (error) {
      setReplyError(getFriendlyErrorMessage(error, 'تعذر حفظ الرد.'));
    } else {
      setReplyOk('تم حفظ الرد وإرسال إشعار للمريض.');
      setReplyText('');
      setReplyComplaintId(null);
      fetchComplaints();
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } else {
      setTableError('users', getFriendlyErrorMessage(error, ''));
    }
  };

// ===== إضافة عيادة — نموذج داخلي بدل prompt() =====
  const [newClinicName, setNewClinicName] = useState('');
  const [newClinicDesc, setNewClinicDesc] = useState('');
  const [addingClinic, setAddingClinic] = useState(false);
  const [addClinicError, setAddClinicError] = useState<string | null>(null);

  const handleAddClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddClinicError(null);
    if (!newClinicName.trim()) {
      setAddClinicError('يرجى إدخال اسم العيادة.');
      return;
    }
    setAddingClinic(true);
    const { error } = await supabase.from('clinics').insert([{ name: newClinicName.trim(), description: newClinicDesc.trim() || 'تمت إضافتها حديثًا' }]);
    setAddingClinic(false);
    if (error) {
      setAddClinicError(getFriendlyErrorMessage(error, 'تعذر إضافة العيادة.'));
    } else {
      setNewClinicName('');
      setNewClinicDesc('');
      fetchClinics();
    }
  };

  return (
    <div className="flex h-full w-full">
      <Sidebar items={managerNav} activeItem={activeTab} setActiveItem={setActiveTab} />
      <div className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 mb-8">{managerNav.find(n => n.id === activeTab)?.name}</h2>
          
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="إجمالي الأطباء" value="قريباً" icon={<Stethoscope />} />
              <StatCard title="العيادات النشطة" value={clinics.length.toString()} icon={<Building />} />
              <StatCard title="مرضى اليوم" value="0" icon={<Users />} />
              <StatCard title="إيرادات اليوم" value="0 ج.م" icon={<Calculator />} />
            </div>
          )}

          {activeTab === 'doctors' && (
            <Card>
              <CardHeader>
                <CardTitle>أطباء المركز</CardTitle>
                <CardDescription>قائمة بجميع الأطباء المسجلين في النظام</CardDescription>
                <div className="mt-3 max-w-md">
                  <SearchInput value={doctorsSearch} onValueChange={setDoctorsSearch} placeholder="ابحث باسم الطبيب أو البريد..." />
                </div>
              </CardHeader>
              <CardContent>
                {tableError('doctors') && <ErrorState message={tableError('doctors')!} onRetry={fetchDoctors} compact />}
                {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDoctors.length === 0 ? (
                      <p className="text-gray-500">لا يوجد أطباء مسجلين. قم بتغيير صلاحية أحد المستخدمين إلى "طبيب" من شاشة الصلاحيات.</p>
                    ) : filteredDoctors.slice(doctorsSafePage * PAGE_SIZE, doctorsSafePage * PAGE_SIZE + PAGE_SIZE).map((doc) => (
                      <div key={doc.id} className="border p-4 rounded-xl flex items-center gap-4 bg-white shadow-sm">
                        {doc.avatar_url ? (
                          <Image src={doc.avatar_url} alt="" width={64} height={64} className="w-16 h-16 rounded-full object-cover" unoptimized={false} />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xl font-bold">
                            {doc.first_name?.[0]}
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-lg">د. {doc.first_name} {doc.last_name}</h4>
                          <p className="text-gray-500 text-sm">{doc.email}</p>
                          <span className="inline-block mt-2 text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">طبيب مفعل</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              {!loading && <Pagination page={doctorsSafePage} pageSize={PAGE_SIZE} total={filteredDoctors.length} onPageChange={setDoctorsPage} isLoading={loading} />}
              </CardContent>
            </Card>
          )}

          {activeTab === 'clinics' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>العيادات والتخصصات</CardTitle>
                  <CardDescription>إدارة العيادات المتاحة في المركز</CardDescription>
                </div>
                
                <div className="mt-3 max-w-md">
                  <SearchInput value={clinicsSearch} onValueChange={setClinicsSearch} placeholder="ابحث باسم العيادة أو الوصف..." />
                </div>
              </CardHeader>
              <CardContent>
                {tableError('clinics') && <ErrorState message={tableError('clinics')!} onRetry={fetchClinics} compact />}
                {/* نموذج إضافة عيادة — كان prompt() قبلًا */}
                <form onSubmit={handleAddClinic} className="mb-6 flex flex-col md:flex-row gap-3 items-end bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-gray-500 mb-1">اسم العيادة الجديدة</label>
                    <input
                      type="text"
                      value={newClinicName}
                      onChange={(e) => setNewClinicName(e.target.value)}
                      className="w-full border rounded-lg p-2 text-sm"
                      placeholder="مثال: عيادة الأسنان"
                      required
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-gray-500 mb-1">الوصف (اختياري)</label>
                    <input
                      type="text"
                      value={newClinicDesc}
                      onChange={(e) => setNewClinicDesc(e.target.value)}
                      className="w-full border rounded-lg p-2 text-sm"
                      placeholder="وصف مختصر للعيادة..."
                    />
                  </div>
                  <button type="submit" disabled={addingClinic} className="bg-emerald-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 h-[42px] whitespace-nowrap">
                    {addingClinic ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    إضافة عيادة
                  </button>
                  {addClinicError && <div className="w-full"><InlineError message={addClinicError} /></div>}
                </form>

                {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredClinics.length === 0 ? (
                      <p className="text-gray-500">لا توجد عيادات. اضغط على الزر أعلاه لإضافة عيادة.</p>
                    ) : filteredClinics.slice(clinicsSafePage * PAGE_SIZE, clinicsSafePage * PAGE_SIZE + PAGE_SIZE).map((clinic) => (
                      <div key={clinic.id} className="border p-4 rounded-xl flex items-center justify-between bg-white shadow-sm hover:border-emerald-200 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                            <Building className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-lg">{clinic.name}</h4>
                            <p className="text-gray-500 text-sm">{clinic.description || 'بدون وصف'}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${clinic.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {clinic.is_active ? 'نشط' : 'غير نشط'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              {!loading && <Pagination page={clinicsSafePage} pageSize={PAGE_SIZE} total={filteredClinics.length} onPageChange={setClinicsPage} isLoading={loading} />}
              </CardContent>
            </Card>
          )}

          {activeTab === 'staff_management' && (
            <Card>
              <CardHeader>
                <CardTitle>إدارة صلاحيات المستخدمين</CardTitle>
                <CardDescription>التحكم في أدوار جميع المسجلين في النظام (مدير، طبيب، سكرتارية، محاسب، مريض)</CardDescription>
                <div className="mt-3 max-w-md">
                  <SearchInput value={staffSearch} onValueChange={setStaffSearch} placeholder="ابحث بالاسم أو البريد أو الدور..." />
                </div>
              </CardHeader>
              <CardContent>
                {tableError('users') && <ErrorState message={tableError('users')!} onRetry={fetchUsers} compact />}
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
                        {filteredStaff.slice(staffSafePage * PAGE_SIZE, staffSafePage * PAGE_SIZE + PAGE_SIZE).map((user) => (
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
                            <td className="p-4 text-sm text-gray-500 font-mono">
                              {user.id.substring(0, 8)}...
                            </td>
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
                        {filteredStaff.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-gray-500">
                              لا يوجد مستخدمين مسجلين حتى الآن
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              {!loading && <Pagination page={staffSafePage} pageSize={PAGE_SIZE} total={filteredStaff.length} onPageChange={setStaffPage} isLoading={loading} />}
              </CardContent>
            </Card>
          )}

          {activeTab === 'medical_records' && (
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>الملفات الطبية للمرضى</CardTitle>
                    <CardDescription>بحث واستعراض ملفات المرضى المسجلين</CardDescription>
                  </div>
                  <div className="w-full md:w-80">
                    <SearchInput value={searchQuery} onValueChange={setSearchQuery} placeholder="ابحث بالاسم، رقم التليفون، أو الكود..." />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {tableError('patients') && <ErrorState message={tableError('patients')!} onRetry={fetchPatients} compact />}
                {loading ? (
                  <p className="text-gray-500 py-4">جاري تحميل الملفات...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="p-4 font-semibold text-gray-600">الكود الطبي</th>
                          <th className="p-4 font-semibold text-gray-600">اسم المريض</th>
                          <th className="p-4 font-semibold text-gray-600">رقم الهاتف</th>
                          <th className="p-4 font-semibold text-gray-600">تاريخ التسجيل</th>
                          <th className="p-4 font-semibold text-gray-600">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPatients.slice(patientsSafePage * PAGE_SIZE, patientsSafePage * PAGE_SIZE + PAGE_SIZE).map(patient => (
                          <tr key={patient.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-bold text-emerald-600 text-lg">
                              {patient.patient_code || '---'}
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-gray-800">{patient.first_name} {patient.last_name}</div>
                            </td>
                            <td className="p-4 text-gray-600">
                              <span dir="ltr">{patient.phone || 'غير مسجل'}</span>
                            </td>
                            <td className="p-4 text-gray-500 text-sm">
                              {new Date(patient.created_at).toLocaleDateString('ar-EG')}
                            </td>
                            <td className="p-4">
                              <button className="text-emerald-600 hover:text-emerald-800 text-sm font-bold bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
                                عرض الملف
                              </button>
                            </td>
                          </tr>
                        ))}
                        {patients.length > 0 && filteredPatients.length === 0 && (
                          <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا توجد نتائج مطابقة للبحث</td></tr>
                        )}
                        {patients.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-gray-500">
                              لا يوجد مرضى مسجلين حتى الآن
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              {!loading && <Pagination page={patientsSafePage} pageSize={PAGE_SIZE} total={filteredPatients.length} onPageChange={setPatientsPage} isLoading={loading} />}
              </CardContent>
            </Card>
          )}

          {activeTab === 'qrcodes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <QRCodeCard title="لائحة الأسعار" url={`${typeof window !== 'undefined' ? window.location.origin : ''}/prices`} desc="QR Code لصفحة الأسعار والخدمات" />
              <QRCodeCard title="الشكاوى والاقتراحات" url={`${typeof window !== 'undefined' ? window.location.origin : ''}/public/complaints`} desc="QR Code لنموذج الشكاوى والمقترحات" />
              <QRCodeCard title="واي فاي العيادة" url={`${typeof window !== 'undefined' ? window.location.origin : ''}/wifi`} desc="QR Code لصفحة بيانات الواي فاي للزوار" />
              <QRCodeCard title="الحجز السريع" url={`${typeof window !== 'undefined' ? window.location.origin : ''}/book`} desc="QR Code لحجز موعد في العيادات" />
              <QRCodeCard title="شاشة النداء الآلي" url={`${typeof window !== 'undefined' ? window.location.origin : ''}/queue`} desc="QR Code لفتح شاشة العرض العامة على الشاشات الكبيرة" />
              <QRCodeCard title="أطباء المركز" url={`${typeof window !== 'undefined' ? window.location.origin : ''}/doctors`} desc="QR Code لعرض الأطباء ومواعيدهم" />
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>إضافة خدمة جديدة</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateService} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-gray-700 mb-1">اسم الخدمة</label>
                      <input type="text" value={serviceName} onChange={(e) => setServiceName(e.target.value)} required className="w-full border rounded-lg p-2" placeholder="مثال: كشف باطنة" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-gray-700 mb-1">السعر (جنيه)</label>
                      <input type="number" value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} required className="w-full border rounded-lg p-2" placeholder="250" min="0" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-gray-700 mb-1">العيادة التابعة</label>
                      <select value={serviceClinicId} onChange={(e) => setServiceClinicId(e.target.value)} required className="w-full border rounded-lg p-2">
                        <option value="">-- اختر العيادة --</option>
                        <option value="general">خدمة عامة (بدون عيادة)</option>
                        {clinics.map(clinic => (
                          <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" className="bg-emerald-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors h-[42px]">إضافة</button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>الخدمات والأسعار الحالية</CardTitle>
                </CardHeader>
                <CardContent>
                  {tableError('services') && <ErrorState message={tableError('services')!} onRetry={fetchServices} compact />}
                  {loading ? <p className="text-gray-500 py-4">جاري تحميل الخدمات...</p> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="p-3 font-semibold text-gray-600">اسم الخدمة</th>
                            <th className="p-3 font-semibold text-gray-600">العيادة</th>
                            <th className="p-3 font-semibold text-gray-600">السعر</th>
                            <th className="p-3 font-semibold text-gray-600">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {services.length === 0 ? (
                            <tr><td colSpan={4} className="text-center p-4 text-gray-500">لا توجد خدمات مسجلة.</td></tr>
                          ) : services.map(service => (
                            <tr key={service.id} className="border-b">
                              <td className="p-3 font-bold text-gray-800">{service.name}</td>
                              <td className="p-3 text-gray-600">{service.clinic?.name || 'غير محدد'}</td>
                              <td className="p-3 font-bold text-emerald-600">{service.price} ج.م</td>
                              <td className="p-3">
                                <button onClick={() => handleDeleteService(service.id)} className="text-red-500 hover:text-red-700 text-sm font-bold">حذف</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'medical_news' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>نشر خبر طبي جديد</CardTitle>
                  <CardDescription>إضافة مقال أو خبر طبي ليظهر للمرضى في لوحة التحكم الخاصة بهم.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateNews} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">عنوان الخبر / المقال</label>
                      <input type="text" value={newsTitle} onChange={(e) => setNewsTitle(e.target.value)} required className="w-full border rounded-lg p-2" placeholder="مثال: نصائح هامة للوقاية من نزلات البرد" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">المحتوى</label>
                      <textarea value={newsContent} onChange={(e) => setNewsContent(e.target.value)} required rows={4} className="w-full border rounded-lg p-2 resize-none" placeholder="اكتب تفاصيل الخبر هنا..." />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">رابط صورة (اختياري)</label>
                        <input type="url" value={newsImage} onChange={(e) => setNewsImage(e.target.value)} className="w-full border rounded-lg p-2" placeholder="https://example.com/image.jpg" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">الطبيب المقدم للمقال (اختياري)</label>
                        <select value={newsDoctor} onChange={(e) => setNewsDoctor(e.target.value)} className="w-full border rounded-lg p-2">
                          <option value="">-- بدون تحديد طبيب --</option>
                          {doctors.map(doc => (
                            <option key={doc.id} value={doc.id}>د. {doc.first_name} {doc.last_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="bg-emerald-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors">نشر الخبر</button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>الأخبار المنشورة</CardTitle>
                </CardHeader>
                <CardContent>
                  {tableError('news') && <ErrorState message={tableError('news')!} onRetry={fetchNews} compact />}
                  {loading ? <p className="text-gray-500 py-4">جاري تحميل الأخبار...</p> : (
                    <div className="grid grid-cols-1 gap-4">
                      {news.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">لا توجد أخبار منشورة بعد.</p>
                      ) : news.map((post) => (
                        <div key={post.id} className="border rounded-xl p-4 flex gap-4 bg-white">
                          {post.image_url && (
                            <Image src={post.image_url} alt="" width={128} height={128} className="w-32 h-32 object-cover rounded-lg" />
                          )}
                          <div className="flex-1">
                            <h4 className="font-bold text-lg text-emerald-900">{post.title}</h4>
                            {post.doctor && (
                              <p className="text-xs text-gray-500 mb-2">بواسطة: د. {post.doctor.first_name} {post.doctor.last_name}</p>
                            )}
                            <p className="text-gray-700 text-sm line-clamp-2">{post.content}</p>
                            <div className="mt-4 flex justify-between items-center">
                              <span className="text-xs text-gray-400">{new Date(post.created_at).toLocaleDateString('ar-EG')}</span>
                              <button onClick={() => handleDeleteNews(post.id)} className="text-red-500 text-sm font-bold hover:text-red-700">حذف الخبر</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          {activeTab === 'call_queue' && <SecretaryCallQueue />}

          {activeTab === 'financials' && (
            <Card>
              <CardHeader>
                <CardTitle>الماليات والأرباح</CardTitle>
                <CardDescription>سجل الإيرادات والمصروفات الخاصة بالمركز</CardDescription>
                <div className="mt-3 max-w-md">
                  <SearchInput value={finSearch} onValueChange={setFinSearch} placeholder="ابحث بالوصف أو التصنيف أو النوع أو المسئول..." />
                </div>
              </CardHeader>
              <CardContent>
                {tableError('transactions') && <ErrorState message={tableError('transactions')!} onRetry={fetchTransactions} compact />}
                {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="p-4 font-semibold text-gray-600">التاريخ</th>
                          <th className="p-4 font-semibold text-gray-600">النوع</th>
                          <th className="p-4 font-semibold text-gray-600">التصنيف</th>
                          <th className="p-4 font-semibold text-gray-600">المبلغ</th>
                          <th className="p-4 font-semibold text-gray-600">البيان</th>
                          <th className="p-4 font-semibold text-gray-600">بواسطة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.slice(finSafePage * PAGE_SIZE, finSafePage * PAGE_SIZE + PAGE_SIZE).map((t) => (
                          <tr key={t.id} className="border-b hover:bg-gray-50">
                            <td className="p-4 text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${TRANSACTION_TYPE_COLORS[toTransactionType(t.type)]}`}>
                                {TRANSACTION_TYPE_LABELS[toTransactionType(t.type)]}
                              </span>
                            </td>
                            <td className="p-4">{t.category}</td>
                            <td className="p-4 font-bold" dir="ltr">{t.amount} EGP</td>
                            <td className="p-4 text-gray-600">{t.description}</td>
                            <td className="p-4 text-sm">{t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}` : 'غير محدد'}</td>
                          </tr>
                        ))}
                        {filteredTransactions.length === 0 && (
                          <tr><td colSpan={6} className="p-8 text-center text-gray-500">لا توجد حركات مالية مسجلة حتى الآن</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              {!loading && <Pagination page={finSafePage} pageSize={PAGE_SIZE} total={filteredTransactions.length} onPageChange={setFinPage} isLoading={loading} />}
              </CardContent>
            </Card>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Reports Navigation */}
              <div className="flex flex-wrap gap-2 mb-6">
                <button onClick={() => setReportTab('clinics')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${reportTab === 'clinics' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>العيادات والكشوفات</button>
                <button onClick={() => setReportTab('financials')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${reportTab === 'financials' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>الحسابات والماليات</button>
                <button onClick={() => setReportTab('complaints')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${reportTab === 'complaints' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>الشكاوى والمقترحات</button>
                <button onClick={() => setReportTab('consultations')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${reportTab === 'consultations' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>الاستشارات الطبية</button>
              </div>

                            {/* بحث موحد للتقرير المفعل حاليًا */}
              <div className="max-w-md mb-2">
                <SearchInput value={reportSearch} onValueChange={setReportSearch} placeholder="ابحث داخل نتائج التقرير..." />
              </div>

{/* Clinics & Doctors Report */}
              {reportTab === 'clinics' && (
                <Card>
                  <CardHeader className="flex flex-row justify-between items-center">
                    <div>
                      <CardTitle>تقارير العيادات والكشوفات الطبية</CardTitle>
                      <CardDescription>إحصائيات المواعيد والكشوفات لجميع العيادات والأطباء</CardDescription>
                    </div>
                    <button onClick={() => exportToCSV(appointments, 'تقرير_الكشوفات')} className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-200">
                      <Download className="w-4 h-4" />
                      تصدير Excel
                    </button>
                  </CardHeader>
                  <CardContent>
                    {tableError('appointments') && <ErrorState message={tableError('appointments')!} onRetry={fetchAppointments} compact />}
                    {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="p-4 font-semibold text-gray-600">التاريخ</th>
                              <th className="p-4 font-semibold text-gray-600">المريض</th>
                              <th className="p-4 font-semibold text-gray-600">العيادة</th>
                              <th className="p-4 font-semibold text-gray-600">الطبيب</th>
                              <th className="p-4 font-semibold text-gray-600">الحالة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAppointments.slice(appointmentsSafePage * PAGE_SIZE, appointmentsSafePage * PAGE_SIZE + PAGE_SIZE).map((a) => (
                              <tr key={a.id} className="border-b hover:bg-gray-50">
                                <td className="p-4 text-sm">{new Date(a.appointment_date).toLocaleString('ar-EG')}</td>
                                <td className="p-4 font-medium">{a.patient ? `${a.patient.first_name} ${a.patient.last_name}` : 'غير محدد'}</td>
                                <td className="p-4">{a.clinics?.name}</td>
                                <td className="p-4 text-gray-600">{a.doctor?.profiles ? `د. ${a.doctor.profiles.first_name} ${a.doctor.profiles.last_name}` : 'غير محدد'}</td>
                                <td className="p-4">
                                  <span className={`px-2 py-1 rounded-full text-xs ${APPOINTMENT_STATUS_COLORS[toAppointmentStatus(a.status)]}`}>
                                    {APPOINTMENT_STATUS_LABELS[toAppointmentStatus(a.status)]}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {filteredAppointments.length === 0 && (
                              <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا توجد حجوزات أو كشوفات مسجلة</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  {!loading && <Pagination page={appointmentsSafePage} pageSize={PAGE_SIZE} total={filteredAppointments.length} onPageChange={setReportPage} isLoading={loading} />}
                  </CardContent>
                </Card>
              )}

              {/* Financial Report */}
              {reportTab === 'financials' && (
                <Card>
                  <CardHeader className="flex flex-row justify-between items-center">
                    <div>
                      <CardTitle>تقارير الحسابات والماليات الشاملة</CardTitle>
                      <CardDescription>الإيرادات والمصروفات مفصلة لكل طبيب وعامل</CardDescription>
                    </div>
                    <button onClick={() => exportToCSV(transactions, 'التقرير_المالي')} className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-200">
                      <Download className="w-4 h-4" />
                      تصدير Excel
                    </button>
                  </CardHeader>
                  <CardContent>
                    {tableError('transactions') && <ErrorState message={tableError('transactions')!} onRetry={fetchTransactions} compact />}
                    {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="p-4 font-semibold text-gray-600">التاريخ</th>
                              <th className="p-4 font-semibold text-gray-600">النوع</th>
                              <th className="p-4 font-semibold text-gray-600">بواسطة / الطبيب</th>
                              <th className="p-4 font-semibold text-gray-600">المبلغ</th>
                              <th className="p-4 font-semibold text-gray-600">البيان</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredReportTransactions.slice(reportFinSafePage * PAGE_SIZE, reportFinSafePage * PAGE_SIZE + PAGE_SIZE).map((t) => (
                              <tr key={t.id} className="border-b hover:bg-gray-50">
                                <td className="p-4 text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                                <td className="p-4">
                                  <span className={`px-2 py-1 rounded-full text-xs ${t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {TRANSACTION_TYPE_LABELS[toTransactionType(t.type)]}
                                  </span>
                                </td>
                                <td className="p-4 font-medium">{t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}` : 'غير محدد'}</td>
                                <td className="p-4 font-bold" dir="ltr">{t.amount} EGP</td>
                                <td className="p-4 text-gray-600">{t.description}</td>
                              </tr>
                            ))}
                            {filteredReportTransactions.length === 0 && (
                              <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا توجد حركات مالية</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  {!loading && <Pagination page={reportFinSafePage} pageSize={PAGE_SIZE} total={filteredReportTransactions.length} onPageChange={setReportPage} isLoading={loading} />}
                  </CardContent>
                </Card>
              )}

              {/* Complaints Report */}
              {reportTab === 'complaints' && (
                <Card>
                  <CardHeader className="flex flex-row justify-between items-center">
                    <div>
                      <CardTitle>الشكاوى والمقترحات</CardTitle>
                      <CardDescription>اطلع على شكاوى ومقترحات المرضى وقم بالرد عليها</CardDescription>
                    </div>
                    <button onClick={() => exportToCSV(complaints, 'تقرير_الشكاوى')} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200">
                      <Download className="w-4 h-4" />
                      تصدير Excel
                    </button>
                  </CardHeader>
                  <CardContent>
                    {tableError('complaints') && <ErrorState message={tableError('complaints')!} onRetry={fetchComplaints} compact />}
                    {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
                      <div className="grid gap-4">
                        {filteredComplaints.slice(complaintsSafePage * PAGE_SIZE, complaintsSafePage * PAGE_SIZE + PAGE_SIZE).map((c) => (
                          <div key={c.id} className="border rounded-xl p-4 bg-white shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${toComplaintType(c.type) === 'complaint' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {COMPLAINT_TYPE_LABELS[toComplaintType(c.type)]}
                                </span>
                                <span className="font-bold text-gray-900">{c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : 'زائر غير مسجل'}</span>
                                <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('ar-EG')}</span>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs ${COMPLAINT_STATUS_COLORS[toComplaintStatus(c.status)]}`}>
                                  {COMPLAINT_STATUS_LABELS[toComplaintStatus(c.status)]}
                                </span>
                            </div>
                            <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 mb-3">{c.message}</p>
                            
                            {c.admin_reply && (
                              <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                                <p className="font-bold text-emerald-700 mb-1">رد الإدارة:</p>
                                {c.admin_reply}
                              </div>
                            )}
                            {toComplaintStatus(c.status) !== 'resolved' && (
                              replyComplaintId === c.id ? (
                                <div className="mt-3 space-y-2">
                                  <textarea
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    rows={3}
                                    className="w-full border rounded-lg p-2 text-sm bg-white"
                                    placeholder="اكتب رد الإدارة هنا (سيصل المريض كإشعار)..."
                                  />
                                  {replyError && <InlineError message={replyError} />}
                                  <div className="flex gap-2">
                                    <button onClick={submitReply} disabled={replySaving} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50">
                                      {replySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                      حفظ الرد وإغلاق الشكوى
                                    </button>
                                    <button onClick={() => setReplyComplaintId(null)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                                      <X className="w-4 h-4" /> إلغاء
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => openReplyForm(c.id)} className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:text-emerald-700">
                                  <MessageSquare className="w-4 h-4" /> إضافة رد وإغلاق
                                </button>
                              )
                            )}
                          </div>
                        ))}
                        {filteredComplaints.length === 0 && (
                          <p className="text-gray-500 text-center py-8">لا توجد شكاوى أو مقترحات حتى الآن</p>
                        )}
                      </div>
                    )}
                  {!loading && <Pagination page={complaintsSafePage} pageSize={PAGE_SIZE} total={filteredComplaints.length} onPageChange={setReportPage} isLoading={loading} />}
                  </CardContent>
                </Card>
              )}

              {/* Consultations Report */}
              {reportTab === 'consultations' && (
                <Card>
                  <CardHeader className="flex flex-row justify-between items-center">
                    <div>
                      <CardTitle>الاستشارات الطبية</CardTitle>
                      <CardDescription>الاطلاع على جميع الاستشارات الطبية بين المرضى والأطباء</CardDescription>
                    </div>
                    <button onClick={() => exportToCSV(consultations, 'تقرير_الاستشارات')} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200">
                      <Download className="w-4 h-4" />
                      تصدير Excel
                    </button>
                  </CardHeader>
                  <CardContent>
                    {tableError('consultations') && <ErrorState message={tableError('consultations')!} onRetry={fetchConsultations} compact />}
                    {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
                      <div className="grid gap-4">
                        {filteredConsultations.slice(consultationsSafePage * PAGE_SIZE, consultationsSafePage * PAGE_SIZE + PAGE_SIZE).map((c) => (
                          <div key={c.id} className="border rounded-xl p-4 bg-white shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                              <div className="text-sm">
                                <span className="font-bold text-gray-900">المريض: {c.patient ? `${c.patient.first_name} ${c.patient.last_name}` : 'غير محدد'}</span>
                                <span className="mx-2 text-gray-300">|</span>
                                <span className="text-emerald-700 font-bold">للطبيب: {c.doctor?.profiles ? `د. ${c.doctor.profiles.first_name} ${c.doctor.profiles.last_name}` : 'غير محدد'}</span>
                              </div>
                              <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('ar-EG')}</span>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-700 mb-2">
                              <p className="font-bold text-xs text-gray-500 mb-1">السؤال:</p>
                              {c.message}
                            </div>
                            {c.reply ? (
                              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-sm text-emerald-800">
                                <p className="font-bold text-xs text-emerald-600 mb-1">الرد الطبي:</p>
                                {c.reply}
                              </div>
                            ) : (
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">في انتظار الرد</span>
                            )}
                          </div>
                        ))}
                        {filteredConsultations.length === 0 && (
                          <p className="text-gray-500 text-center py-8">لا توجد استشارات طبية حتى الآن</p>
                        )}
                      </div>
                    )}
                  {!loading && <Pagination page={consultationsSafePage} pageSize={PAGE_SIZE} total={filteredConsultations.length} onPageChange={setReportPage} isLoading={loading} />}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function QRCodeCard({ title, url, desc }: { title: string, url: string, desc: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-6 bg-gray-50 m-6 rounded-lg border">
        <QRCodeSVG value={url} size={200} level="H" includeMargin={true} />
        <p className="mt-4 text-xs text-gray-400 font-mono break-all text-center">{url}</p>
        <button className="mt-4 text-emerald-600 font-medium text-sm border border-emerald-600 px-4 py-2 rounded-lg hover:bg-emerald-50 transition-colors">
          طباعة
        </button>
      </CardContent>
    </Card>
  );
}

function getRoleLabel(role: string) {
  switch (role) {
    case 'manager': return 'مدير';
    case 'doctor': return 'طبيب';
    case 'secretary': return 'سكرتارية';
    case 'accountant': return 'محاسب';
    case 'patient': return 'مريض';
    default: return 'غير معروف';
  }
}