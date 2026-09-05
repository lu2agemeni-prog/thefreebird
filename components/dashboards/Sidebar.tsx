import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface SidebarItem {
  name: string;
  icon: LucideIcon;
  id: string;
}

interface SidebarProps {
  items: SidebarItem[];
  activeItem: string;
  setActiveItem: (id: string) => void;
}

export function Sidebar({ items, activeItem, setActiveItem }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-l flex-shrink-0 hidden md:block h-full">
      <nav className="p-4 space-y-2">
        {items.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveItem(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-right transition-colors",
                isActive 
                  ? "bg-emerald-50 text-emerald-700 font-semibold" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-emerald-600" : "text-gray-400")} />
              <span>{item.name}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  );
}
