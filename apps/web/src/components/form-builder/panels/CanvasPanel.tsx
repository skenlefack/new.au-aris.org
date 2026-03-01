'use client';

import React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useFormBuilderStore } from '../hooks/useFormBuilder';
import { SectionBlock } from '../canvas/SectionBlock';

export function CanvasPanel() {
  const { getSchema, addSection, clearSelection } = useFormBuilderStore();
  const schema = getSchema();
  const sections = schema.sections.sort((a, b) => a.order - b.order);
  const sectionIds = sections.map((s) => s.id);

  return (
    <div
      className="flex-1 overflow-y-auto bg-gray-100/50 p-6 dark:bg-gray-900/30"
      onClick={() => clearSelection()}
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
          {sections.map((section, idx) => (
            <SectionBlock key={section.id} section={section} index={idx} />
          ))}
        </SortableContext>

        {/* Add Section button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            addSection();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white/50 py-6 text-sm font-medium text-gray-400 transition-colors hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-500 dark:border-gray-700 dark:bg-gray-800/30 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
        >
          <Plus className="h-5 w-5" />
          Add Section
        </button>
      </div>
    </div>
  );
}
