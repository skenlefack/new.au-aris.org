'use client';

import Link from 'next/link';
import Image from 'next/image';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { useTranslations } from '@/lib/i18n/translations';

export default function TermsOfServicePage() {
  const t = useTranslations('legal');

  return (
    <>
      <LandingHeader />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <Image src="/au-logo.png" alt="AU-IBAR" width={48} height={48} className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('termsTitle')}</h1>
            <p className="text-sm text-gray-500">{t('lastUpdated')}</p>
          </div>
        </div>

        <div className="max-w-none text-gray-700 [&_a]:text-[#006B3F] [&_a]:underline [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-800 [&_li]:ml-5 [&_li]:list-disc [&_li]:marker:text-gray-400 [&_ol_li]:list-decimal [&_p]:mb-4 [&_p]:leading-relaxed [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm [&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_ul]:mb-4 [&_ul]:space-y-1">
          <h2>{t('terms1Title')}</h2>
          <p>{t('terms1Body')}</p>

          <h2>{t('terms2Title')}</h2>
          <p>{t('terms2Intro')}</p>
          <ul>
            <li>{t('terms2Item1')}</li>
            <li>{t('terms2Item2')}</li>
            <li>{t('terms2Item3')}</li>
            <li>{t('terms2Item4')}</li>
            <li>{t('terms2Item5')}</li>
            <li>{t('terms2Item6')}</li>
            <li>{t('terms2Item7')}</li>
          </ul>

          <h2>{t('terms3Title')}</h2>

          <h3>{t('terms31Title')}</h3>
          <p>{t('terms31Body')}</p>

          <h3>{t('terms32Title')}</h3>
          <table>
            <thead>
              <tr>
                <th>{t('terms32ColRole')}</th>
                <th>{t('terms32ColResp')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Super Admin</strong></td>
                <td>{t('terms32SuperAdmin')}</td>
              </tr>
              <tr>
                <td><strong>Continental Admin</strong></td>
                <td>{t('terms32ContinentalAdmin')}</td>
              </tr>
              <tr>
                <td><strong>REC Admin</strong></td>
                <td>{t('terms32RecAdmin')}</td>
              </tr>
              <tr>
                <td><strong>National Admin</strong></td>
                <td>{t('terms32NationalAdmin')}</td>
              </tr>
              <tr>
                <td><strong>Data Steward</strong></td>
                <td>{t('terms32DataSteward')}</td>
              </tr>
              <tr>
                <td><strong>WAHIS Focal Point</strong></td>
                <td>{t('terms32WahisFp')}</td>
              </tr>
              <tr>
                <td><strong>Analyst</strong></td>
                <td>{t('terms32Analyst')}</td>
              </tr>
              <tr>
                <td><strong>Field Agent</strong></td>
                <td>{t('terms32FieldAgent')}</td>
              </tr>
            </tbody>
          </table>

          <h3>{t('terms33Title')}</h3>
          <p>{t('terms33Intro')}</p>
          <ul>
            <li>{t('terms33Item1')}</li>
            <li>{t('terms33Item2')}</li>
            <li>{t('terms33Item3')}</li>
            <li>{t('terms33Item4')}</li>
            <li>{t('terms33Item5')}</li>
          </ul>

          <h2>{t('terms4Title')}</h2>

          <h3>{t('terms41Title')}</h3>
          <p>{t('terms41Intro')}</p>
          <ol>
            <li>{t('terms41Item1')}</li>
            <li>{t('terms41Item2')}</li>
            <li>{t('terms41Item3')}</li>
            <li>{t('terms41Item4')}</li>
            <li>{t('terms41Item5')}</li>
            <li>{t('terms41Item6')}</li>
            <li>{t('terms41Item7')}</li>
          </ol>

          <h3>{t('terms42Title')}</h3>
          <p>{t('terms42Body')}</p>

          <h2>{t('terms5Title')}</h2>
          <p>{t('terms5Intro')}</p>
          <ul>
            <li>{t('terms5Item1')}</li>
            <li>{t('terms5Item2')}</li>
            <li>{t('terms5Item3')}</li>
            <li>{t('terms5Item4')}</li>
            <li>{t('terms5Item5')}</li>
            <li>{t('terms5Item6')}</li>
            <li>{t('terms5Item7')}</li>
            <li>{t('terms5Item8')}</li>
          </ul>

          <h2>{t('terms6Title')}</h2>
          <p>{t('terms6Body')}</p>

          <h2>{t('terms7Title')}</h2>
          <p>{t('terms7Intro')}</p>
          <ul>
            <li>{t('terms7Item1')}</li>
            <li>{t('terms7Item2')}</li>
            <li>{t('terms7Item3')}</li>
            <li>{t('terms7Item4')}</li>
          </ul>
          <p>{t('terms7Body')}</p>

          <h2>{t('terms8Title')}</h2>
          <p>{t('terms8Body')}</p>

          <h2>{t('terms9Title')}</h2>
          <p>{t('terms9Intro')}</p>
          <ul>
            <li>{t('terms9Item1')}</li>
            <li>{t('terms9Item2')}</li>
            <li>{t('terms9Item3')}</li>
            <li>{t('terms9Item4')}</li>
            <li>{t('terms9Item5')}</li>
          </ul>

          <h2>{t('terms10Title')}</h2>
          <p>{t('terms10Body')}</p>

          <h2>{t('terms11Title')}</h2>
          <p>{t('terms11Intro')}</p>
          <ul>
            <li>{t('terms11Item1')}</li>
            <li>{t('terms11Item2')}</li>
            <li>{t('terms11Item3')}</li>
            <li>{t('terms11Item4')}</li>
            <li>{t('terms11Item5')}</li>
            <li>{t('terms11Item6')}</li>
          </ul>

          <h2>{t('terms12Title')}</h2>
          <p>{t('terms12Body')}</p>

          <h2>{t('terms13Title')}</h2>
          <p>{t('terms13Intro')}</p>
          <p>
            <strong>{t('terms13Contact')}</strong><br />
            Email: <a href="mailto:ibar.office@au-ibar.org">ibar.office@au-ibar.org</a><br />
            {t('terms13Address')}
          </p>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
          <Link href="/" className="text-[#006B3F] hover:underline">&larr; {t('backToAris')}</Link>
        </div>
      </div>
    </>
  );
}
