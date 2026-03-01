'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFormBuilderStore } from '@/components/form-builder/hooks/useFormBuilder';
import { FormBuilder } from '@/components/form-builder/FormBuilder';
import {
  useFormBuilderTemplate,
  useUpdateFormTemplate,
  usePublishFormTemplate,
} from '@/lib/api/form-builder-hooks';
import type { FormTemplateData } from '@/components/form-builder/utils/form-schema';

const AUTO_SAVE_INTERVAL = 30_000; // 30 seconds

export default function FormEditorPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params?.id as string;

  const { data, isLoading, error } = useFormBuilderTemplate(formId);
  const updateMutation = useUpdateFormTemplate();
  const publishMutation = usePublishFormTemplate();
  const { initForm, form, getSchema, isDirty, setSaving, setLastSaved, markClean } = useFormBuilderStore();

  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSavingRef = useRef(false);

  // Initialize the form store when data loads
  useEffect(() => {
    if (data?.data) {
      const template = data.data;
      const formData: FormTemplateData = {
        id: template.id,
        tenantId: template.tenantId,
        name: template.name,
        domain: template.domain,
        version: template.version,
        parentTemplateId: null,
        schema: template.schema as FormTemplateData['schema'],
        uiSchema: (template.uiSchema || {}) as Record<string, unknown>,
        dataContractId: null,
        status: template.status,
        dataClassification: template.dataClassification,
        createdBy: template.createdBy,
        updatedBy: null,
        publishedAt: template.publishedAt,
        archivedAt: null,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      };
      initForm(formData);
    }
  }, [data, initForm]);

  const handleSave = useCallback(async () => {
    if (!form || !formId || isSavingRef.current) return;
    isSavingRef.current = true;
    setSaving(true);
    try {
      const schema = getSchema();
      await updateMutation.mutateAsync({
        id: formId,
        name: form.name,
        domain: form.domain,
        schema,
      });
      setLastSaved(new Date());
      markClean();
    } catch (err) {
      console.error('Failed to save form:', err);
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  }, [form, formId, getSchema, updateMutation, setSaving, setLastSaved, markClean]);

  // Auto-save: when dirty, save every AUTO_SAVE_INTERVAL ms
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setInterval(() => {
      const { isDirty: currentDirty } = useFormBuilderStore.getState();
      if (currentDirty && !isSavingRef.current) {
        handleSave();
      }
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [handleSave]);

  // Warn on unsaved changes before leaving
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const { isDirty: currentDirty } = useFormBuilderStore.getState();
      if (currentDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const handlePublish = async () => {
    if (!formId) return;
    await handleSave();
    try {
      await publishMutation.mutateAsync(formId);
      router.push('/collecte/forms');
    } catch (err) {
      console.error('Failed to publish form:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center -mx-4 -mt-5 sm:-mx-6 -mb-8">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="flex h-full items-center justify-center -mx-4 -mt-5 sm:-mx-6 -mb-8">
        <div className="text-center">
          <p className="text-sm text-red-500">Failed to load form</p>
          <button
            onClick={() => router.push('/collecte/forms')}
            className="mt-3 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
          >
            Back to Forms
          </button>
        </div>
      </div>
    );
  }

  // Negative margins to cancel the dashboard layout padding so the editor fills edge-to-edge
  return (
    <div className="-mx-4 -mt-5 sm:-mx-6 -mb-8 h-[calc(100vh-4rem)]">
      <FormBuilder onSave={handleSave} onPublish={handlePublish} />
    </div>
  );
}
