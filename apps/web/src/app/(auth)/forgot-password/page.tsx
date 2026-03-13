'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useForgotPassword } from '@/lib/api/hooks';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const mutation = useForgotPassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await mutation.mutateAsync(email.trim());
      setSubmitted(true);
    } catch {
      // error available via mutation.error
    }
  };

  if (submitted) {
    return (
      <>
        <div className="mb-8 lg:hidden">
          <h1 className="text-2xl font-bold text-aris-primary-600">ARIS</h1>
          <p className="text-sm text-gray-500">Animal Resources Information System</p>
        </div>

        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
          <p className="mt-2 text-sm text-gray-500">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
            The link expires in 15 minutes.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-aris-primary-600 hover:text-aris-primary-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-8 lg:hidden">
        <h1 className="text-2xl font-bold text-aris-primary-600">ARIS</h1>
        <p className="text-sm text-gray-500">Animal Resources Information System</p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Forgot password?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {mutation.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {mutation.error instanceof Error
              ? mutation.error.message
              : 'Something went wrong. Please try again.'}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
            placeholder="you@au-aris.org"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending || !email.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-aris-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-aris-primary-700 focus:outline-none focus:ring-2 focus:ring-aris-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {mutation.isPending ? 'Sending...' : 'Send reset link'}
        </button>

        <p className="text-center text-sm text-gray-500">
          <Link
            href="/"
            className="inline-flex items-center gap-1 font-medium text-aris-primary-600 hover:text-aris-primary-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </p>
      </form>
    </>
  );
}
