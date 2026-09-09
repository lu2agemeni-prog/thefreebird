'use client';

// ============================================================================
// components/dashboards/secretary/AddWalkInPatientModal.tsx
// إضافة مريض لملفات المرضى فقط (بدون تسجيله في طابور النداء).
// ============================================================================

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { X, Loader2, UserPlus } from 'lucide-react';
import { InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';

interface AddWalkInPatientModalProps {
  onClose: () => void;
  onAdded: () => void;
}

export function AddWalkInPatientModal({ onClose, onAdded }: AddWalkInPatientModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase
      .from('walk_in_patients')
      .insert([{ name: name.trim(), phone: phone.trim() || null, created_by: user?.id || null }]);

    setSubmitting(false);

    if (insertError) {
      setError(getFriendlyErrorMessage(insertError, 'تعذر تسجيل بيانات المريض.'));
      return;
    }

    onAdded();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            إضافة مريض لملفات المرضى
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">اسم المريض *</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg p-3"
              placeholder="الاسم ثلاثي"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">رقم التليفون</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border rounded-lg p-3"
              placeholder="رقم الموبايل"
              dir="ltr"
            />
          </div>

          {error && <InlineError message={error} />}

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
            إضافة المريض
          </button>
        </form>
      </div>
    </div>
  );
}
