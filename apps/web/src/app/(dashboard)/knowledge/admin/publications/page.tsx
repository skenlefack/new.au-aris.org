import { redirect } from 'next/navigation';

/** Publications index redirects to the admin dashboard (which lists publications). */
export default function PublicationsIndexRedirect() {
  redirect('/knowledge/admin');
}
