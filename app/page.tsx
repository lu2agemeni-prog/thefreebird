'use client';

import { useAuth } from '@/lib/auth';
import { ManagerDashboard } from '@/components/dashboards/ManagerDashboard';
import { DoctorDashboard } from '@/components/dashboards/DoctorDashboard';
import { PatientDashboard } from '@/components/dashboards/PatientDashboard';
import { SecretaryDashboard } from '@/components/dashboards/SecretaryDashboard';
import { AccountantDashboard } from '@/components/dashboards/AccountantDashboard';
import { HeartPulse, LogIn, Loader2, Calculator } from 'lucide-react';

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
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row" dir="rtl">
        {/* Desktop Side Menu */}
        <aside className="hidden md:flex flex-col w-64 bg-emerald-700 text-white shadow-xl min-h-screen fixed right-0 top-0">
          <div className="p-6 flex flex-col items-center border-b border-emerald-600">
            {/* Logo Placeholder - User can replace /logo.png in the public folder */}
            <div className="bg-white p-2 rounded-full mb-3">
               <img src="/logo.png" alt="شعار الطائر الحر" className="w-16 h-16 object-contain rounded-full" onError={(e) => {
                 (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
               }} />
            </div>
            <h1 className="text-2xl font-bold text-center">مركز الطائر الحر</h1>
            <p className="text-emerald-200 text-sm mt-1 text-center">للرعاية الطبية المتكاملة</p>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-2">
            <a href="/" className="flex items-center gap-3 px-4 py-3 bg-emerald-800 text-white rounded-xl transition-colors font-medium">
              <HeartPulse className="w-5 h-5" /> الرئيسية
            </a>
            <a href="/book" className="flex items-center gap-3 px-4 py-3 text-emerald-100 hover:bg-emerald-600 hover:text-white rounded-xl transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              الحجز السريع
            </a>
            <a href="/doctors" className="flex items-center gap-3 px-4 py-3 text-emerald-100 hover:bg-emerald-600 hover:text-white rounded-xl transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              أطباء المركز
            </a>
            <a href="/prices" className="flex items-center gap-3 px-4 py-3 text-emerald-100 hover:bg-emerald-600 hover:text-white rounded-xl transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              الخدمات والأسعار
            </a>
            <a href="/complaints" className="flex items-center gap-3 px-4 py-3 text-emerald-100 hover:bg-emerald-600 hover:text-white rounded-xl transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              الشكاوى والاقتراحات
            </a>
            <a href="/calculators" className="flex items-center gap-3 px-4 py-3 text-emerald-100 hover:bg-emerald-600 hover:text-white rounded-xl transition-colors">
              <Calculator className="w-5 h-5" />
              الحاسبات والأدلة الطبية
            </a>
          </nav>
        </aside>

        {/* Mobile Top Header (Logo) */}
        <div className="md:hidden bg-emerald-700 text-white p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
             <div className="bg-white p-1 rounded-full">
               <img src="/logo.png" alt="شعار الطائر الحر" className="w-10 h-10 object-contain rounded-full" onError={(e) => {
                 (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
               }} />
             </div>
             <h1 className="text-xl font-bold">الطائر الحر</h1>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 md:mr-64 pb-20 md:pb-0">
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-emerald-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
            <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

            <div className="text-center z-10 max-w-2xl w-full">
              <div className="bg-white/80 backdrop-blur-lg p-10 rounded-3xl shadow-xl border border-white">
                <div className="bg-emerald-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain drop-shadow-md" onError={(e) => {
                     (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
                  }} />
                </div>
                
                <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">مرحباً بك في مركز <span className="text-emerald-600">الطائر الحر</span></h2>
                <p className="text-lg md:text-xl text-gray-600 mb-10 leading-relaxed">
                  نقدم رعاية صحية متكاملة بأحدث التقنيات وأفضل الكوادر الطبية لضمان صحتك وصحة عائلتك.
                </p>
                
                <div className="flex flex-col gap-4 max-w-sm mx-auto">
                  <a 
                    href="/calculators"
                    className="flex items-center justify-center gap-3 w-full bg-white text-emerald-700 font-bold text-lg py-3 px-6 rounded-2xl border-2 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all shadow-sm group"
                  >
                    <Calculator className="w-6 h-6" />
                    استخدم الحاسبات والأدلة الطبية
                  </a>

                  <button 
                    onClick={loginWithGoogle}
                    className="flex items-center justify-center gap-3 w-full bg-white text-gray-800 font-bold text-lg py-4 px-6 rounded-2xl border-2 border-gray-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm hover:shadow-md group"
                  >
                    <svg className="w-6 h-6 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    دخول للكادر الطبي / المرضى
                  </button>

                  <a 
                    href="/book"
                    className="flex items-center justify-center gap-3 w-full bg-emerald-600 text-white font-bold text-lg py-4 px-6 rounded-2xl hover:bg-emerald-700 transition-all shadow-md hover:shadow-lg"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    احجز موعدك الآن مجاناً
                  </a>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Mobile Bottom Navbar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
          <a href="/" className="flex flex-col items-center gap-1 text-emerald-600">
            <HeartPulse className="w-6 h-6" />
            <span className="text-[10px] font-bold">الرئيسية</span>
          </a>
          <a href="/doctors" className="flex flex-col items-center gap-1 text-gray-500 hover:text-emerald-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span className="text-[10px] font-bold">الأطباء</span>
          </a>
          <a href="/book" className="flex flex-col items-center gap-1 text-gray-500 hover:text-emerald-600 transition-colors relative">
            <div className="absolute -top-6 bg-emerald-600 text-white p-3 rounded-full shadow-lg border-4 border-gray-50">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <span className="text-[10px] font-bold mt-6 text-emerald-600">حجز موعد</span>
          </a>
          <a href="/prices" className="flex flex-col items-center gap-1 text-gray-500 hover:text-emerald-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            <span className="text-[10px] font-bold">الأسعار</span>
          </a>
          <button onClick={loginWithGoogle} className="flex flex-col items-center gap-1 text-gray-500 hover:text-emerald-600 transition-colors">
            <LogIn className="w-6 h-6" />
            <span className="text-[10px] font-bold">دخول</span>
          </button>
        </nav>
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
