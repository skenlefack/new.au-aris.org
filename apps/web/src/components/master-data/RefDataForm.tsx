'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Save, Loader2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';
import {
  useRefDataItem,
  useCreateRefData,
  useUpdateRefData,
  useRefDataForSelect,
  type RefDataType,
  type MultilingualValue,
} from '@/lib/api/ref-data-hooks';
import { getTypeConfig } from './ref-data-config';
import { MultilingualInput } from '@/components/settings/MultilingualInput';
import { MultilingualTextarea } from './MultilingualTextarea';
import { CascadeSelect } from './CascadeSelect';
import { useAuthStore } from '@/lib/stores/auth-store';

interface RefDataFormProps {
  type: RefDataType;
  mode: 'create' | 'edit';
  itemId?: string;
}

const emptyMl = (): MultilingualValue => ({ en: '', fr: '', pt: '', ar: '', es: '', sw: '' });

export function RefDataForm({ type, mode, itemId }: RefDataFormProps) {
  const router = useRouter();
  const config = getTypeConfig(type);
  const user = useAuthStore((s) => s.user);
  const t = useTranslations('masterData.form');

  const { data: itemData, isLoading: loadingItem } = useRefDataItem(type, mode === 'edit' ? itemId : undefined);
  const createMutation = useCreateRefData(type);
  const updateMutation = useUpdateRefData(type);

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState<MultilingualValue>(emptyMl());
  const [description, setDescription] = useState<MultilingualValue>(emptyMl());
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);

  // Type-specific fields
  const [icon, setIcon] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [speciesId, setSpeciesId] = useState<string | null>(null);
  const [diseaseId, setDiseaseId] = useState<string | null>(null);
  const [minMonths, setMinMonths] = useState<string>('');
  const [maxMonths, setMaxMonths] = useState<string>('');
  const [oieCode, setOieCode] = useState('');
  const [isNotifiable, setIsNotifiable] = useState(false);
  const [isZoonotic, setIsZoonotic] = useState(false);
  const [selectedSpeciesIds, setSelectedSpeciesIds] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [fieldType, setFieldType] = useState('');
  const [storageTemp, setStorageTemp] = useState('');
  const [capacity, setCapacity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [address, setAddress] = useState('');
  const [adminLevel1, setAdminLevel1] = useState('');
  const [adminLevel2, setAdminLevel2] = useState('');
  const [adminLevel3, setAdminLevel3] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [frequency, setFrequency] = useState('');
  const [marketDay, setMarketDay] = useState('');
  const [borderWith, setBorderWith] = useState('');
  const [operatingHours, setOperatingHours] = useState('');
  // Phase 2 fields
  const [origin, setOrigin] = useState('');
  const [purpose, setPurpose] = useState('');
  const [vaccineClass, setVaccineClass] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [routeOfAdmin, setRouteOfAdmin] = useState('');
  const [dosesRequired, setDosesRequired] = useState('');
  const [testCategory, setTestCategory] = useState('');
  const [turnaroundDays, setTurnaroundDays] = useState('');
  const [labLevel, setLabLevel] = useState('');
  const [bslLevel, setBslLevel] = useState('');
  const [accreditation, setAccreditation] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [methodType, setMethodType] = useState('');
  const [gearCategory, setGearCategory] = useState('');
  const [lengthCategory, setLengthCategory] = useState('');
  const [propulsionType, setPropulsionType] = useState('');
  const [waterType, setWaterType] = useState('');
  const [cultureSystem, setCultureSystem] = useState('');
  const [iucnCode, setIucnCode] = useState('');
  const [biome, setBiome] = useState('');
  const [crimeCategory, setCrimeCategory] = useState('');
  const [hsCode, setHsCode] = useState('');
  const [commodityGroup, setCommodityGroup] = useState('');
  const [hiveCategory, setHiveCategory] = useState('');
  const [pathogenType, setPathogenType] = useState('');
  const [affectedCaste, setAffectedCaste] = useState('');
  const [floweringSeason, setFloweringSeason] = useState('');
  const [nectarType, setNectarType] = useState('');
  const [frameworkCategory, setFrameworkCategory] = useState('');
  const [sector, setSector] = useState('');

  // Populate form on edit
  useEffect(() => {
    if (mode === 'edit' && itemData?.data) {
      const d = itemData.data;
      setCode(d.code ?? '');
      setName(d.name ?? emptyMl());
      setDescription(d.description ?? emptyMl());
      setIsActive(d.isActive ?? true);
      setSortOrder(d.sortOrder ?? 0);
      setIcon(d.icon ?? '');
      setScientificName(d.scientificName ?? '');
      setGroupId(d.groupId ?? null);
      setSpeciesId(d.speciesId ?? null);
      setDiseaseId(d.diseaseId ?? null);
      setMinMonths(d.minMonths != null ? String(d.minMonths) : '');
      setMaxMonths(d.maxMonths != null ? String(d.maxMonths) : '');
      setOieCode(d.oieCode ?? '');
      setIsNotifiable(d.isNotifiable ?? false);
      setIsZoonotic(d.isZoonotic ?? false);
      // Load disease-species associations
      if (d.diseaseSpecies && Array.isArray(d.diseaseSpecies)) {
        setSelectedSpeciesIds(d.diseaseSpecies.map((ds: any) => ds.speciesId || ds.species?.id).filter(Boolean));
      }
      setCategory(d.category ?? '');
      setSeverity(d.severity ?? '');
      setFieldType(d.type ?? '');
      setStorageTemp(d.storageTemp ?? '');
      setCapacity(d.capacity != null ? String(d.capacity) : '');
      setLatitude(d.latitude != null ? String(d.latitude) : '');
      setLongitude(d.longitude != null ? String(d.longitude) : '');
      setAddress(d.address ?? '');
      setAdminLevel1(d.adminLevel1 ?? '');
      setAdminLevel2(d.adminLevel2 ?? '');
      setAdminLevel3(d.adminLevel3 ?? '');
      setContactName(d.contactName ?? '');
      setContactPhone(d.contactPhone ?? '');
      setLicenseNumber(d.licenseNumber ?? '');
      setLicenseExpiry(d.licenseExpiry ? d.licenseExpiry.split('T')[0] : '');
      setFrequency(d.frequency ?? '');
      setMarketDay(d.marketDay ?? '');
      setBorderWith(d.borderWith ?? '');
      setOperatingHours(d.operatingHours ?? '');
      // Phase 2
      setOrigin((d as any).origin ?? '');
      setPurpose((d as any).purpose ?? '');
      setVaccineClass((d as any).vaccineClass ?? '');
      setManufacturer((d as any).manufacturer ?? '');
      setRouteOfAdmin((d as any).routeOfAdmin ?? '');
      setDosesRequired((d as any).dosesRequired != null ? String((d as any).dosesRequired) : '');
      setTestCategory((d as any).testCategory ?? '');
      setTurnaroundDays((d as any).turnaroundDays != null ? String((d as any).turnaroundDays) : '');
      setLabLevel((d as any).labLevel ?? '');
      setBslLevel((d as any).bslLevel != null ? String((d as any).bslLevel) : '');
      setAccreditation((d as any).accreditation ?? '');
      setProductCategory((d as any).productCategory ?? '');
      setMethodType((d as any).methodType ?? '');
      setGearCategory((d as any).gearCategory ?? '');
      setLengthCategory((d as any).lengthCategory ?? '');
      setPropulsionType((d as any).propulsionType ?? '');
      setWaterType((d as any).waterType ?? '');
      setCultureSystem((d as any).cultureSystem ?? '');
      setIucnCode((d as any).iucnCode ?? '');
      setBiome((d as any).biome ?? '');
      setCrimeCategory((d as any).crimeCategory ?? '');
      setHsCode((d as any).hsCode ?? '');
      setCommodityGroup((d as any).commodityGroup ?? '');
      setHiveCategory((d as any).hiveCategory ?? '');
      setPathogenType((d as any).pathogenType ?? '');
      setAffectedCaste((d as any).affectedCaste ?? '');
      setFloweringSeason((d as any).floweringSeason ?? '');
      setNectarType((d as any).nectarType ?? '');
      setFrameworkCategory((d as any).frameworkCategory ?? '');
      setSector((d as any).sector ?? '');
    }
  }, [mode, itemData]);

  if (!config) {
    return <div className="py-20 text-center text-gray-500">{t('unknownType', { type })}</div>;
  }

  const Icon = config.icon;
  const isPending = createMutation.isPending || updateMutation.isPending;

  function buildPayload(): Record<string, any> {
    const payload: Record<string, any> = {
      code,
      name,
      description: Object.values(description).some((v) => v?.trim()) ? description : undefined,
      isActive,
      sortOrder,
    };

    // Type-specific fields
    if (type === 'species-groups') {
      if (icon) payload.icon = icon;
    }
    if (type === 'species') {
      if (scientificName) payload.scientificName = scientificName;
      if (groupId) payload.groupId = groupId;
    }
    if (type === 'age-groups') {
      if (speciesId) payload.speciesId = speciesId;
      if (minMonths !== '') payload.minMonths = parseInt(minMonths, 10);
      if (maxMonths !== '') payload.maxMonths = parseInt(maxMonths, 10);
    }
    if (type === 'diseases') {
      if (oieCode) payload.oieCode = oieCode;
      payload.isNotifiable = isNotifiable;
      payload.isZoonotic = isZoonotic;
      if (category) payload.category = category;
      payload.speciesIds = selectedSpeciesIds;
    }
    if (type === 'clinical-signs') {
      if (diseaseId) payload.diseaseId = diseaseId;
      if (severity) payload.severity = severity;
    }
    if (type === 'control-measures') {
      if (diseaseId) payload.diseaseId = diseaseId;
      if (fieldType) payload.type = fieldType;
    }
    if (type === 'seizure-reasons') {
      if (category) payload.category = category;
    }
    if (type === 'sample-types') {
      if (category) payload.category = category;
      if (storageTemp) payload.storageTemp = storageTemp;
    }
    if (type === 'contamination-sources') {
      if (category) payload.category = category;
    }
    if (['abattoirs', 'markets', 'checkpoints'].includes(type)) {
      if (fieldType) payload.type = fieldType;
      if (latitude) payload.latitude = parseFloat(latitude);
      if (longitude) payload.longitude = parseFloat(longitude);
      if (address) payload.address = address;
      if (adminLevel1) payload.adminLevel1 = adminLevel1;
      if (adminLevel2) payload.adminLevel2 = adminLevel2;
      if (adminLevel3) payload.adminLevel3 = adminLevel3;
      if (contactName) payload.contactName = contactName;
      if (contactPhone) payload.contactPhone = contactPhone;
    }
    if (type === 'abattoirs') {
      if (capacity) payload.capacity = parseInt(capacity, 10);
      if (licenseNumber) payload.licenseNumber = licenseNumber;
      if (licenseExpiry) payload.licenseExpiry = licenseExpiry;
    }
    if (type === 'markets') {
      if (capacity) payload.capacity = parseInt(capacity, 10);
      if (frequency) payload.frequency = frequency;
      if (marketDay) payload.marketDay = marketDay;
    }
    if (type === 'checkpoints') {
      if (borderWith) payload.borderWith = borderWith;
      if (operatingHours) payload.operatingHours = operatingHours;
    }
    // Phase 2 types
    if (type === 'breeds') {
      if (speciesId) payload.speciesId = speciesId;
      if (origin) payload.origin = origin;
      if (purpose) payload.purpose = purpose;
    }
    if (type === 'vaccine-types') {
      if (diseaseId) payload.diseaseId = diseaseId;
      if (vaccineClass) payload.vaccineClass = vaccineClass;
      if (manufacturer) payload.manufacturer = manufacturer;
      if (routeOfAdmin) payload.routeOfAdmin = routeOfAdmin;
      if (dosesRequired) payload.dosesRequired = parseInt(dosesRequired, 10);
    }
    if (type === 'test-types') {
      if (testCategory) payload.testCategory = testCategory;
      if (turnaroundDays) payload.turnaroundDays = parseInt(turnaroundDays, 10);
    }
    if (type === 'labs') {
      if (labLevel) payload.labLevel = labLevel;
      if (bslLevel) payload.bslLevel = parseInt(bslLevel, 10);
      if (accreditation) payload.accreditation = accreditation;
      if (latitude) payload.latitude = parseFloat(latitude);
      if (longitude) payload.longitude = parseFloat(longitude);
      if (address) payload.address = address;
      if (contactName) payload.contactName = contactName;
      if (contactPhone) payload.contactPhone = contactPhone;
    }
    if (type === 'livestock-products') {
      if (productCategory) payload.productCategory = productCategory;
    }
    if (type === 'census-methodologies') {
      if (methodType) payload.methodType = methodType;
    }
    if (type === 'gear-types') {
      if (gearCategory) payload.gearCategory = gearCategory;
    }
    if (type === 'vessel-types') {
      if (lengthCategory) payload.lengthCategory = lengthCategory;
      if (propulsionType) payload.propulsionType = propulsionType;
    }
    if (type === 'aquaculture-farm-types') {
      if (waterType) payload.waterType = waterType;
      if (cultureSystem) payload.cultureSystem = cultureSystem;
    }
    if (type === 'landing-sites') {
      if (latitude) payload.latitude = parseFloat(latitude);
      if (longitude) payload.longitude = parseFloat(longitude);
      if (address) payload.address = address;
      if (adminLevel1) payload.adminLevel1 = adminLevel1;
      if (capacity) payload.capacity = parseInt(capacity, 10);
    }
    if (type === 'conservation-statuses') {
      if (iucnCode) payload.iucnCode = iucnCode;
    }
    if (type === 'habitat-types') {
      if (biome) payload.biome = biome;
    }
    if (type === 'crime-types') {
      if (crimeCategory) payload.crimeCategory = crimeCategory;
    }
    if (type === 'commodities') {
      if (hsCode) payload.hsCode = hsCode;
      if (commodityGroup) payload.commodityGroup = commodityGroup;
    }
    if (type === 'hive-types') {
      if (hiveCategory) payload.hiveCategory = hiveCategory;
    }
    if (type === 'bee-diseases') {
      if (pathogenType) payload.pathogenType = pathogenType;
      if (affectedCaste) payload.affectedCaste = affectedCaste;
    }
    if (type === 'floral-sources') {
      if (floweringSeason) payload.floweringSeason = floweringSeason;
      if (nectarType) payload.nectarType = nectarType;
    }
    if (type === 'legal-framework-types') {
      if (frameworkCategory) payload.frameworkCategory = frameworkCategory;
    }
    if (type === 'stakeholder-types') {
      if (sector) payload.sector = sector;
    }

    return payload;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildPayload();

    if (mode === 'create') {
      createMutation.mutate(payload, {
        onSuccess: () => router.push(`/master-data/${type}`),
      });
    } else if (itemId) {
      updateMutation.mutate({ id: itemId, body: payload }, {
        onSuccess: () => router.push(`/master-data/${type}`),
      });
    }
  }

  if (mode === 'edit' && loadingItem) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/master-data/${type}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', config.bgColor)}>
          <Icon className={cn('h-5 w-5', config.color)} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {mode === 'create' ? t('newRecord') : t('editRecord')} {config.label.replace(/s$/, '')}
          </h1>
          <p className="text-xs text-gray-500">{config.labelFr}</p>
        </div>
      </div>

      {/* Error */}
      {(createMutation.error || updateMutation.error) && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {(createMutation.error as any)?.message ?? (updateMutation.error as any)?.message ?? 'An error occurred'}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{t('commonFields')}</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left column */}
            <div className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('code')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                  placeholder="e.g., CATTLE, FMD"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono uppercase focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* Name (multilingual) */}
              <MultilingualInput
                label={t('name')}
                value={name as Record<string, string>}
                onChange={(v) => setName(v)}
                required
              />

              {/* Sort order + Active */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('sortOrder')}</label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-aris-primary-600 focus:ring-aris-primary-500"
                    />
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t('active')}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Description (multilingual) */}
              <MultilingualTextarea
                label={t('description')}
                value={description as Record<string, string>}
                onChange={(v) => setDescription(v)}
              />
            </div>
          </div>
        </div>

        {/* Type-specific fields */}
        {renderTypeSpecificFields()}

        {/* Submit — sticky bottom bar */}
        <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 rounded-xl border border-gray-200 bg-white/90 px-6 py-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/90">
          <Link
            href={`/master-data/${type}`}
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t('cancel')}
          </Link>
          <button
            type="submit"
            disabled={isPending || !code || !name.en}
            className="inline-flex items-center gap-2 rounded-lg bg-aris-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-aris-primary-700 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {mode === 'create' ? t('create') : t('saveChanges')}
          </button>
        </div>
      </form>
    </div>
  );

  function renderTypeSpecificFields() {
    const fields: React.ReactNode[] = [];

    // Species Groups
    if (type === 'species-groups') {
      fields.push(
        <Field key="icon" label={t('icon')} hint={t('iconHint')}>
          <input type="text" value={icon} onChange={(e) => setIcon(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
        </Field>
      );
    }

    // Species
    if (type === 'species') {
      fields.push(
        <div key="species-fields" className="space-y-4">
          <CascadeSelect
            label={t('speciesGroup')}
            type="species-groups"
            value={groupId}
            onChange={(v) => setGroupId(v as string)}
            required
          />
          <Field label={t('scientificName')}>
            <input type="text" value={scientificName} onChange={(e) => setScientificName(e.target.value)}
              placeholder="e.g., Bos taurus"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm italic dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
          </Field>
        </div>
      );
    }

    // Age Groups
    if (type === 'age-groups') {
      fields.push(
        <div key="age-fields" className="space-y-4">
          <CascadeSelect
            label={t('species')}
            type="species"
            value={speciesId}
            onChange={(v) => setSpeciesId(v as string)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('minMonths')}>
              <input type="number" value={minMonths} onChange={(e) => setMinMonths(e.target.value)} min="0"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
            <Field label={t('maxMonths')}>
              <input type="number" value={maxMonths} onChange={(e) => setMaxMonths(e.target.value)} min="0"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
          </div>
        </div>
      );
    }

    // Diseases
    if (type === 'diseases') {
      fields.push(
        <div key="disease-fields" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('oieWoahCode')}>
              <input type="text" value={oieCode} onChange={(e) => setOieCode(e.target.value)}
                placeholder="e.g., A010"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
            <Field label={t('category')}>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
                <option value="">{t('selectCategory')}</option>
                <option value="viral">{t('catViral')}</option>
                <option value="bacterial">{t('catBacterial')}</option>
                <option value="parasitic">{t('catParasitic')}</option>
                <option value="fungal">{t('catFungal')}</option>
                <option value="prion">{t('catPrion')}</option>
              </select>
            </Field>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isNotifiable} onChange={(e) => setIsNotifiable(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
              <span className="font-medium text-gray-700 dark:text-gray-300">{t('notifiableWoah')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isZoonotic} onChange={(e) => setIsZoonotic(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
              <span className="font-medium text-gray-700 dark:text-gray-300">{t('zoonotic')}</span>
            </label>
          </div>
          {/* Susceptible Species multi-select */}
          <DiseaseSpeciesSelect
            selectedIds={selectedSpeciesIds}
            onChange={setSelectedSpeciesIds}
          />
        </div>
      );
    }

    // Clinical Signs
    if (type === 'clinical-signs') {
      fields.push(
        <div key="sign-fields" className="space-y-4">
          <CascadeSelect
            label={t('disease')}
            type="diseases"
            value={diseaseId}
            onChange={(v) => setDiseaseId(v as string)}
            required
          />
          <Field label={t('severity')}>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
              <option value="">{t('selectSeverity')}</option>
              <option value="low">{t('sevLow')}</option>
              <option value="moderate">{t('sevModerate')}</option>
              <option value="high">{t('sevHigh')}</option>
              <option value="critical">{t('sevCritical')}</option>
            </select>
          </Field>
        </div>
      );
    }

    // Control Measures
    if (type === 'control-measures') {
      fields.push(
        <div key="measure-fields" className="space-y-4">
          <CascadeSelect
            label={t('diseaseOptional')}
            type="diseases"
            value={diseaseId}
            onChange={(v) => setDiseaseId(v as string)}
          />
          <Field label={t('type')}>
            <select value={fieldType} onChange={(e) => setFieldType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
              <option value="">{t('selectType')}</option>
              <option value="prevention">{t('ctrlPrevention')}</option>
              <option value="containment">{t('ctrlContainment')}</option>
              <option value="eradication">{t('ctrlEradication')}</option>
              <option value="surveillance">{t('ctrlSurveillance')}</option>
              <option value="treatment">{t('ctrlTreatment')}</option>
            </select>
          </Field>
        </div>
      );
    }

    // Seizure Reasons / Contamination Sources
    if (['seizure-reasons', 'contamination-sources'].includes(type)) {
      fields.push(
        <Field key="category" label={t('category')}>
          <input type="text" value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
        </Field>
      );
    }

    // Sample Types
    if (type === 'sample-types') {
      fields.push(
        <div key="sample-fields" className="grid grid-cols-2 gap-4">
          <Field label={t('category')}>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
              <option value="">{t('selectCategory')}</option>
              <option value="liquid">Liquid</option>
              <option value="solid">Solid</option>
              <option value="swab">Swab</option>
              <option value="environmental">Environmental</option>
            </select>
          </Field>
          <Field label={t('storageTemperature')}>
            <input type="text" value={storageTemp} onChange={(e) => setStorageTemp(e.target.value)}
              placeholder="e.g., 2-8C, -20C"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
          </Field>
        </div>
      );
    }

    // Production Systems
    if (type === 'production-systems') {
      fields.push(
        <Field key="category" label={t('category')}>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
            <option value="">{t('selectCategory')}</option>
            <option value="extensive">Extensive</option>
            <option value="mixed">Mixed</option>
            <option value="semi_intensive">Semi-Intensive</option>
            <option value="intensive">Intensive</option>
          </select>
        </Field>
      );
    }

    // Breeds
    if (type === 'breeds') {
      fields.push(
        <div key="breed-fields" className="space-y-4">
          <CascadeSelect label={t('species')} type="species" value={speciesId} onChange={(v) => setSpeciesId(v as string)} required />
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('origin')}>
              <input type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g., East Africa"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
            <Field label={t('purpose')}>
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
                <option value="">{t('selectPurpose')}</option>
                <option value="meat">Meat</option>
                <option value="dairy">Dairy</option>
                <option value="dual">Dual Purpose</option>
                <option value="draft">Draft</option>
                <option value="wool">Wool</option>
              </select>
            </Field>
          </div>
        </div>
      );
    }

    // Vaccine Types
    if (type === 'vaccine-types') {
      fields.push(
        <div key="vaccine-fields" className="space-y-4">
          <CascadeSelect label={t('disease')} type="diseases" value={diseaseId} onChange={(v) => setDiseaseId(v as string)} required />
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('vaccineClass')}>
              <select value={vaccineClass} onChange={(e) => setVaccineClass(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
                <option value="">{t('selectClass')}</option>
                <option value="live">Live Attenuated</option>
                <option value="inactivated">Inactivated</option>
                <option value="subunit">Subunit</option>
                <option value="vectored">Vectored</option>
              </select>
            </Field>
            <Field label={t('manufacturer')}>
              <input type="text" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('routeOfAdministration')}>
              <select value={routeOfAdmin} onChange={(e) => setRouteOfAdmin(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
                <option value="">{t('selectRoute')}</option>
                <option value="subcutaneous">Subcutaneous</option>
                <option value="intramuscular">Intramuscular</option>
                <option value="intranasal">Intranasal</option>
                <option value="eye-drop">Eye Drop</option>
                <option value="oral">Oral</option>
                <option value="in-water">In Water</option>
              </select>
            </Field>
            <Field label={t('dosesRequired')}>
              <input type="number" value={dosesRequired} onChange={(e) => setDosesRequired(e.target.value)} min="1"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
          </div>
        </div>
      );
    }

    // Test Types
    if (type === 'test-types') {
      fields.push(
        <div key="test-fields" className="grid grid-cols-2 gap-4">
          <Field label={t('testCategory')}>
            <select value={testCategory} onChange={(e) => setTestCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
              <option value="">{t('selectCategory')}</option>
              <option value="serology">Serology</option>
              <option value="pcr">PCR</option>
              <option value="antigen">Antigen Detection</option>
              <option value="culture">Culture/Isolation</option>
              <option value="microscopy">Microscopy</option>
              <option value="rapid">Rapid Test</option>
            </select>
          </Field>
          <Field label={t('turnaroundDays')}>
            <input type="number" value={turnaroundDays} onChange={(e) => setTurnaroundDays(e.target.value)} min="0"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
          </Field>
        </div>
      );
    }

    // Labs
    if (type === 'labs') {
      fields.push(
        <div key="lab-fields" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Field label={t('labLevel')}>
              <select value={labLevel} onChange={(e) => setLabLevel(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
                <option value="">{t('selectLevel')}</option>
                <option value="field">Field</option>
                <option value="regional">Regional</option>
                <option value="national">National</option>
                <option value="reference">Reference</option>
              </select>
            </Field>
            <Field label={t('bslLevel')}>
              <select value={bslLevel} onChange={(e) => setBslLevel(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
                <option value="">{t('selectBsl')}</option>
                <option value="1">BSL-1</option>
                <option value="2">BSL-2</option>
                <option value="3">BSL-3</option>
                <option value="4">BSL-4</option>
              </select>
            </Field>
            <Field label={t('accreditation')}>
              <input type="text" value={accreditation} onChange={(e) => setAccreditation(e.target.value)} placeholder="e.g., ISO 17025"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('latitude')}>
              <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
            <Field label={t('longitude')}>
              <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
          </div>
          <Field label={t('address')}>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('contactName')}>
              <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
            <Field label={t('contactPhone')}>
              <input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
          </div>
        </div>
      );
    }

    // Livestock Products
    if (type === 'livestock-products') {
      fields.push(
        <Field key="product-cat" label={t('productCategory')}>
          <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
            <option value="">Select category</option>
            <option value="milk">Milk</option>
            <option value="meat">Meat</option>
            <option value="egg">Egg</option>
            <option value="wool">Wool</option>
            <option value="hide">Hide</option>
            <option value="leather">Leather</option>
            <option value="honey">Honey</option>
            <option value="manure">Manure</option>
          </select>
        </Field>
      );
    }

    // Census Methodologies
    if (type === 'census-methodologies') {
      fields.push(
        <Field key="method-type" label={t('methodType')}>
          <select value={methodType} onChange={(e) => setMethodType(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
            <option value="">{t('selectMethod')}</option>
            <option value="census">Full Census</option>
            <option value="survey">Sample Survey</option>
            <option value="estimate">Estimate</option>
            <option value="aerial">Aerial Survey</option>
            <option value="sample">Sample Frame</option>
          </select>
        </Field>
      );
    }

    // Gear Types
    if (type === 'gear-types') {
      fields.push(
        <Field key="gear-cat" label={t('gearCategory')}>
          <select value={gearCategory} onChange={(e) => setGearCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
            <option value="">{t('selectCategory')}</option>
            <option value="trawl">Trawl</option>
            <option value="net">Net</option>
            <option value="line">Line</option>
            <option value="trap">Trap</option>
            <option value="other">Other</option>
          </select>
        </Field>
      );
    }

    // Vessel Types
    if (type === 'vessel-types') {
      fields.push(
        <div key="vessel-fields" className="grid grid-cols-2 gap-4">
          <Field label={t('lengthCategory')}>
            <select value={lengthCategory} onChange={(e) => setLengthCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
              <option value="">{t('selectSize')}</option>
              <option value="small">Small (&lt;12m)</option>
              <option value="medium">Medium (12-24m)</option>
              <option value="large">Large (&gt;24m)</option>
            </select>
          </Field>
          <Field label={t('propulsionType')}>
            <input type="text" value={propulsionType} onChange={(e) => setPropulsionType(e.target.value)} placeholder="e.g., diesel, outboard"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
          </Field>
        </div>
      );
    }

    // Aquaculture Farm Types
    if (type === 'aquaculture-farm-types') {
      fields.push(
        <div key="aqua-fields" className="grid grid-cols-2 gap-4">
          <Field label={t('waterType')}>
            <select value={waterType} onChange={(e) => setWaterType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
              <option value="">{t('selectWaterType')}</option>
              <option value="freshwater">Freshwater</option>
              <option value="marine">Marine</option>
              <option value="brackish">Brackish</option>
            </select>
          </Field>
          <Field label={t('cultureSystem')}>
            <select value={cultureSystem} onChange={(e) => setCultureSystem(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
              <option value="">{t('selectSystem')}</option>
              <option value="pond">Pond</option>
              <option value="cage">Cage</option>
              <option value="raceway">Raceway</option>
              <option value="tank">Tank</option>
              <option value="RAS">RAS</option>
            </select>
          </Field>
        </div>
      );
    }

    // Landing Sites
    if (type === 'landing-sites') {
      fields.push(
        <div key="landing-fields" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('latitude')}>
              <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
            <Field label={t('longitude')}>
              <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('adminLevel1')}>
              <input type="text" value={adminLevel1} onChange={(e) => setAdminLevel1(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
            <Field label={t('capacity')}>
              <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} min="0"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
          </div>
          <Field label={t('address')}>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
          </Field>
        </div>
      );
    }

    // Conservation Statuses
    if (type === 'conservation-statuses') {
      fields.push(
        <Field key="iucn" label={t('iucnCode')}>
          <select value={iucnCode} onChange={(e) => setIucnCode(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
            <option value="">{t('selectIucn')}</option>
            <option value="LC">LC - Least Concern</option>
            <option value="NT">NT - Near Threatened</option>
            <option value="VU">VU - Vulnerable</option>
            <option value="EN">EN - Endangered</option>
            <option value="CR">CR - Critically Endangered</option>
            <option value="EW">EW - Extinct in the Wild</option>
            <option value="EX">EX - Extinct</option>
          </select>
        </Field>
      );
    }

    // Habitat Types
    if (type === 'habitat-types') {
      fields.push(
        <Field key="biome" label={t('biome')}>
          <select value={biome} onChange={(e) => setBiome(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
            <option value="">{t('selectBiome')}</option>
            <option value="forest">Forest</option>
            <option value="savanna">Savanna</option>
            <option value="wetland">Wetland</option>
            <option value="desert">Desert</option>
            <option value="marine">Marine</option>
            <option value="mountain">Mountain</option>
            <option value="grassland">Grassland</option>
          </select>
        </Field>
      );
    }

    // Crime Types
    if (type === 'crime-types') {
      fields.push(
        <Field key="crime-cat" label={t('crimeCategory')}>
          <select value={crimeCategory} onChange={(e) => setCrimeCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
            <option value="">{t('selectCategory')}</option>
            <option value="poaching">Poaching</option>
            <option value="trafficking">Trafficking</option>
            <option value="illegal-trade">Illegal Trade</option>
            <option value="habitat-destruction">Habitat Destruction</option>
            <option value="poisoning">Poisoning</option>
          </select>
        </Field>
      );
    }

    // Commodities
    if (type === 'commodities') {
      fields.push(
        <div key="commodity-fields" className="grid grid-cols-2 gap-4">
          <Field label={t('hsCode')}>
            <input type="text" value={hsCode} onChange={(e) => setHsCode(e.target.value)} placeholder="e.g., 0102"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
          </Field>
          <Field label={t('commodityGroup')}>
            <select value={commodityGroup} onChange={(e) => setCommodityGroup(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
              <option value="">{t('selectGroup')}</option>
              <option value="live-animals">Live Animals</option>
              <option value="meat">Meat</option>
              <option value="dairy">Dairy</option>
              <option value="fish">Fish</option>
              <option value="hides">Hides & Skins</option>
              <option value="honey">Honey & Beeswax</option>
              <option value="feed">Animal Feed</option>
            </select>
          </Field>
        </div>
      );
    }

    // Hive Types
    if (type === 'hive-types') {
      fields.push(
        <Field key="hive-cat" label={t('hiveCategory')}>
          <select value={hiveCategory} onChange={(e) => setHiveCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
            <option value="">{t('selectCategory')}</option>
            <option value="langstroth">Langstroth</option>
            <option value="top-bar">Top-Bar</option>
            <option value="traditional">Traditional</option>
            <option value="log">Log Hive</option>
            <option value="warre">Warr&eacute;</option>
          </select>
        </Field>
      );
    }

    // Bee Diseases
    if (type === 'bee-diseases') {
      fields.push(
        <div key="bee-disease-fields" className="grid grid-cols-2 gap-4">
          <Field label={t('pathogenType')}>
            <select value={pathogenType} onChange={(e) => setPathogenType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
              <option value="">{t('selectType')}</option>
              <option value="virus">Virus</option>
              <option value="bacteria">Bacteria</option>
              <option value="parasite">Parasite</option>
              <option value="fungal">Fungal</option>
            </select>
          </Field>
          <Field label={t('affectedCaste')}>
            <select value={affectedCaste} onChange={(e) => setAffectedCaste(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
              <option value="">{t('selectType')}</option>
              <option value="worker">Worker</option>
              <option value="queen">Queen</option>
              <option value="brood">Brood</option>
              <option value="all">All</option>
            </select>
          </Field>
        </div>
      );
    }

    // Floral Sources
    if (type === 'floral-sources') {
      fields.push(
        <div key="floral-fields" className="grid grid-cols-2 gap-4">
          <Field label={t('floweringSeason')}>
            <select value={floweringSeason} onChange={(e) => setFloweringSeason(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
              <option value="">{t('selectSeason')}</option>
              <option value="dry">Dry Season</option>
              <option value="wet">Wet Season</option>
              <option value="all-year">All Year</option>
            </select>
          </Field>
          <Field label={t('nectarType')}>
            <select value={nectarType} onChange={(e) => setNectarType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
              <option value="">{t('selectType')}</option>
              <option value="monofloral">Monofloral</option>
              <option value="polyfloral">Polyfloral</option>
            </select>
          </Field>
        </div>
      );
    }

    // Legal Framework Types
    if (type === 'legal-framework-types') {
      fields.push(
        <Field key="fw-cat" label={t('frameworkCategory')}>
          <select value={frameworkCategory} onChange={(e) => setFrameworkCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
            <option value="">{t('selectCategory')}</option>
            <option value="law">Law/Act</option>
            <option value="regulation">Regulation</option>
            <option value="decree">Decree/Order</option>
            <option value="policy">Policy</option>
            <option value="standard">Standard/Norm</option>
            <option value="guideline">Guideline/SOP</option>
          </select>
        </Field>
      );
    }

    // Stakeholder Types
    if (type === 'stakeholder-types') {
      fields.push(
        <Field key="sector" label={t('sector')}>
          <select value={sector} onChange={(e) => setSector(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
            <option value="">{t('selectType')}</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="ngo">NGO</option>
            <option value="international">International</option>
            <option value="academic">Academic</option>
            <option value="research">Research</option>
          </select>
        </Field>
      );
    }

    // Location-based entities (abattoirs, markets, checkpoints)
    if (['abattoirs', 'markets', 'checkpoints'].includes(type)) {
      fields.push(
        <div key="location-fields" className="space-y-4">
          <Field label={t('type')}>
            <TypeSelect entityType={type} value={fieldType} onChange={setFieldType} />
          </Field>
          {type !== 'checkpoints' && (
            <Field label={t('capacity')}>
              <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} min="0"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('latitude')}>
              <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
            <Field label={t('longitude')}>
              <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
          </div>
          <Field label={t('address')}>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label={t('adminLevel1')}>
              <input type="text" value={adminLevel1} onChange={(e) => setAdminLevel1(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
            <Field label={t('adminLevel2')}>
              <input type="text" value={adminLevel2} onChange={(e) => setAdminLevel2(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
            <Field label={t('adminLevel3')}>
              <input type="text" value={adminLevel3} onChange={(e) => setAdminLevel3(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('contactName')}>
              <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
            <Field label={t('contactPhone')}>
              <input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
            </Field>
          </div>
          {type === 'abattoirs' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('licenseNumber')}>
                <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
              </Field>
              <Field label={t('licenseExpiry')}>
                <input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
              </Field>
            </div>
          )}
          {type === 'markets' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('frequency')}>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
                  <option value="">{t('selectFrequency')}</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
              <Field label={t('marketDay')}>
                <select value={marketDay} onChange={(e) => setMarketDay(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
                  <option value="">{t('selectDay')}</option>
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </Field>
            </div>
          )}
          {type === 'checkpoints' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('borderWith')}>
                <input type="text" value={borderWith} onChange={(e) => setBorderWith(e.target.value.toUpperCase())} maxLength={2}
                  placeholder="e.g., TZ, UG"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
              </Field>
              <Field label={t('operatingHours')}>
                <input type="text" value={operatingHours} onChange={(e) => setOperatingHours(e.target.value)}
                  placeholder="e.g., 06:00-18:00"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500" />
              </Field>
            </div>
          )}
        </div>
      );
    }

    if (fields.length === 0) return null;

    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
          {config!.label} Fields
        </h2>
        <div className="space-y-4">{fields}</div>
      </div>
    );
  }
}

// ─── Helper components ─────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {hint && <p className="mb-1 text-xs text-gray-400">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function TypeSelect({ entityType, value, onChange }: { entityType: string; value: string; onChange: (v: string) => void }) {
  const options: Record<string, Array<{ value: string; label: string }>> = {
    abattoirs: [
      { value: 'industrial', label: 'Industrial' },
      { value: 'semi_industrial', label: 'Semi-Industrial' },
      { value: 'traditional', label: 'Traditional' },
    ],
    markets: [
      { value: 'livestock', label: 'Livestock' },
      { value: 'mixed', label: 'Mixed' },
      { value: 'wholesale', label: 'Wholesale' },
      { value: 'retail', label: 'Retail' },
    ],
    checkpoints: [
      { value: 'border', label: 'Border Post' },
      { value: 'quarantine', label: 'Quarantine Station' },
      { value: 'inspection', label: 'Inspection Point' },
      { value: 'weighbridge', label: 'Weighbridge' },
    ],
  };

  const opts = options[entityType] ?? [];

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-aris-primary-500 focus:outline-none focus:ring-1 focus:ring-aris-primary-500">
      <option value="">--</option>
      {opts.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

/* ── Disease-Species multi-select ─────────────────────────────── */

function DiseaseSpeciesSelect({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations('masterData.form');
  const { data, isLoading } = useRefDataForSelect('species' as RefDataType);
  const allSpecies = React.useMemo(() => {
    if (!data?.data) return [];
    return data.data
      .map((s) => ({ id: s.id, label: s.name?.en || s.code || s.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const [search, setSearch] = React.useState('');

  const filtered = React.useMemo(() => {
    if (!search.trim()) return allSpecies;
    const q = search.toLowerCase();
    return allSpecies.filter((s) => s.label.toLowerCase().includes(q));
  }, [allSpecies, search]);

  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = () => onChange(filtered.map((s) => s.id));
  const clearAll = () => onChange([]);

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('susceptibleSpecies')}
        <span className="ml-2 text-xs font-normal text-gray-400">({t('selectedCount', { count: selectedIds.length })})</span>
      </label>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700">
        {/* Search + actions */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchSpecies')}
            className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-300"
          />
          <button type="button" onClick={selectAll} className="text-xs text-aris-primary-600 hover:underline">{t('selectAll')}</button>
          <button type="button" onClick={clearAll} className="text-xs text-gray-400 hover:underline">{t('clearAll')}</button>
        </div>
        {/* Scrollable checkbox list */}
        <div className="max-h-48 overflow-y-auto p-2">
          {isLoading ? (
            <p className="py-4 text-center text-xs text-gray-400">{t('loadingSpecies')}</p>
          ) : filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400">{t('noSpeciesFound')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
              {filtered.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-aris-primary-600 focus:ring-aris-primary-500"
                  />
                  <span className="truncate text-gray-700 dark:text-gray-300">{s.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
