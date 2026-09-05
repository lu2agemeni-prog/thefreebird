'use client';

import { useAuth } from '@/lib/auth';
import { ManagerDashboard } from '@/components/dashboards/ManagerDashboard';
import { DoctorDashboard } from '@/components/dashboards/DoctorDashboard';
import { PatientDashboard } from '@/components/dashboards/PatientDashboard';
import { SecretaryDashboard } from '@/components/dashboards/SecretaryDashboard';
import { AccountantDashboard } from '@/components/dashboards/AccountantDashboard';
import { HeartPulse, LogIn, Loader2 } from 'lucide-react';

export default function HomePage() {
  const { user, loading, loginWithGoogle, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium">جاري التحقق من الحساب...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-emerald-50 flex flex-col items-center justify-center p-4">
        <div className="text-center mb-10 max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <HeartPulse className="w-20 h-20 text-emerald-600 mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-gray-900 mb-3">الطائر الحر</h1>
          <p className="text-lg text-gray-600 mb-8">نظام إدارة متكامل لمركز طبي وعيادات متعددة</p>
          
          <button 
            onClick={loginWithGoogle}
            className="flex items-center justify-center gap-3 w-full bg-white text-gray-800 font-medium py-3 px-4 rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            تسجيل الدخول باستخدام Google
          </button>
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
      default: return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">حسابك قيد المراجعة أو لا يملك صلاحية دخول محددة.</p>
        </div>
      );
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
          {user.avatar_url && (
            <img src={user.avatar_url} alt="Profile" className="w-10 h-10 rounded-full border border-gray-200" />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900">{user.first_name} {user.last_name}</span>
            <span className="text-xs text-gray-500">{user.email}</span>
          </div>
          <button 
            onClick={logout}
            className="ms-4 text-sm font-medium text-red-600 hover:text-red-800 bg-red-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            خروج
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
    default: return 'زائر';
  }
}
