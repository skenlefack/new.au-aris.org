'use client';

import React from 'react';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-w-0 flex-1">{children}</div>;
}
