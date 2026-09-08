'use client';

// ============================================================================
// components/ui/pagination.tsx
// ترقيم صفحات موحّد (نفس نمط MedicalNewsViewer: .range() مع count: 'exact').
// كان المشروع كله بدون ترقيم عدا MedicalNewsViewer.
// ============================================================================

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface PaginationProps {
  page: number;          // صفحة حالية تبدأ من 0
  pageSize: number;      // عدد عناصر الصفحة
  total: number;         // الإجمالي (من count: 'exact')
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function Pagination({ page, pageSize, total, onPageChange, isLoading = false }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  const pages: (number | '…')[] = [];
  for (let p = 0; p < totalPages; p++) {
    if (p === 0 || p === totalPages - 1 || Math.abs(p - page) <= 1) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 pt-4" aria-label="ترقيم الصفحات" dir="rtl">
      <p className="text-xs text-gray-500">
        عرض {from}–{to} من {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          disabled={page === 0 || isLoading}
          onClick={() => onPageChange(page - 1)}
          aria-label="الصفحة السابقة"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-xs text-gray-400">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'outline'}
              size="icon"
              disabled={isLoading}
              onClick={() => onPageChange(p)}
              aria-label={`الصفحة ${p + 1}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p + 1}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon"
          disabled={page >= totalPages - 1 || isLoading}
          onClick={() => onPageChange(page + 1)}
          aria-label="الصفحة التالية"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
