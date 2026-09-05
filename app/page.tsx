'use client';

import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ManagerDashboard } from '@/components/dashboards/ManagerDashboard';
import { DoctorDashboard } from '@/components/dashboards/DoctorDashboard';
import { PatientDashboard } from '@/components/dashboards/PatientDashboard';
import { SecretaryDashboard } from '@/components/dashboards/SecretaryDashboard';
import { AccountantDashboard } from '@/components/dashboards/AccountantDashboard';
import { HeartPulse, Stethoscope, Users, Building, Calculator, UserCheck } from 'lucide-react';

export default function HomePage() {
  const { user, loginAs, logout } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-emerald-50 flex flex-col items-center justify-center p-4">
        <div className="text-center mb-10">
          <HeartPulse className="w-20 h-20 text-emerald-600 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-900 mb-2">الطائر الحر</h1>
          <p className="text-xl text-gray-600">نظام إدارة متكامل لمركز طبي وعيادات متعددة</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
          <LoginCard 
            title="المدير" 
            description="التحكم الكامل بالمركز، العيادات، الأطباء والحسابات" 
            icon={<Building className="w-10 h-10 text-blue-600" />} 
            onClick={() => loginAs('manager')} 
          />
          <LoginCard 
            title="طبيب" 
            description="إدارة المواعيد، استشارات المرضى والنداء الآلي" 
            icon={<Stethoscope className="w-10 h-10 text-emerald-600" />} 
            onClick={() => loginAs('doctor')} 
          />
          <LoginCard 
            title="مريض" 
            description="حجز المواعيد، الإستشارات والبيانات الطبية" 
            icon={<Users className="w-10 h-10 text-purple-600" />} 
            onClick={() => loginAs('patient')} 
          />
          <LoginCard 
            title="سكرتارية" 
            description="إضافة زوار، مواعيد، وتحكم بالنداء الآلي" 
            icon={<UserCheck className="w-10 h-10 text-orange-600" />} 
            onClick={() => loginAs('secretary')} 
          />
          <LoginCard 
            title="مسئول حسابات" 
            description="التقارير المالية، المصروفات وأرباح المركز" 
            icon={<Calculator className="w-10 h-10 text-indigo-600" />} 
            onClick={() => loginAs('accountant')} 
          />
        </div>
        <div className="mt-12 text-sm text-gray-500 max-w-xl text-center">
          ملاحظة: هذا تسجيل دخول تجريبي للواجهات. في النسخة النهائية سيتم ربط كل دخول بقاعدة بيانات Supabase المرفقة.
        </div>
      </div>
    );
  }

  // Render Dashboard based on role
  const renderDashboard = () => {
    switch (user.role) {
      case 'manager': return <ManagerDashboard />;
      case 'doctor': return <DoctorDashboard />;
      case 'patient': return <PatientDashboard />;
      case 'secretary': return <SecretaryDashboard />;
      case 'accountant': return <AccountantDashboard />;
      default: return <div>Unknown Role</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b px-6 py-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <HeartPulse className="w-8 h-8 text-emerald-600" />
          <h2 className="text-xl font-bold text-gray-800">الطائر الحر - لوحة تحكم {getRoleName(user.role)}</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">مرحباً، {user.first_name} {user.last_name}</span>
          <button 
            onClick={logout}
            className="text-sm font-medium text-red-600 hover:text-red-800 bg-red-50 px-4 py-2 rounded-lg transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        {renderDashboard()}
      </main>
    </div>
  );
}

function getRoleName(role: string | null) {
  switch (role) {
    case 'manager': return 'المدير';
    case 'doctor': return 'الطبيب';
    case 'patient': return 'المريض';
    case 'secretary': return 'السكرتارية';
    case 'accountant': return 'الحسابات';
    default: return '';
  }
}

function LoginCard({ title, description, icon, onClick }: { title: string, description: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer border-transparent hover:border-emerald-100 group" onClick={onClick}>
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 p-4 bg-gray-50 rounded-full group-hover:bg-emerald-50 transition-colors">
          {icon}
        </div>
        <CardTitle className="text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <CardDescription className="text-base text-gray-600">{description}</CardDescription>
        <button className="mt-6 w-full bg-gray-900 text-white font-medium py-3 rounded-lg group-hover:bg-emerald-600 transition-colors">
          دخول كـ {title}
        </button>
      </CardContent>
    </Card>
  );
}
