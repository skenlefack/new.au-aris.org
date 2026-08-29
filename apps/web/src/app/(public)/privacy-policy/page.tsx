'use client';

import Link from 'next/link';
import Image from 'next/image';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { useTranslations } from '@/lib/i18n/translations';

export default function PrivacyPolicyPage() {
  const t = useTranslations('legal');

  return (
    <>
      <LandingHeader />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <Image src="/au-logo.png" alt="AU-IBAR" width={48} height={48} className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('privacyTitle')}</h1>
            <p className="text-sm text-gray-500">{t('lastUpdated')}</p>
          </div>
        </div>

        <div className="max-w-none text-gray-700 [&_a]:text-[#006B3F] [&_a]:underline [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-800 [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-4 [&_p]:leading-relaxed [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm [&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_ul]:mb-4 [&_ul]:space-y-1">
          <h2>{t('privacy1Title')}</h2>
          <p>{t('privacy1Body')}</p>

          <h2>{t('privacy2Title')}</h2>
          <p>
            <strong>AU-IBAR</strong><br />
            {t('privacy2Address')}<br />
            Email: <a href="mailto:ibar.office@au-ibar.org">ibar.office@au-ibar.org</a><br />
            Website: <a href="https://www.au-ibar.org" target="_blank" rel="noopener noreferrer">www.au-ibar.org</a>
          </p>

          <h2>{t('privacy3Title')}</h2>

          <h3>{t('privacy31Title')}</h3>
          <p>{t('privacy31Intro')}</p>
          <ul>
            <li>{t('privacy31Item1')}</li>
            <li>{t('privacy31Item2')}</li>
            <li>{t('privacy31Item3')}</li>
            <li>{t('privacy31Item4')}</li>
          </ul>

          <h3>{t('privacy32Title')}</h3>
          <p>{t('privacy32Body')}</p>

          <h3>{t('privacy33Title')}</h3>
          <p>{t('privacy33Intro')}</p>
          <ul>
            <li>{t('privacy33Item1')}</li>
            <li>{t('privacy33Item2')}</li>
            <li>{t('privacy33Item3')}</li>
          </ul>
          <p>{t('privacy33Body')}</p>

          <h3>{t('privacy34Title')}</h3>
          <p>{t('privacy34Intro')}</p>
          <ul>
            <li>{t('privacy34Item1')}</li>
            <li>{t('privacy34Item2')}</li>
            <li>{t('privacy34Item3')}</li>
            <li>{t('privacy34Item4')}</li>
          </ul>

          <h3>{t('privacy35Title')}</h3>
          <p>{t('privacy35Body')}</p>

          <h2>{t('privacy4Title')}</h2>
          <p>{t('privacy4Intro')}</p>
          <ul>
            <li>{t('privacy4Item1')}</li>
            <li>{t('privacy4Item2')}</li>
            <li>{t('privacy4Item3')}</li>
            <li>{t('privacy4Item4')}</li>
            <li>{t('privacy4Item5')}</li>
            <li>{t('privacy4Item6')}</li>
            <li>{t('privacy4Item7')}</li>
            <li>{t('privacy4Item8')}</li>
          </ul>

          <h2>{t('privacy5Title')}</h2>
          <p>{t('privacy5Intro')}</p>
          <table>
            <thead>
              <tr>
                <th>{t('privacy5ColClass')}</th>
                <th>{t('privacy5ColDesc')}</th>
                <th>{t('privacy5ColAccess')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>PUBLIC</strong></td>
                <td>{t('privacy5Public')}</td>
                <td>{t('privacy5PublicAccess')}</td>
              </tr>
              <tr>
                <td><strong>PARTNER</strong></td>
                <td>{t('privacy5Partner')}</td>
                <td>{t('privacy5PartnerAccess')}</td>
              </tr>
              <tr>
                <td><strong>RESTRICTED</strong></td>
                <td>{t('privacy5Restricted')}</td>
                <td>{t('privacy5RestrictedAccess')}</td>
              </tr>
              <tr>
                <td><strong>CONFIDENTIAL</strong></td>
                <td>{t('privacy5Confidential')}</td>
                <td>{t('privacy5ConfidentialAccess')}</td>
              </tr>
            </tbody>
          </table>
          <p>{t('privacy5Body')}</p>

          <h2>{t('privacy6Title')}</h2>
          <p>{t('privacy6Body')}</p>

          <h2>{t('privacy7Title')}</h2>
          <p>{t('privacy7Intro')}</p>
          <ul>
            <li>{t('privacy7Item1')}</li>
            <li>{t('privacy7Item2')}</li>
            <li>{t('privacy7Item3')}</li>
            <li>{t('privacy7Item4')}</li>
            <li>{t('privacy7Item5')}</li>
            <li>{t('privacy7Item6')}</li>
            <li>{t('privacy7Item7')}</li>
            <li>{t('privacy7Item8')}</li>
            <li>{t('privacy7Item9')}</li>
          </ul>

          <h2>{t('privacy8Title')}</h2>
          <p>{t('privacy8Body')}</p>

          <h2>{t('privacy9Title')}</h2>
          <p>{t('privacy9Intro')}</p>
          <ul>
            <li>{t('privacy9Item1')}</li>
            <li>{t('privacy9Item2')}</li>
            <li>{t('privacy9Item3')}</li>
            <li>{t('privacy9Item4')}</li>
            <li>{t('privacy9Item5')}</li>
          </ul>

          <h2>{t('privacy10Title')}</h2>
          <p>{t('privacy10Body')}</p>

          <h2>{t('privacy11Title')}</h2>
          <p>{t('privacy11Body')}</p>

          <h2>{t('privacy12Title')}</h2>
          <p>{t('privacy12Body')}</p>

          <h2>{t('privacy13Title')}</h2>
          <p>{t('privacy13Body')}</p>

          <h2>{t('privacy14Title')}</h2>
          <p>{t('privacy14Intro')}</p>
          <p>
            <strong>{t('privacy14Contact')}</strong><br />
            Email: <a href="mailto:ibar.office@au-ibar.org">ibar.office@au-ibar.org</a><br />
            {t('privacy14Address')}
          </p>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
          <Link href="/" className="text-[#006B3F] hover:underline">&larr; {t('backToAris')}</Link>
        </div>
      </div>
    </>
  );
}
