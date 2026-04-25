'use client';

import React from 'react';

interface TextBlockWidgetProps {
  content: string;
  format?: 'plain' | 'markdown';
}

export function TextBlockWidget({ content, format = 'plain' }: TextBlockWidgetProps) {
  if (format === 'markdown') {
    // Simple markdown rendering: bold, italic, headings, lists, links
    const html = content
      .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mb-1">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mb-1">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mb-2">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-blue-600 underline" target="_blank" rel="noopener">$1</a>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/\n/g, '<br/>');

    return (
      <div
        className="h-full overflow-auto p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div className="h-full overflow-auto p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
      {content}
    </div>
  );
}
