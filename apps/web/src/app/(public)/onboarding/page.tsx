'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { useTranslations } from '@/lib/i18n/translations';
import {
  CheckCircle2, ChevronLeft, ChevronRight, Globe, Users, Building2,
  FileText, Send, Plus, Trash2, AlertCircle, MapPin, Shield,
} from 'lucide-react';

const TENANT_API = process.env['NEXT_PUBLIC_TENANT_API_URL'] ?? '';

const LANGUAGES = ['EN', 'FR', 'PT', 'AR', 'ES', 'SW'];
const ROLES = ['NATIONAL_ADMIN', 'DATA_STEWARD', 'WAHIS_FOCAL_POINT', 'ANALYST', 'FIELD_AGENT'];
const DOMAINS = [
  { code: 'animal-health', labelEn: 'Animal Health & One Health', labelFr: 'Sante Animale & One Health' },
  { code: 'livestock-prod', labelEn: 'Livestock Production & Pastoralism', labelFr: 'Production Animale & Pastoralisme' },
  { code: 'fisheries', labelEn: 'Fisheries & Aquaculture', labelFr: 'Peche & Aquaculture' },
  { code: 'trade-sps', labelEn: 'Trade, Markets & SPS', labelFr: 'Commerce, Marches & SPS' },
  { code: 'governance', labelEn: 'Governance & Capacities', labelFr: 'Gouvernance & Capacites' },
];
const LEVELS = ['National', 'Admin1', 'Admin2', 'Admin3', 'Admin4', 'Admin5'];
const HISTORICAL_FORMATS = ['excel', 'csv', 'database', 'paper'];

interface AdminLevel {
  level: number;
  denomination: string;
  unitCount: string;
  example: string;
}

interface UserEntry {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  title: string;
  institution: string;
  level: string;
  location: string;
  domains: string;
  mfa: boolean;
  supervisorName: string;
  supervisorEmail: string;
  alternateName: string;
  alternateEmail: string;
}

const emptyUser = (): UserEntry => ({
  firstName: '', lastName: '', email: '', phone: '', role: 'FIELD_AGENT',
  title: '', institution: '', level: 'National', location: '', domains: '',
  mfa: false, supervisorName: '', supervisorEmail: '', alternateName: '', alternateEmail: '',
});

const STEPS = ['country', 'admin', 'domains', 'users', 'historical', 'contact'];

export default function OnboardingPage() {
  const t = useTranslations('onboarding');

  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Section 1 — Country
  const [countryName, setCountryName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [officialLanguages, setOfficialLanguages] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('EN');

  // Section 2 — Admin levels
  const [adminLevels, setAdminLevels] = useState<AdminLevel[]>([
    { level: 1, denomination: '', unitCount: '', example: '' },
  ]);

  // Section 3 — Domains
  const [activeDomains, setActiveDomains] = useState<string[]>([]);

  // Section 3 — Users
  const [users, setUsers] = useState<UserEntry[]>([emptyUser()]);

  // Section 8 — Historical data
  const [hasHistoricalData, setHasHistoricalData] = useState(false);
  const [historicalPeriod, setHistoricalPeriod] = useState('');
  const [historicalFormat, setHistoricalFormat] = useState<string[]>([]);
  const [historicalVolume, setHistoricalVolume] = useState('');

  // Section 11 — Contact
  const [contactFullName, setContactFullName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactInstitution, setContactInstitution] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [cvoName, setCvoName] = useState('');
  const [cvoTitle, setCvoTitle] = useState('');
  const [cvoEmail, setCvoEmail] = useState('');

  const addAdminLevel = () => {
    if (adminLevels.length < 5) {
      setAdminLevels([...adminLevels, { level: adminLevels.length + 1, denomination: '', unitCount: '', example: '' }]);
    }
  };

  const removeAdminLevel = (idx: number) => {
    const next = adminLevels.filter((_, i) => i !== idx).map((l, i) => ({ ...l, level: i + 1 }));
    setAdminLevels(next);
  };

  const updateAdminLevel = (idx: number, field: keyof AdminLevel, value: string) => {
    const next = [...adminLevels];
    next[idx] = { ...next[idx], [field]: value };
    setAdminLevels(next);
  };

  const addUser = () => setUsers([...users, emptyUser()]);

  const removeUser = (idx: number) => {
    if (users.length > 1) setUsers(users.filter((_, i) => i !== idx));
  };

  const updateUser = (idx: number, field: keyof UserEntry, value: string | boolean) => {
    const next = [...users];
    next[idx] = { ...next[idx], [field]: value };
    setUsers(next);
  };

  const toggleDomain = (code: string) => {
    setActiveDomains((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const body = {
        countryName,
        countryCode: countryCode || undefined,
        officialLanguages: officialLanguages.split(',').map((s) => s.trim()).filter(Boolean),
        preferredLanguage,
        adminLevels,
        activeDomains,
        users,
        hasHistoricalData,
        historicalPeriod: historicalPeriod || undefined,
        historicalFormat,
        historicalVolume: historicalVolume || undefined,
        contactFullName,
        contactTitle,
        contactInstitution,
        contactEmail,
        contactPhone,
        cvoName: cvoName || undefined,
        cvoTitle: cvoTitle || undefined,
        cvoEmail: cvoEmail || undefined,
      };

      const res = await fetch(`${TENANT_API}/api/v1/public/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Error ${res.status}`);
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const canGoNext = (): boolean => {
    switch (STEPS[step]) {
      case 'country': return !!countryName && !!preferredLanguage;
      case 'admin': return adminLevels.length > 0 && !!adminLevels[0].denomination;
      case 'domains': return activeDomains.length > 0;
      case 'users': return users.length > 0 && !!users[0].email && !!users[0].firstName;
      case 'historical': return true;
      case 'contact': return !!contactFullName && !!contactEmail && !!contactPhone;
      default: return true;
    }
  };

  if (submitted) {
    return (
      <>
        <LandingHeader />
        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="mb-3 text-3xl font-bold text-gray-900">{t('submissionSuccess')}</h1>
          <p className="mb-8 max-w-md text-gray-600">{t('submissionSuccessDesc')}</p>
          <Link href="/" className="rounded-lg bg-[#006B3F] px-6 py-3 font-medium text-white transition-colors hover:bg-[#005530]">
            {t('backToHome')}
          </Link>
        </div>
      </>
    );
  }

  const stepIcons = [
    <Globe key="g" className="h-5 w-5" />,
    <MapPin key="m" className="h-5 w-5" />,
    <Shield key="s" className="h-5 w-5" />,
    <Users key="u" className="h-5 w-5" />,
    <FileText key="f" className="h-5 w-5" />,
    <Send key="se" className="h-5 w-5" />,
  ];

  const stepLabels = [
    t('stepCountry'), t('stepAdmin'), t('stepDomains'),
    t('stepUsers'), t('stepHistorical'), t('stepContact'),
  ];

  return (
    <>
      <LandingHeader />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center gap-3">
            <Image src="/au-logo.png" alt="AU-IBAR" width={48} height={48} className="h-12 w-12 object-contain" />
            <div className="text-left">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t('title')}</h1>
              <p className="text-sm text-gray-500">{t('subtitle')}</p>
            </div>
          </div>
          <p className="mx-auto max-w-2xl text-sm text-gray-600">{t('description')}</p>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-center gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => i <= step && setStep(i)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                i === step
                  ? 'bg-[#006B3F] text-white'
                  : i < step
                    ? 'cursor-pointer bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {stepIcons[i]}
              <span className="hidden sm:inline">{stepLabels[i]}</span>
              <span className="sm:hidden">{i + 1}</span>
            </button>
          ))}
        </div>

        {/* Form content */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          {/* Step: Country identification */}
          {STEPS[step] === 'country' && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <Globe className="h-5 w-5 text-[#006B3F]" />
                  {t('section1Title')}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{t('section1Desc')}</p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    {t('countryName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={countryName}
                    onChange={(e) => setCountryName(e.target.value)}
                    placeholder={t('countryNamePlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#006B3F] focus:outline-none focus:ring-1 focus:ring-[#006B3F]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    {t('countryCodeLabel')}
                  </label>
                  <input
                    type="text"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                    maxLength={3}
                    placeholder="KE"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm uppercase focus:border-[#006B3F] focus:outline-none focus:ring-1 focus:ring-[#006B3F]"
                  />
                  <p className="mt-1 text-xs text-gray-400">ISO 3166-1 alpha-2</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    {t('officialLanguages')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={officialLanguages}
                    onChange={(e) => setOfficialLanguages(e.target.value)}
                    placeholder={t('officialLanguagesPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#006B3F] focus:outline-none focus:ring-1 focus:ring-[#006B3F]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    {t('preferredLanguage')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#006B3F] focus:outline-none focus:ring-1 focus:ring-[#006B3F]"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step: Administrative structure */}
          {STEPS[step] === 'admin' && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <MapPin className="h-5 w-5 text-[#006B3F]" />
                  {t('section2Title')}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{t('section2Desc')}</p>
              </div>

              <div className="space-y-3">
                {adminLevels.map((lvl, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <span className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#006B3F] text-xs font-bold text-white">
                      {lvl.level}
                    </span>
                    <div className="grid flex-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{t('denomination')} *</label>
                        <input
                          type="text"
                          value={lvl.denomination}
                          onChange={(e) => updateAdminLevel(idx, 'denomination', e.target.value)}
                          placeholder={t('denominationPlaceholder')}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{t('unitCount')}</label>
                        <input
                          type="text"
                          value={lvl.unitCount}
                          onChange={(e) => updateAdminLevel(idx, 'unitCount', e.target.value)}
                          placeholder="14"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{t('example')}</label>
                        <input
                          type="text"
                          value={lvl.example}
                          onChange={(e) => updateAdminLevel(idx, 'example', e.target.value)}
                          placeholder={t('examplePlaceholder')}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none"
                        />
                      </div>
                    </div>
                    {adminLevels.length > 1 && (
                      <button onClick={() => removeAdminLevel(idx)} className="mt-2 text-red-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {adminLevels.length < 5 && (
                <button
                  onClick={addAdminLevel}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-[#006B3F] hover:text-[#006B3F]"
                >
                  <Plus className="h-4 w-4" />
                  {t('addLevel')}
                </button>
              )}
            </div>
          )}

          {/* Step: Domains */}
          {STEPS[step] === 'domains' && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <Shield className="h-5 w-5 text-[#006B3F]" />
                  {t('section3Title')}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{t('section3Desc')}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {DOMAINS.map((d) => (
                  <button
                    key={d.code}
                    onClick={() => toggleDomain(d.code)}
                    className={`flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                      activeDomains.includes(d.code)
                        ? 'border-[#006B3F] bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                      activeDomains.includes(d.code)
                        ? 'border-[#006B3F] bg-[#006B3F]'
                        : 'border-gray-300'
                    }`}>
                      {activeDomains.includes(d.code) && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{d.labelEn}</p>
                      <p className="text-xs text-gray-500">{d.labelFr}</p>
                      <p className="mt-0.5 font-mono text-xs text-gray-400">{d.code}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Users */}
          {STEPS[step] === 'users' && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <Users className="h-5 w-5 text-[#006B3F]" />
                  {t('section4Title')}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{t('section4Desc')}</p>
              </div>

              {/* Role legend */}
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="mb-2 text-xs font-semibold text-blue-800">{t('availableRoles')}</p>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <span key={r} className="rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">{r}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {users.map((u, idx) => (
                  <div key={idx} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#006B3F] text-xs text-white">
                          {idx + 1}
                        </span>
                        {u.firstName || u.lastName ? `${u.firstName} ${u.lastName}` : t('userN', { n: String(idx + 1) })}
                      </span>
                      {users.length > 1 && (
                        <button onClick={() => removeUser(idx)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{t('firstName')} *</label>
                        <input type="text" value={u.firstName} onChange={(e) => updateUser(idx, 'firstName', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{t('lastName')} *</label>
                        <input type="text" value={u.lastName} onChange={(e) => updateUser(idx, 'lastName', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{t('emailField')} *</label>
                        <input type="email" value={u.email} onChange={(e) => updateUser(idx, 'email', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{t('phoneWhatsApp')}</label>
                        <input type="text" value={u.phone} onChange={(e) => updateUser(idx, 'phone', e.target.value)}
                          placeholder="+254 700 000 000"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{t('roleAris')} *</label>
                        <select value={u.role} onChange={(e) => updateUser(idx, 'role', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none">
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{t('titleFunction')}</label>
                        <input type="text" value={u.title} onChange={(e) => updateUser(idx, 'title', e.target.value)}
                          placeholder={t('titlePlaceholder')}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{t('institutionMinistry')}</label>
                        <input type="text" value={u.institution} onChange={(e) => updateUser(idx, 'institution', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{t('adminLevel')}</label>
                        <select value={u.level} onChange={(e) => updateUser(idx, 'level', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none">
                          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{t('adminLocation')}</label>
                        <input type="text" value={u.location} onChange={(e) => updateUser(idx, 'location', e.target.value)}
                          placeholder={t('locationPlaceholder')}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{t('domainCodes')} *</label>
                        <input type="text" value={u.domains} onChange={(e) => updateUser(idx, 'domains', e.target.value)}
                          placeholder="animal-health, livestock-prod"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                      </div>
                      <div className="flex items-end gap-2 pb-1">
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-600">
                          <input type="checkbox" checked={u.mfa} onChange={(e) => updateUser(idx, 'mfa', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-[#006B3F] focus:ring-[#006B3F]" />
                          MFA (TOTP)
                        </label>
                      </div>
                    </div>

                    {/* Supervisor info */}
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <p className="mb-2 text-xs font-semibold text-gray-500">{t('validationChain')}</p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">{t('supervisorName')}</label>
                          <input type="text" value={u.supervisorName} onChange={(e) => updateUser(idx, 'supervisorName', e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">{t('supervisorEmail')}</label>
                          <input type="email" value={u.supervisorEmail} onChange={(e) => updateUser(idx, 'supervisorEmail', e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">{t('alternateName')}</label>
                          <input type="text" value={u.alternateName} onChange={(e) => updateUser(idx, 'alternateName', e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">{t('alternateEmail')}</label>
                          <input type="email" value={u.alternateEmail} onChange={(e) => updateUser(idx, 'alternateEmail', e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addUser}
                className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-[#006B3F] hover:text-[#006B3F]"
              >
                <Plus className="h-4 w-4" />
                {t('addUser')}
              </button>
            </div>
          )}

          {/* Step: Historical data */}
          {STEPS[step] === 'historical' && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <FileText className="h-5 w-5 text-[#006B3F]" />
                  {t('section5Title')}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{t('section5Desc')}</p>
              </div>

              <div className="space-y-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={hasHistoricalData}
                    onChange={(e) => setHasHistoricalData(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-[#006B3F] focus:ring-[#006B3F]"
                  />
                  <span className="text-sm font-medium text-gray-700">{t('hasHistoricalData')}</span>
                </label>

                {hasHistoricalData && (
                  <div className="ml-8 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">{t('periodCovered')}</label>
                      <input
                        type="text"
                        value={historicalPeriod}
                        onChange={(e) => setHistoricalPeriod(e.target.value)}
                        placeholder="2010-2025"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">{t('estimatedVolume')}</label>
                      <input
                        type="text"
                        value={historicalVolume}
                        onChange={(e) => setHistoricalVolume(e.target.value)}
                        placeholder={t('volumePlaceholder')}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-xs font-medium text-gray-600">{t('dataFormat')}</label>
                      <div className="flex flex-wrap gap-3">
                        {HISTORICAL_FORMATS.map((f) => (
                          <label key={f} className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={historicalFormat.includes(f)}
                              onChange={() => setHistoricalFormat((prev) =>
                                prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
                              )}
                              className="h-4 w-4 rounded border-gray-300 text-[#006B3F] focus:ring-[#006B3F]"
                            />
                            <span className="text-sm text-gray-700 capitalize">{f === 'database' ? t('databaseFormat') : f.charAt(0).toUpperCase() + f.slice(1)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step: Contact & validation */}
          {STEPS[step] === 'contact' && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <Send className="h-5 w-5 text-[#006B3F]" />
                  {t('section6Title')}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{t('section6Desc')}</p>
              </div>

              {/* Request contact */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Building2 className="h-4 w-4 text-[#006B3F]" />
                  {t('requestContact')}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{t('fullName')} *</label>
                    <input type="text" value={contactFullName} onChange={(e) => setContactFullName(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{t('titleFunction')} *</label>
                    <input type="text" value={contactTitle} onChange={(e) => setContactTitle(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{t('institutionMinistry')} *</label>
                    <input type="text" value={contactInstitution} onChange={(e) => setContactInstitution(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{t('emailField')} *</label>
                    <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{t('phoneField')} *</label>
                    <input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* CVO approval */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <Shield className="h-4 w-4" />
                  {t('cvoApproval')}
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-amber-700">{t('cvoDirectorName')}</label>
                    <input type="text" value={cvoName} onChange={(e) => setCvoName(e.target.value)}
                      className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-amber-700">{t('titleFunction')}</label>
                    <input type="text" value={cvoTitle} onChange={(e) => setCvoTitle(e.target.value)}
                      className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-amber-700">{t('emailField')}</label>
                    <input type="email" value={cvoEmail} onChange={(e) => setCvoEmail(e.target.value)}
                      className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm focus:border-[#006B3F] focus:outline-none" />
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('previous')}
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                disabled={!canGoNext()}
                className="flex items-center gap-2 rounded-lg bg-[#006B3F] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#005530] disabled:opacity-40"
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !canGoNext()}
                className="flex items-center gap-2 rounded-lg bg-[#006B3F] px-8 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#005530] disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    {t('submitting')}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {t('submit')}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Info box */}
        <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {t('processingTime')}
          </p>
        </div>
      </div>
    </>
  );
}
