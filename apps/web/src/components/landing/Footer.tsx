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
            <div className="flex items-center gap-3">
              <Image
                src="/au-logo.png"
                alt="African Union"
                width={40}
                height={40}
                className="h-10 w-10 object-contain drop-shadow-md"
              />
              <div>
                <p className="text-sm font-bold text-[#3E2100]">
                  AU-IBAR
                </p>
                <p className="text-xs text-[#5C3A00]/70">
                  {t('auIbarFull')}
                </p>
              </div>
            </div>
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
              <li><Link href="#" className="transition-colors hover:text-[#3E2100]">{t('dataStandards')}</Link></li>
              <li><Link href="#" className="transition-colors hover:text-[#3E2100]">{t('trainingPortal')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#3E2100]">
              {t('contact')}
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-[#5C3A00]/80">
              <li>Kenindia Business Park</li>
              <li>Museum Hill, Nairobi, Kenya</li>
              <li className="pt-1">
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
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-[#3E2100]/20 pt-6 text-xs text-[#5C3A00]/70 sm:flex-row">
          <p>{t('copyright', { year: new Date().getFullYear().toString() })}</p>
          <div className="flex gap-4">
            <Link href="#" className="transition-colors hover:text-[#3E2100]">{t('privacyPolicy')}</Link>
            <Link href="#" className="transition-colors hover:text-[#3E2100]">{t('termsOfService')}</Link>
            <Link href="#" className="transition-colors hover:text-[#3E2100]">{t('accessibility')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
