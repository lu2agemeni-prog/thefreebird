'use client';
import { useState, useEffect } from 'react';
import { Sidebar, SidebarItem } from './Sidebar';
import { 
  Settings, Users, Building, Calculator, 
  Stethoscope, CreditCard, Activity, QrCode, Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';

const managerNav: SidebarItem[] = [
  { name: 'لوحة القيادة', id: 'dashboard', icon: Activity },
  { name: 'الأطباء', id: 'doctors', icon: Stethoscope },
  { name: 'العيادات', id: 'clinics', icon: Building },
  { name: 'صلاحيات المستخدمين', id: 'staff_management', icon: Shield },
  { name: 'النداء الآلي', id: 'call_queue', icon: Activity },
  { name: 'الماليات والأرباح', id: 'financials', icon: Calculator },
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'staff_management') fetchUsers();
    if (activeTab === 'doctors') fetchDoctors();
    if (activeTab === 'clinics' || activeTab === 'dashboard') fetchClinics();
    if (activeTab === 'call_queue') fetchQueue();
    if (activeTab === 'financials') fetchTransactions();
  }, [activeTab]);

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
    const { data } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
    if (data) setTransactions(data);
    setLoading(false);
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
                          </tr>
                        ))}
                        {transactions.length === 0 && (
                          <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا توجد حركات مالية مسجلة حتى الآن</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
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
