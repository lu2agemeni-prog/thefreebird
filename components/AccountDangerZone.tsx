'use client';

// ============================================================================
// components/AccountDangerZone.tsx
// قسم "حذف الحساب" — قابل لإعادة الاستخدام في أي صفحة بروفايل (بدل ما يكون
// زرار عائم في الهيدر العلوي لكل الصفحات).
// ============================================================================
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DeleteAccountModal } from './DeleteAccountModal';

export function AccountDangerZone() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Card className="border-red-200">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-gray-800">حذف الحساب نهائيًا</p>
              <p className="text-sm text-gray-500">هذا الإجراء لا يمكن التراجع عنه — سيتم حذف حسابك وكل بياناتك المرتبطة به.</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="text-red-600 font-bold text-sm border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
          >
            حذف حسابي
          </button>
        </CardContent>
      </Card>
      {showModal && <DeleteAccountModal onClose={() => setShowModal(false)} />}
    </>
  );
}
