'use client';
import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, X } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Optional: check if user previously dismissed it
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  // If already running as an installed PWA or if user dismissed the prompt, hide the button
  if (isInstalled || isDismissed) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white p-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-emerald-100 z-50 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-10 fade-in duration-500">
        <div className="flex items-center gap-3 flex-1">
          <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">تثبيت التطبيق</h3>
            <p className="text-xs text-gray-500">أضف الطائر الحر إلى شاشتك الرئيسية لسهولة الوصول</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={install}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm"
          >
            تثبيت
          </button>
          <button onClick={handleDismiss} className="p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white p-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-emerald-100 z-50 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-10 fade-in duration-500">
          <div className="flex items-center gap-3 flex-1">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">تثبيت التطبيق (iOS)</h3>
              <p className="text-xs text-gray-500">أضف الطائر الحر إلى شاشتك الرئيسية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowIOSGuide(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm"
            >
              كيفية التثبيت
            </button>
            <button onClick={handleDismiss} className="p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" dir="rtl">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-600" />
                التثبيت على iPhone / iPad
              </h3>
              <div className="space-y-4 text-sm text-gray-600 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="flex items-start gap-2">
                  <span className="bg-emerald-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                  <span>اضغط على زر <strong>المشاركة (Share)</strong> في شريط المتصفح أسفل الشاشة (أيقونة المربع والسهم للأعلى).</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="bg-emerald-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                  <span>اسحب للأسفل واضغط على <strong>"إضافة للشاشة الرئيسية" (Add to Home Screen)</strong>.</span>
                </p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-800 hover:bg-gray-200 transition-colors"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
