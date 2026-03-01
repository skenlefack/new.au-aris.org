'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { RefDataForm } from '@/components/master-data/RefDataForm';
import type { RefDataType } from '@/lib/api/ref-data-hooks';

export default function NewRefDataPage() {
  const params = useParams();
  const typeSlug = params.type as RefDataType;

  return <RefDataForm type={typeSlug} mode="create" />;
}
