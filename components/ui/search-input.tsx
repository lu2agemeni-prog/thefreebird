'use client';

// ============================================================================
// components/ui/search-input.tsx
// خانة بحث موحّدة لكل لوحات التحكم — البحث كان موجودًا في 3 شاشات فقط
// من 32 (الأمانة والمحاسب بلا بحث خاصةً).
// ============================================================================

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onValueChange, placeholder = 'بحث...', className, ...props }: SearchInputProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className="flex h-9 w-full rounded-md border border-gray-200 bg-transparent pr-9 pl-8 py-1 text-sm shadow-sm transition-colors placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange('')}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="مسح البحث"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
