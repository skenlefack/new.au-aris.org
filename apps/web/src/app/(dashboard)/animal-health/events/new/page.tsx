'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useCreateHealthEvent } from '@/lib/api/hooks';

const eventSchema = z.object({
  disease: z.string().min(1, 'Disease name is required'),
  diseaseCode: z.string().min(1, 'Disease code is required'),
  country: z.string().min(1, 'Country is required'),
  countryCode: z.string().min(2, 'Country code is required').max(3),
  region: z.string().min(1, 'Region is required'),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  cases: z.coerce.number().int().min(0),
  deaths: z.coerce.number().int().min(0),
  speciesAffected: z.string().min(1, 'At least one species is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  measures: z.string().optional(),
});

type EventForm = z.infer<typeof eventSchema>;

const DISEASES = [
  { code: 'FMD', name: 'Foot-and-Mouth Disease' },
  { code: 'PPR', name: 'Peste des Petits Ruminants' },
  { code: 'HPAI', name: 'Highly Pathogenic Avian Influenza' },
  { code: 'ASF', name: 'African Swine Fever' },
  { code: 'RVF', name: 'Rift Valley Fever' },
  { code: 'LSD', name: 'Lumpy Skin Disease' },
  { code: 'ND', name: 'Newcastle Disease' },
  { code: 'CBPP', name: 'Contagious Bovine Pleuropneumonia' },
  { code: 'CCPP', name: 'Contagious Caprine Pleuropneumonia' },
  { code: 'AHS', name: 'African Horse Sickness' },
];

export default function CreateEventPage() {
  const router = useRouter();
  const createMutation = useCreateHealthEvent();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      severity: 'medium',
      cases: 0,
      deaths: 0,
      lat: 0,
      lng: 0,
    },
  });

  const onSubmit = async (data: EventForm) => {
    try {
      await createMutation.mutateAsync({
        ...data,
        speciesAffected: data.speciesAffected.split(',').map((s) => s.trim()),
        measures: data.measures
          ? data.measures.split('\n').filter(Boolean)
          : [],
      });
      router.push('/animal-health');
    } catch {
      // error displayed via mutation state
    }
  };

  function handleDiseaseSelect(code: string) {
    const d = DISEASES.find((dis) => dis.code === code);
    if (d) {
      setValue('disease', d.name);
      setValue('diseaseCode', d.code);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/animal-health"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Report Health Event
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Submit a new disease event for validation
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 rounded-card border border-gray-200 bg-white p-6"
      >
        {createMutation.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : 'Failed to create event'}
          </div>
        )}

        {/* Disease info */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-900">
            Disease Information
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Disease (WOAH list)
              </label>
              <select
                onChange={(e) => handleDiseaseSelect(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
              >
                <option value="">Select a disease...</option>
                {DISEASES.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
              <input type="hidden" {...register('disease')} />
              <input type="hidden" {...register('diseaseCode')} />
              {errors.disease && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.disease.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Severity
              </label>
              <select
                {...register('severity')}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* Location */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-900">
            Location
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Country
              </label>
              <input
                {...register('country')}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
                placeholder="e.g., Kenya"
              />
              {errors.country && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.country.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Country Code (ISO)
              </label>
              <input
                {...register('countryCode')}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm uppercase focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
                placeholder="e.g., KE"
                maxLength={3}
              />
              {errors.countryCode && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.countryCode.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Region / Admin Level 1
              </label>
              <input
                {...register('region')}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
                placeholder="e.g., Rift Valley"
              />
              {errors.region && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.region.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  {...register('lat')}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
                  placeholder="-1.286"
                />
                {errors.lat && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.lat.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  {...register('lng')}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
                  placeholder="36.817"
                />
                {errors.lng && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.lng.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </fieldset>

        {/* Impact */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-900">
            Impact
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Cases
              </label>
              <input
                type="number"
                {...register('cases')}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
              />
              {errors.cases && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.cases.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Deaths
              </label>
              <input
                type="number"
                {...register('deaths')}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
              />
              {errors.deaths && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.deaths.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Species Affected
              </label>
              <input
                {...register('speciesAffected')}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
                placeholder="Cattle, Goat"
              />
              <p className="mt-1 text-xs text-gray-400">
                Comma-separated list
              </p>
              {errors.speciesAffected && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.speciesAffected.message}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        {/* Description & Measures */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-gray-900">
            Details
          </legend>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={4}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
              placeholder="Describe the event, including clinical signs, epidemiological context, and affected area..."
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">
                {errors.description.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Control Measures
            </label>
            <textarea
              {...register('measures')}
              rows={3}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
              placeholder="One measure per line&#10;e.g., Movement restrictions imposed&#10;Ring vaccination initiated"
            />
            <p className="mt-1 text-xs text-gray-400">
              One measure per line (optional)
            </p>
          </div>
        </fieldset>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <Link
            href="/animal-health"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-aris-primary-700 disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {createMutation.isPending ? 'Submitting...' : 'Submit Event'}
          </button>
        </div>
      </form>
    </div>
  );
}
