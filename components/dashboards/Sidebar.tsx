import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon, Menu, X } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-white text-emerald-700 border border-emerald-100 rounded-lg shadow-sm flex items-center justify-center"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Floating Notification Bell for all screens */}
      <div className="fixed top-4 left-4 z-50">
        <NotificationBell />
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 right-0 z-40 w-72 md:w-64 bg-white border-l flex-col transition-transform duration-300 ease-in-out md:static md:flex md:translate-x-0 h-full flex-shrink-0 shadow-2xl md:shadow-none",
        isOpen ? "translate-x-0 flex" : "translate-x-full hidden md:flex"
      )}>
        <div className="p-6 border-b flex items-center justify-center h-24">
          <img src="/logo.png" alt="الطائر الحر" className="w-24 h-auto object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
        </div>
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {items.map((item) => {
            const isActive = activeItem === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveItem(item.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-all",
                  isActive 
                    ? "bg-emerald-50 text-emerald-700 font-bold shadow-sm" 
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-emerald-600" : "text-gray-400")} />
                <span>{item.name}</span>
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  );
}
