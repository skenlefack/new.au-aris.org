'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n/translations';

export function Footer() {
  const t = useTranslations('landing');
  return (
    <footer className="relative overflow-hidden border-t-4 border-[#006B3F]" style={{ background: 'linear-gradient(135deg, #D4A843, #C49B38, #E8C875, #D4A843)' }}>
      {/* SVG decorative circles & arcs */}
      <div className="pointer-events-none absolute inset-0">
        <svg className="h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1440 400">
          {/* Large circular arcs */}
          <circle cx="200" cy="350" r="180" fill="none" stroke="white" strokeWidth="0.8" opacity="0.15" />
          <circle cx="200" cy="350" r="140" fill="none" stroke="white" strokeWidth="0.5" opacity="0.1" />
          <circle cx="200" cy="350" r="100" fill="none" stroke="white" strokeWidth="0.3" opacity="0.08" />
          <circle cx="1300" cy="50" r="200" fill="none" stroke="white" strokeWidth="0.8" opacity="0.12" />
          <circle cx="1300" cy="50" r="160" fill="none" stroke="white" strokeWidth="0.5" opacity="0.08" />
          <circle cx="1300" cy="50" r="120" fill="none" stroke="white" strokeWidth="0.3" opacity="0.06" />
          <circle cx="720" cy="-50" r="250" fill="none" stroke="white" strokeWidth="0.6" opacity="0.1" />

          {/* Bubbles */}
          <circle cx="100" cy="80" r="6" fill="white" opacity="0.08" />
          <circle cx="350" cy="40" r="4" fill="white" opacity="0.1" />
          <circle cx="500" cy="120" r="8" fill="white" opacity="0.06" />
          <circle cx="680" cy="60" r="3" fill="white" opacity="0.12" />
          <circle cx="850" cy="150" r="5" fill="white" opacity="0.08" />
          <circle cx="1000" cy="30" r="7" fill="white" opacity="0.07" />
          <circle cx="1150" cy="100" r="4" fill="white" opacity="0.1" />
          <circle cx="1350" cy="180" r="6" fill="white" opacity="0.06" />
          <circle cx="250" cy="200" r="10" fill="white" opacity="0.05" />
          <circle cx="600" cy="280" r="12" fill="white" opacity="0.04" />
          <circle cx="900" cy="320" r="8" fill="white" opacity="0.06" />
          <circle cx="1100" cy="250" r="5" fill="white" opacity="0.08" />
          <circle cx="400" cy="340" r="3" fill="white" opacity="0.1" />
          <circle cx="1250" cy="350" r="9" fill="white" opacity="0.05" />

          {/* Thin decorative arcs */}
          <path d="M0 300 Q 360 200 720 300" fill="none" stroke="white" strokeWidth="0.5" opacity="0.08" />
          <path d="M720 300 Q 1080 400 1440 300" fill="none" stroke="white" strokeWidth="0.5" opacity="0.08" />
          <path d="M0 200 Q 480 100 960 200 Q 1200 260 1440 180" fill="none" stroke="white" strokeWidth="0.3" opacity="0.06" />
        </svg>
      </div>

      {/* Watermark image (filigrane) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <Image
          src="/bd-bottom.png"
          alt=""
          width={1440}
          height={800}
          className="h-full w-full object-cover opacity-[0.08]"
          aria-hidden="true"
        />
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Image
              src="/au-ibar-logo-white.png"
              alt="AU-IBAR — Inter-African Bureau for Animal Resources"
              width={280}
              height={70}
              className="h-14 w-auto object-contain drop-shadow-md"
            />
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#5C3A00]/80">
              {t('footerDescription')}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#3E2100]">
              {t('resources')}
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-[#5C3A00]/80">
              <li><Link href="#" className="transition-colors hover:text-[#3E2100]">{t('documentation')}</Link></li>
              <li><Link href="#" className="transition-colors hover:text-[#3E2100]">{t('apiReference')}</Link></li>
              {/* Data Standards — hidden until content is available */}
              <li><Link href="#" className="transition-colors hover:text-[#3E2100]">{t('trainingPortal')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#3E2100]">
              {t('contact')}
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-[#5C3A00]/80">
              <li>
                <Link href="mailto:ibar.office@au-ibar.org" className="transition-colors hover:text-[#3E2100]">
                  ibar.office@au-ibar.org
                </Link>
              </li>
              <li>
                <Link href="https://www.au-ibar.org" className="transition-colors hover:text-[#3E2100]" target="_blank" rel="noopener noreferrer">
                  www.au-ibar.org
                </Link>
              </li>
            </ul>

            {/* Mobile App Download */}
            <div className="mt-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#3E2100]">
                {t('mobileApp')}
              </h4>
              <a
                href="/aris-mobile.apk"
                download="ARIS-v1.2.0.apk"
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#3E2100]/90 px-4 py-2 text-sm font-medium text-[#E8C875] shadow-md transition-all hover:bg-[#3E2100] hover:shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M17.523 2.237a.625.625 0 0 0-.803.368l-1.1 2.903A9.018 9.018 0 0 0 12 4.75c-1.3 0-2.535.275-3.651.77L7.28 2.605a.625.625 0 1 0-1.17.435l1.065 2.81A9.03 9.03 0 0 0 3 13.25h18a9.03 9.03 0 0 0-4.174-7.4l1.065-2.81a.625.625 0 0 0-.368-.803ZM8.25 10.875a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75Zm7.5 0a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75ZM3 14.5h18v1.25A6.25 6.25 0 0 1 14.75 22h-5.5A6.25 6.25 0 0 1 3 15.75V14.5Z"/>
                </svg>
                {t('downloadAndroid')}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                  <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-[#3E2100]/20 pt-6 text-xs text-[#5C3A00]/70 sm:flex-row">
          <p>{t('copyright', { year: new Date().getFullYear().toString() })}</p>
          <div className="flex gap-4">
            <Link href="/privacy-policy" className="transition-colors hover:text-[#3E2100]">{t('privacyPolicy')}</Link>
            <Link href="/terms-of-service" className="transition-colors hover:text-[#3E2100]">{t('termsOfService')}</Link>
            <Link href="/accessibility" className="transition-colors hover:text-[#3E2100]">{t('accessibility')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
