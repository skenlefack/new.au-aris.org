// Minimal full-screen layout for the Knowledge Hub publication editor.
// Bypasses the dashboard sidebar/header so the TinyMCE workspace can use the
// entire viewport. The root layout (app/layout.tsx) already provides the
// React Query / theme providers.

import { ReactNode } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function KnowledgeEditorLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">{children}</div>
    </AuthGuard>
  );
}
