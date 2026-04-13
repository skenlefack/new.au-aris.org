import { redirect } from 'next/navigation';

/** Redirect to the dashboard-embedded publication form. */
export default function LegacyNewPublicationRedirect() {
  redirect('/knowledge/admin/publications/new');
}
