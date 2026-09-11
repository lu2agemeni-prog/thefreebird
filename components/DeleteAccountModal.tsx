'use client';

// ============================================================================
// components/DeleteAccountModal.tsx
// حذف الحساب الذاتي — متاح لأي صاحب حساب (مريض/طبيب/سكرتارية/محاسب/مدير)
// من نفس شريط الهيدر العلوي بجانب زر الخروج. يستدعي دالة SECURITY DEFINER
// (delete_own_account) اللي بتحذف صف auth.users بتاعه، وكل بياناته المرتبطة
// بتتصفّى تلقائيًا حسب قيود CASCADE/SET NULL في قاعدة البيانات.
// ============================================================================
import { useState } from 'react';
import { AlertTriangle, Loader2, X, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';

const CONFIRM_PHRASE = 'حذف حسابي';

function roleWarning(role: string | null | undefined): string {
  switch (role) {
    case 'doctor':
      return 'سيتم حذف ملفك كطبيب نهائيًا، بما في ذلك كل المواعيد والاستشارات المرتبطة بك كطبيب. هذا الإجراء لا يمكن التراجع عنه.';
    case 'patient':
      return 'سيتم حذف ملفك الطبي نهائيًا، بما في ذلك سجل مواعيدك واستشاراتك وروشتاتك. هذا الإجراء لا يمكن التراجع عنه.';
    case 'manager':
      return 'سيتم حذف حساب المدير هذا نهائيًا. لا يمكن حذف آخر حساب مدير في النظام — إن كنت الوحيد، أضف مديرًا آخر أولًا.';
    default:
      return 'سيتم حذف حسابك وكل بياناتك المرتبطة به نهائيًا. هذا الإجراء لا يمكن التراجع عنه.';
  }
}

export function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmText.trim() === CONFIRM_PHRASE;

  const handleDelete = async () => {
    if (!canConfirm) return;
    setDeleting(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc('delete_own_account');

    if (rpcError) {
      setDeleting(false);
      setError(getFriendlyErrorMessage(rpcError, 'تعذر حذف الحساب.'));
      return;
    }

    await logout();
    window.location.href = '/';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-xl font-bold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            حذف الحساب نهائيًا
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={deleting}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 leading-relaxed">
            {roleWarning(user?.role)}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              للتأكيد، اكتب العبارة التالية بالضبط: <span className="text-red-600 font-black">{CONFIRM_PHRASE}</span>
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full border rounded-lg p-3 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none"
              placeholder={CONFIRM_PHRASE}
              autoFocus
              disabled={deleting}
            />
          </div>

          {error && <InlineError message={error} />}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleDelete}
              disabled={!canConfirm || deleting}
              className="flex-1 bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              حذف حسابي نهائيًا
            </button>
            <button
              onClick={onClose}
              disabled={deleting}
              className="px-5 border border-gray-200 text-gray-600 font-bold rounded-lg hover:bg-gray-50"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
