'use client';
import { ArrowRight, Wifi, Copy, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function WifiPage() {
  const [copied, setCopied] = useState(false);
  const networkName = 'FreeBird_Guest';
  const networkPass = '12345678';
  
  const handleCopy = () => {
    navigator.clipboard.writeText(networkPass);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-emerald-600 text-white p-6 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wifi className="w-6 h-6" />
            الإنترنت المجاني
          </h1>
          <Link href="/" className="flex items-center gap-2 text-emerald-50 hover:text-white transition-colors">
            العودة <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>
      
      <main className="max-w-md mx-auto p-6 mt-8">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
            <Wifi className="w-10 h-10 text-emerald-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-2">واي فاي العيادة</h2>
          <p className="text-gray-500 mb-8">قم بمسح الكود بكاميرا هاتفك للاتصال فوراً أو استخدم البيانات أدناه.</p>
          
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 w-full mb-8 flex justify-center">
             <QRCodeSVG value={`WIFI:S:${networkName};T:WPA;P:${networkPass};;`} size={180} level="H" />
          </div>

          <div className="w-full space-y-4 text-right">
            <div>
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">اسم الشبكة (SSID)</span>
              <div className="bg-gray-50 border rounded-lg px-4 py-3 font-mono text-lg text-gray-800 text-center" dir="ltr">
                {networkName}
              </div>
            </div>
            
            <div>
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">كلمة المرور</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-50 border rounded-lg px-4 py-3 font-mono text-lg text-gray-800 text-center" dir="ltr">
                  {networkPass}
                </div>
                <button 
                  onClick={handleCopy}
                  className="bg-emerald-600 text-white p-3 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center w-14 h-14"
                >
                  {copied ? <CheckCircle2 className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
