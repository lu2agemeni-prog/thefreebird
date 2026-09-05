'use client';
import { useState, useEffect } from 'react';
import { Sidebar, SidebarItem } from './Sidebar';
import { 
  Settings, Users, Building, Calculator, 
  Stethoscope, CreditCard, Activity, QrCode, Shield,
  BarChart, FileText, Download, CheckCircle, MessageSquare, Newspaper, List
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';

const managerNav: SidebarItem[] = [
  { name: 'لوحة القيادة', id: 'dashboard', icon: Activity },
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
  const [reportTab, setReportTab] = useState('clinics');
  const [loading, setLoading] = useState(false);

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
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  };

  const fetchDoctors = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('role', 'doctor');
    if (data) setDoctors(data);
    setLoading(false);
  };

  const fetchClinics = async () => {
    setLoading(true);
    const { data } = await supabase.from('clinics').select('*');
    if (data) setClinics(data);
    setLoading(false);
  };

  const fetchQueue = async () => {
    setLoading(true);
    const { data } = await supabase.from('call_queue').select('*, clinics(name)').order('updated_at', { ascending: false });
    if (data) setQueue(data);
    setLoading(false);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    const { data } = await supabase.from('transactions').select('*, profiles(first_name, last_name)').order('created_at', { ascending: false });
    if (data) setTransactions(data);
    setLoading(false);
  };

  const fetchAppointments = async () => {
    setLoading(true);
    const { data } = await supabase.from('appointments').select('*, patient:patient_id(first_name, last_name), doctor:doctor_id(profiles(first_name, last_name)), clinics(name)').order('created_at', { ascending: false });
    if (data) setAppointments(data);
    setLoading(false);
  };

  const fetchComplaints = async () => {
    setLoading(true);
    const { data } = await supabase.from('complaints').select('*, profiles(first_name, last_name)').order('created_at', { ascending: false });
    if (data) setComplaints(data);
    setLoading(false);
  };

  const fetchConsultations = async () => {
    setLoading(true);
    const { data } = await supabase.from('consultations').select('*, patient:patient_id(first_name, last_name), doctor:doctor_id(profiles(first_name, last_name))').order('created_at', { ascending: false });
    if (data) setConsultations(data);
    setLoading(false);
  };

  const fetchNews = async () => {
    setLoading(true);
    const { data } = await supabase.from('medical_news').select('*, doctor:doctor_id(first_name, last_name)').order('created_at', { ascending: false });
    if (data) setNews(data);
    setLoading(false);
  };

  const fetchServices = async () => {
    setLoading(true);
    const { data } = await supabase.from('services').select('*, clinic:clinic_id(name)').order('name', { ascending: true });
    if (data) setServices(data);
    setLoading(false);
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName || !servicePrice || !serviceClinicId) return alert('الرجاء إدخال اسم الخدمة والسعر والعيادة');
    
    const { error } = await supabase.from('services').insert([{
      name: serviceName,
      price: parseFloat(servicePrice),
      clinic_id: serviceClinicId
    }]);

    if (!error) {
      alert('تم إضافة الخدمة بنجاح');
      setServiceName('');
      setServicePrice('');
      fetchServices();
    } else {
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

  const handleReplyComplaint = async (id: string) => {
    const reply = prompt('أدخل ردك على هذه الشكوى/المقترح:');
    if (reply) {
      await supabase.from('complaints').update({ status: 'resolved' }).eq('id', id);
      fetchComplaints();
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
  };

  const addDummyClinic = async () => {
    const name = prompt('أدخل اسم العيادة الجديدة (مثال: عيادة الأسنان):');
    if (name) {
      const { error } = await supabase.from('clinics').insert([{ name, description: 'تمت إضافتها حديثاً' }]);
      if (!error) fetchClinics();
    }
  };

  return (
    <div className="flex h-full w-full">
      <Sidebar items={managerNav} activeItem={activeTab} setActiveItem={setActiveTab} />
      <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
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
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {doctors.length === 0 ? (
                      <p className="text-gray-500">لا يوجد أطباء مسجلين. قم بتغيير صلاحية أحد المستخدمين إلى "طبيب" من شاشة الصلاحيات.</p>
                    ) : doctors.map((doc) => (
                      <div key={doc.id} className="border p-4 rounded-xl flex items-center gap-4 bg-white shadow-sm">
                        {doc.avatar_url ? (
                          <img src={doc.avatar_url} alt="" className="w-16 h-16 rounded-full" />
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
                <button onClick={addDummyClinic} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition-colors">
                  + إضافة عيادة
                </button>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clinics.length === 0 ? (
                      <p className="text-gray-500">لا توجد عيادات. اضغط على الزر أعلاه لإضافة عيادة.</p>
                    ) : clinics.map((clinic) => (
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
              </CardContent>
            </Card>
          )}

          {activeTab === 'staff_management' && (
            <Card>
              <CardHeader>
                <CardTitle>إدارة صلاحيات المستخدمين</CardTitle>
                <CardDescription>التحكم في أدوار جميع المسجلين في النظام (مدير، طبيب، سكرتارية، محاسب، مريض)</CardDescription>
              </CardHeader>
              <CardContent>
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
                        {users.map((user) => (
                          <tr key={user.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-medium flex items-center gap-3">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
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
                        {users.length === 0 && (
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
              </CardContent>
            </Card>
          )}

          {activeTab === 'qrcodes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <QRCodeCard title="لائحة الأسعار" url={`${typeof window !== 'undefined' ? window.location.origin : ''}/prices`} desc="QR Code لصفحة الأسعار والخدمات" />
              <QRCodeCard title="الشكاوى والاقتراحات" url={`${typeof window !== 'undefined' ? window.location.origin : ''}/complaints`} desc="QR Code لنموذج الشكاوى والمقترحات" />
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
                  {loading ? <p className="text-gray-500 py-4">جاري تحميل الأخبار...</p> : (
                    <div className="grid grid-cols-1 gap-4">
                      {news.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">لا توجد أخبار منشورة بعد.</p>
                      ) : news.map((post) => (
                        <div key={post.id} className="border rounded-xl p-4 flex gap-4 bg-white">
                          {post.image_url && (
                            <img src={post.image_url} alt="" className="w-32 h-32 object-cover rounded-lg" />
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
          
          {activeTab === 'call_queue' && (
            <Card>
              <CardHeader>
                <CardTitle>النداء الآلي (شاشة الانتظار)</CardTitle>
                <CardDescription>المرضى في طابور الانتظار للعيادات</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="p-4 font-semibold text-gray-600">رقم النداء</th>
                          <th className="p-4 font-semibold text-gray-600">اسم المريض</th>
                          <th className="p-4 font-semibold text-gray-600">العيادة</th>
                          <th className="p-4 font-semibold text-gray-600">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queue.map((q) => (
                          <tr key={q.id} className="border-b hover:bg-gray-50">
                            <td className="p-4 font-bold text-lg text-emerald-600">{q.token_number}</td>
                            <td className="p-4 font-medium">{q.patient_name}</td>
                            <td className="p-4 text-gray-600">{q.clinics?.name || 'غير محدد'}</td>
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${q.status === 'waiting' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {q.status === 'waiting' ? 'في الانتظار' : 'اكتمل'}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {queue.length === 0 && (
                          <tr><td colSpan={4} className="p-8 text-center text-gray-500">لا يوجد مرضى في طابور الانتظار حالياً</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'financials' && (
            <Card>
              <CardHeader>
                <CardTitle>الماليات والأرباح</CardTitle>
                <CardDescription>سجل الإيرادات والمصروفات الخاصة بالمركز</CardDescription>
              </CardHeader>
              <CardContent>
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
                        {transactions.map((t) => (
                          <tr key={t.id} className="border-b hover:bg-gray-50">
                            <td className="p-4 text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {t.type === 'income' ? 'إيراد' : 'مصروف'}
                              </span>
                            </td>
                            <td className="p-4">{t.category}</td>
                            <td className="p-4 font-bold" dir="ltr">{t.amount} EGP</td>
                            <td className="p-4 text-gray-600">{t.description}</td>
                            <td className="p-4 text-sm">{t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}` : 'غير محدد'}</td>
                          </tr>
                        ))}
                        {transactions.length === 0 && (
                          <tr><td colSpan={6} className="p-8 text-center text-gray-500">لا توجد حركات مالية مسجلة حتى الآن</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
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
                            {appointments.map((a) => (
                              <tr key={a.id} className="border-b hover:bg-gray-50">
                                <td className="p-4 text-sm">{new Date(a.appointment_date).toLocaleString('ar-EG')}</td>
                                <td className="p-4 font-medium">{a.patient ? `${a.patient.first_name} ${a.patient.last_name}` : 'غير محدد'}</td>
                                <td className="p-4">{a.clinics?.name}</td>
                                <td className="p-4 text-gray-600">{a.doctor?.profiles ? `د. ${a.doctor.profiles.first_name} ${a.doctor.profiles.last_name}` : 'غير محدد'}</td>
                                <td className="p-4">
                                  <span className={`px-2 py-1 rounded-full text-xs ${a.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {a.status === 'completed' ? 'مكتمل' : 'معلق/ملغي'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {appointments.length === 0 && (
                              <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا توجد حجوزات أو كشوفات مسجلة</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
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
                            {transactions.map((t) => (
                              <tr key={t.id} className="border-b hover:bg-gray-50">
                                <td className="p-4 text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                                <td className="p-4">
                                  <span className={`px-2 py-1 rounded-full text-xs ${t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {t.type === 'income' ? 'إيراد' : 'مصروف'}
                                  </span>
                                </td>
                                <td className="p-4 font-medium">{t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}` : 'غير محدد'}</td>
                                <td className="p-4 font-bold" dir="ltr">{t.amount} EGP</td>
                                <td className="p-4 text-gray-600">{t.description}</td>
                              </tr>
                            ))}
                            {transactions.length === 0 && (
                              <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا توجد حركات مالية</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
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
                    {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
                      <div className="grid gap-4">
                        {complaints.map((c) => (
                          <div key={c.id} className="border rounded-xl p-4 bg-white shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${c.type === 'complaint' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {c.type === 'complaint' ? 'شكوى' : 'اقتراح'}
                                </span>
                                <span className="font-bold text-gray-900">{c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : 'زائر غير مسجل'}</span>
                                <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('ar-EG')}</span>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs ${c.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                {c.status === 'resolved' ? 'تم الرد' : 'مفتوحة'}
                              </span>
                            </div>
                            <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 mb-3">{c.message}</p>
                            
                            {c.status !== 'resolved' && (
                              <button onClick={() => handleReplyComplaint(c.id)} className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:text-emerald-700">
                                <MessageSquare className="w-4 h-4" /> إضافة رد وإغلاق
                              </button>
                            )}
                          </div>
                        ))}
                        {complaints.length === 0 && (
                          <p className="text-gray-500 text-center py-8">لا توجد شكاوى أو مقترحات حتى الآن</p>
                        )}
                      </div>
                    )}
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
                    {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
                      <div className="grid gap-4">
                        {consultations.map((c) => (
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
                        {consultations.length === 0 && (
                          <p className="text-gray-500 text-center py-8">لا توجد استشارات طبية حتى الآن</p>
                        )}
                      </div>
                    )}
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
