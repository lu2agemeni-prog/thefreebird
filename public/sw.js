// ============================================================================
// public/sw.js
// Service Worker مسؤول عن استقبال إشعارات Push حتى لو التطبيق مقفول
// (المتصفح بيشغّله في الخلفية). مفيش أي منطق تخزين هنا (زي ما هو موضح في
// تعليمات الـ artifacts) — مجرد استقبال وعرض إشعار.
// ============================================================================

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'إشعار جديد', message: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'الطائر الحر';
  const options = {
    body: data.message || '',
    icon: '/logo.png',
    badge: '/logo.png',
    dir: 'rtl',
    lang: 'ar',
    data: { link: data.link || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c);
      if (existing) {
        existing.navigate(link);
        return existing.focus();
      }
      return self.clients.openWindow(link);
    })
  );
});
