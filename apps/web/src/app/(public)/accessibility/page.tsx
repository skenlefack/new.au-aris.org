'use client';

import Link from 'next/link';
import Image from 'next/image';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { useTranslations } from '@/lib/i18n/translations';

export default function AccessibilityPage() {
  const t = useTranslations('legal');

  return (
    <>
      <LandingHeader />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <Image src="/au-logo.png" alt="AU-IBAR" width={48} height={48} className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('accessibilityTitle')}</h1>
            <p className="text-sm text-gray-500">{t('lastUpdated')}</p>
          </div>
        </div>

        <div className="max-w-none text-gray-700 [&_a]:text-[#006B3F] [&_a]:underline [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-800 [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:mb-4 [&_ul]:space-y-1">
          <h2>{t('accessibilityCommitmentTitle')}</h2>
          <p>{t('accessibilityCommitmentBody')}</p>

          <h2>{t('accessibilityStandardsTitle')}</h2>
          <p>{t('accessibilityStandardsBody')}</p>

          <h2>{t('accessibilityFeaturesTitle')}</h2>

          <h3>{t('accessibilityMultilingualTitle')}</h3>
          <p>{t('accessibilityMultilingualBody')}</p>

          <h3>{t('accessibilityVisualTitle')}</h3>
          <ul>
            <li>{t('accessibilityVisual1')}</li>
            <li>{t('accessibilityVisual2')}</li>
            <li>{t('accessibilityVisual3')}</li>
            <li>{t('accessibilityVisual4')}</li>
          </ul>

          <h3>{t('accessibilityNavTitle')}</h3>
          <ul>
            <li>{t('accessibilityNav1')}</li>
            <li>{t('accessibilityNav2')}</li>
            <li>{t('accessibilityNav3')}</li>
            <li>{t('accessibilityNav4')}</li>
          </ul>

          <h3>{t('accessibilityMobileTitle')}</h3>
          <ul>
            <li>{t('accessibilityMobile1')}</li>
            <li>{t('accessibilityMobile2')}</li>
            <li>{t('accessibilityMobile3')}</li>
            <li>{t('accessibilityMobile4')}</li>
            <li>{t('accessibilityMobile5')}</li>
          </ul>

          <h3>{t('accessibilityConnectivityTitle')}</h3>
          <p>{t('accessibilityConnectivityBody')}</p>
          <ul>
            <li>{t('accessibilityConnectivity1')}</li>
            <li>{t('accessibilityConnectivity2')}</li>
            <li>{t('accessibilityConnectivity3')}</li>
            <li>{t('accessibilityConnectivity4')}</li>
          </ul>

          <h3>{t('accessibilityDataTitle')}</h3>
          <ul>
            <li>{t('accessibilityData1')}</li>
            <li>{t('accessibilityData2')}</li>
            <li>{t('accessibilityData3')}</li>
          </ul>

          <h2>{t('accessibilityLimitationsTitle')}</h2>
          <p>{t('accessibilityLimitationsBody')}</p>
          <ul>
            <li>{t('accessibilityLimitation1')}</li>
            <li>{t('accessibilityLimitation2')}</li>
            <li>{t('accessibilityLimitation3')}</li>
          </ul>

          <h2>{t('accessibilityTestingTitle')}</h2>
          <p>{t('accessibilityTestingBody')}</p>
          <ul>
            <li>{t('accessibilityTesting1')}</li>
            <li>{t('accessibilityTesting2')}</li>
            <li>{t('accessibilityTesting3')}</li>
            <li>{t('accessibilityTesting4')}</li>
            <li>{t('accessibilityTesting5')}</li>
          </ul>

          <h2>{t('accessibilityFeedbackTitle')}</h2>
          <p>{t('accessibilityFeedbackBody')}</p>
          <p>
            <strong>{t('accessibilityFeedbackContact')}</strong><br />
            Email: <a href="mailto:ibar.office@au-ibar.org">ibar.office@au-ibar.org</a><br />
            {t('accessibilityFeedbackAddress')}
          </p>
          <p>{t('accessibilityFeedbackResponse')}</p>

          <h2>{t('accessibilityImprovementTitle')}</h2>
          <p>{t('accessibilityImprovementBody')}</p>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
          <Link href="/" className="text-[#006B3F] hover:underline">&larr; {t('backToAris')}</Link>
        </div>
      </div>
    </>
  );
}
