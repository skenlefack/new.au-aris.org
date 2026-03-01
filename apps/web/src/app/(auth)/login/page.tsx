import { redirect } from 'next/navigation';

/** The login form is now part of the public landing page. */
export default function LoginRedirect() {
  redirect('/');
}
