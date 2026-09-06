'use client';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-4xl font-bold mb-4">404 - الصفحة غير موجودة</h2>
      <p className="text-gray-500 mb-8">عذراً، لم نتمكن من العثور على الصفحة التي تبحث عنها.</p>
      <Link href="/" className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors">
        العودة للرئيسية
      </Link>
    </div>
  );
}
