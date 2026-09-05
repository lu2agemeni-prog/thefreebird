'use client';
import { useState } from 'react';
import { Sidebar, SidebarItem } from './Sidebar';
import { Calculator, BarChart, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const accountantNav: SidebarItem[] = [
  { name: 'لوحة الحسابات', id: 'dashboard', icon: Calculator },
  { name: 'المصروفات والمستهلكات', id: 'expenses', icon: FileText },
  { name: 'التقارير التحليلية', id: 'reports', icon: BarChart },
];

const mockData = [
  { name: 'يناير', income: 4000, expense: 2400 },
  { name: 'فبراير', income: 3000, expense: 1398 },
  { name: 'مارس', income: 2000, expense: 9800 },
  { name: 'أبريل', income: 2780, expense: 3908 },
  { name: 'مايو', income: 1890, expense: 4800 },
  { name: 'يونيو', income: 2390, expense: 3800 },
  { name: 'يوليو', income: 3490, expense: 4300 },
];

export function AccountantDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex h-full w-full">
      <Sidebar items={accountantNav} activeItem={activeTab} setActiveItem={setActiveTab} />
      <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 mb-8">{accountantNav.find(n => n.id === activeTab)?.name}</h2>
          
          {activeTab === 'dashboard' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-500 mb-1">إجمالي الأرباح</p>
                    <p className="text-3xl font-bold text-emerald-600">14,500 ج.م</p>
                  </CardContent>
                </Card>
                 <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-500 mb-1">إجمالي المصروفات</p>
                    <p className="text-3xl font-bold text-red-600">6,200 ج.م</p>
                  </CardContent>
                </Card>
                 <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-500 mb-1">صافي الدخل</p>
                    <p className="text-3xl font-bold text-blue-600">8,300 ج.م</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>التحليل البياني للإيرادات والمصروفات</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80 w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={mockData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="income" stroke="#10b981" name="الإيرادات" />
                        <Line type="monotone" dataKey="expense" stroke="#ef4444" name="المصروفات" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
             <Card>
              <CardHeader>
                <CardTitle>واجهة {accountantNav.find(n => n.id === activeTab)?.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">سيتم ربط هذه الشاشة مع قاعدة بيانات Supabase (جدول transactions).</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
