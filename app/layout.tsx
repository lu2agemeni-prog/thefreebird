import type {Metadata, Viewport} from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'الطائر الحر - Free Bird Clinic',
  description: 'نظام إدارة متكامل لمركز طبي وعيادات متعددة',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'الطائر الحر',
  },
  icons: {
    apple: '/logo.png', // Fallback if no specific apple-touch-icon
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-gray-50 text-gray-900" suppressHydrationWarning>
        <AuthProvider>
          {children}
          <PWAInstallPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
