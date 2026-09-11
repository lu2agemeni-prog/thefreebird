'use client';

// ============================================================================
// app/lab-results/page.tsx
// صفحة مستقلة — الوجهة اللي بيوصلها المريض لما يضغط على إشعار "نتيجة تحليل
// جديدة" (الرابط المخزّن في notifications.link). نفس مكوّن سجل التحاليل
// المستخدم داخل لوحة تحكم المريض.
// ============================================================================
import Link from 'next/link';
import { ArrowRight, FlaskConical, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { PatientLabResults } from '@/components/dashboards/patient/PatientLabResults';

export default function LabResultsPage() {
  const { user, loading, loginWithGoogle } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-emerald-600 text-white p-6 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FlaskConical className="w-6 h-6" />
            سجل التحاليل
          </h1>
          <Link href="/" className="flex items-center gap-2 text-emerald-50 hover:text-white transition-colors">
            الرئيسية <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 mt-6">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : !user ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-600 mb-4">يجب تسجيل الدخول لعرض سجل تحاليلك.</p>
            <button onClick={loginWithGoogle} className="bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-emerald-700">
              تسجيل الدخول
            </button>
          </div>
        ) : user.role !== 'patient' ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-500">
            هذه الصفحة خاصة بحسابات المرضى فقط.
          </div>
        ) : (
          <PatientLabResults />
        )}
      </main>
    </div>
  );
}
