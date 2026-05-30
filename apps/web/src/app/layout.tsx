import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import { Toaster } from 'sonner';
import './globals.css';
import { Providers } from './providers';

const inter = localFont({
  src: './fonts/inter-variable.woff2',
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'ARIS — Animal Resources Information System',
  description:
    'AU-IBAR Continental Digital Infrastructure for Animal Resources across 55 Member States',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ARIS',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#1B5E20',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var theme = localStorage.getItem('aris-theme');
              if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              }
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="font-sans">
        <a
          href="#main-content"
          className="skip-link"
        >
          Skip to main content
        </a>
        <Providers>
          <div id="main-content">{children}</div>
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              duration: 4000,
              style: { fontFamily: 'var(--font-inter), system-ui, sans-serif' },
            }}
          />
        </Providers>
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                  // Dev mode: unregister SW and clear caches to avoid stale content
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    regs.forEach(function(r) { r.unregister(); });
                  });
                  caches.keys().then(function(keys) {
                    keys.forEach(function(k) { caches.delete(k); });
                  });
                } else {
                  // Force a reload when a new service worker takes control
                  // so users stuck on a broken old SW recover automatically.
                  var refreshing = false;
                  navigator.serviceWorker.addEventListener('controllerchange', function() {
                    if (refreshing) return;
                    refreshing = true;
                    window.location.reload();
                  });
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').then(function(reg) {
                      // Immediately ask the browser to revalidate sw.js
                      reg.update().catch(function() {});
                      // Detect new SW being installed and tell it to take over
                      reg.addEventListener('updatefound', function() {
                        var nw = reg.installing;
                        if (!nw) return;
                        nw.addEventListener('statechange', function() {
                          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                            // A new SW is waiting — activate it now
                            nw.postMessage({ type: 'SKIP_WAITING' });
                          }
                        });
                      });
                    }).catch(function() {});
                  });
                }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
