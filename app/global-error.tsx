'use client';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-4xl font-bold mb-4">حدث خطأ داخلي جسيم</h2>
          <p className="text-gray-500 mb-8">{error.message || "حدث خطأ غير متوقع."}</p>
          <button
            onClick={() => reset()}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
          >
            تحديث الصفحة
          </button>
        </div>
      </body>
    </html>
  );
}
