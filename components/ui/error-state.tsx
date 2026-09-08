'use client';

// ============================================================================
// components/ui/error-state.tsx
// حالة خطأ موحّدة مع زر إعادة المحاولة — كانت ~18 موضعًا في المشروع تفشل
// بصمت (if (data) setX(data)) فتبقى الشاشة فارغة/جارِ التحميل للأبد.
// ============================================================================

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({ message, onRetry, compact = false }: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'py-6' : 'py-12'} px-4`}
    >
      <AlertTriangle className="h-10 w-10 text-red-500 mb-3" aria-hidden="true" />
      <p className="text-sm font-medium text-red-700 mb-1">
        {message || 'حدث خطأ أثناء تحميل البيانات'}
      </p>
      <p className="text-xs text-gray-500 mb-4">برجاء التحقق من اتصالك ثم إعادة المحاولة</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}

/** نسخة مضغوطة للرسائل داخل النماذج (alert قبيح بدلها) */
export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="text-sm text-red-600 flex items-center gap-1.5" role="alert">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}
