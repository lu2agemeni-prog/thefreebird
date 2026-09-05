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
  { name: 'الإعدادات العامة', id: 'settings', icon: Settings },
  { name: 'الأطباء', id: 'doctors', icon: Stethoscope },
  { name: 'صلاحيات المستخدمين', id: 'staff_management', icon: Shield },
  { name: 'العاملين', id: 'staff', icon: Users },
  { name: 'الحسابات', id: 'accounts', icon: CreditCard },
  { name: 'العيادات', id: 'clinics', icon: Building },
  { name: 'النداء الآلي', id: 'call_queue', icon: Activity },
  { name: 'الماليات والأرباح', id: 'financials', icon: Calculator },
  { name: 'الخدمات والأسعار', id: 'services', icon: CreditCard },
  { name: 'QR Codes', id: 'qrcodes', icon: QrCode },
];

export function ManagerDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (activeTab === 'staff_management') {
      fetchUsers();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (data) setUsers(data);
    setLoadingUsers(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      alert('حدث خطأ أثناء التحديث: ' + error.message);
    } else {
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      // alert('تم تحديث الصلاحية بنجاح');
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
              <StatCard title="إجمالي الأطباء" value="12" icon={<Stethoscope />} />
              <StatCard title="العيادات النشطة" value="5" icon={<Building />} />
              <StatCard title="مرضى اليوم" value="48" icon={<Users />} />
              <StatCard title="إيرادات اليوم" value="4,500 ج.م" icon={<Calculator />} />
            </div>
          )}

          {activeTab === 'staff_management' && (
            <Card>
              <CardHeader>
                <CardTitle>إدارة صلاحيات المستخدمين</CardTitle>
                <CardDescription>التحكم في أدوار جميع المسجلين في النظام (مدير، طبيب، سكرتارية، محاسب، مريض)</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <QRCodeCard title="لائحة الأسعار" url="https://freebird.clinic/prices" desc="QR Code لصفحة الأسعار والخدمات" />
              <QRCodeCard title="الشكاوى والاقتراحات" url="https://freebird.clinic/complaints" desc="QR Code لنموذج الشكاوى والمقترحات" />
              <QRCodeCard title="واي فاي العيادة" url="WIFI:S:FreeBird_Guest;T:WPA;P:12345678;;" desc="QR Code للاتصال المباشر بشبكة الواي فاي" />
              <QRCodeCard title="العيادة الباطنية" url="https://freebird.clinic/book/internal" desc="QR Code لحجز موعد في العيادة الباطنية" />
            </div>
          )}
          
          {/* Add basic placeholders for other tabs to show it's wired up */}
          {activeTab !== 'dashboard' && activeTab !== 'qrcodes' && activeTab !== 'staff_management' && (
            <Card>
              <CardHeader>
                <CardTitle>جاري تحميل بيانات {managerNav.find(n => n.id === activeTab)?.name}...</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">سيتم ربط هذه الشاشة مع قاعدة بيانات Supabase (جدول {activeTab}).</p>
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
