'use client';

import React from 'react';

interface OfficialHeaderProps {
  title: string;
  subtitle?: string;
  classification?: string;
}

export function OfficialHeader({ title, subtitle, classification }: OfficialHeaderProps) {
  return (
    <div className="print-header mb-6 border-b-2 border-gray-900 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
            African Union — Inter-African Bureau for Animal Resources
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
          )}
        </div>
        <div className="text-right">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-900 text-sm font-bold text-white">
            AR
          </div>
          <p className="mt-1 text-[10px] text-gray-500">ARIS 3.0</p>
        </div>
      </div>
      {classification && (
        <p className="mt-2 text-xs font-medium text-gray-500">
          Data Classification: {classification}
        </p>
      )}
      <p className="mt-1 text-xs text-gray-400">
        Generated: {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
        {' '}&mdash;{' '}
        {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
