'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { RefDataForm } from '@/components/master-data/RefDataForm';
import type { RefDataType } from '@/lib/api/ref-data-hooks';

export default function EditRefDataPage() {
  const params = useParams();
  const typeSlug = params.type as RefDataType;
  const id = params.id as string;

  return <RefDataForm type={typeSlug} mode="edit" itemId={id} />;
}
