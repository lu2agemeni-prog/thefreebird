'use client';
import { ArrowRight, MessageSquare, Send } from 'lucide-react';
import Link from 'next/link';

export default function ComplaintsPage() {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-emerald-600 text-white p-6 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            الشكاوى والاقتراحات
          </h1>
          <Link href="/" className="flex items-center gap-2 text-emerald-50 hover:text-white transition-colors">
            العودة للرئيسية <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>
      
      <main className="max-w-3xl mx-auto p-6 mt-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <p className="text-gray-600 mb-8 text-lg">
            نحن نهتم برأيك! يرجى ترك أي شكوى أو اقتراح لتطوير خدمات المركز الطبي، وسيتم مراجعتها من قبل الإدارة في أسرع وقت.
          </p>
          
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); alert('تم إرسال رسالتك بنجاح. شكراً لك!'); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الاسم (اختياري)</label>
                <input type="text" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" placeholder="اكتب اسمك هنا" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">رقم الهاتف (اختياري)</label>
                <input type="tel" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" placeholder="للتواصل معك إذا لزم الأمر" dir="rtl" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">نوع الرسالة</label>
              <select className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                <option value="complaint">شكوى</option>
                <option value="suggestion">اقتراح</option>
                <option value="inquiry">استفسار</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">تفاصيل الرسالة <span className="text-red-500">*</span></label>
              <textarea required rows={5} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none" placeholder="اكتب تفاصيل رسالتك هنا بوضوح..."></textarea>
            </div>
            
            <button type="submit" className="w-full bg-emerald-600 text-white font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors">
              <Send className="w-5 h-5" />
              إرسال الرسالة
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
