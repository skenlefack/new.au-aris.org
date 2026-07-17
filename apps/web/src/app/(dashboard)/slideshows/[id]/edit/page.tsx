'use client';

import { useParams } from 'next/navigation';
import { SlideshowEditor } from '@/components/slideshow/SlideshowEditor';

export default function EditSlideshowPage() {
  const params = useParams();
  const id = params?.id as string;
  return <SlideshowEditor slideshowId={id} />;
}
