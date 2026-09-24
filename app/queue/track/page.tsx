'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { PatientLiveQueue } from '@/components/dashboards/patient/PatientLiveQueue';
import { HeartPulse, ArrowRight, Home, LogIn } from 'lucide-react';
import Link from 'next/link';

function TrackContent() {
  const searchParams = useSearchParams();
  const { user, loginWithGoogle } = useAuth();

  const clinicParam = searchParams.get('clinic') || searchParams.get('c');
  const tokenParam = searchParams.get('token') || searchParams.get('t');
  const initialToken = tokenParam ? parseInt(tokenParam, 10) : null;

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col" dir="rtl">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
            >
              <ArrowRight className="w-4 h-4" />
              الرئيسية
            </Link>
            <div className="h-5 w-px bg-gray-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <HeartPulse className="w-4 h-4" />
              </div>
              <div>
                <span className="font-black text-sm text-gray-900 block leading-tight">مركز الطائر الحر</span>
                <span className="text-[10px] text-gray-500 block">شاشة التتبع المباشر من الهاتف</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!user ? (
              <button
                onClick={() => loginWithGoogle()}
                className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1"
              >
                <LogIn className="w-3.5 h-3.5" />
                تسجيل الدخول
              </button>
            ) : (
              <span className="text-xs font-medium text-gray-600 hidden sm:block">
                مرحباً، {user.email?.split('@')[0]}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Track View */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8">
        <PatientLiveQueue
          user={user}
          initialClinicId={clinicParam}
          initialToken={initialToken}
        />
      </main>

      {/* Footer info */}
      <footer className="py-6 border-t border-gray-200 text-center text-xs text-gray-400 bg-white">
        مركز الطائر الحر للرعاية الطبية المتكاملة — خدمة تتبع الدور المباشر للهاتف المحمول
      </footer>
    </div>
  );
}

export default function QueueTrackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-bold text-gray-600">جاري فتح شاشة التتبع المباشر...</p>
        </div>
      }
    >
      <TrackContent />
    </Suspense>
  );
}
