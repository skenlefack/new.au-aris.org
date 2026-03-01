'use client';

import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FIELD_CATEGORIES, FIELD_TYPES, type FieldCategory } from '../utils/field-types';

function DraggableElement({ type, label, icon: Icon, description }: {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new-field-${type}`,
    data: { type: 'new-field', fieldType: type },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2 cursor-grab active:cursor-grabbing',
        'hover:border-blue-300 hover:bg-blue-50/50 transition-colors',
        'dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600 dark:hover:bg-blue-900/20',
        isDragging && 'opacity-50 shadow-lg',
      )}
      title={description}
    >
      <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" />
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{label}</span>
    </div>
  );
}

export function ElementsPanel() {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<FieldCategory>>(new Set());

  const toggleCategory = (cat: FieldCategory) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const filteredTypes = search
    ? FIELD_TYPES.filter(
        (ft) =>
          ft.label.toLowerCase().includes(search.toLowerCase()) ||
          ft.type.toLowerCase().includes(search.toLowerCase()) ||
          ft.description.toLowerCase().includes(search.toLowerCase()),
      )
    : FIELD_TYPES;

  return (
    <div className="flex h-full w-[260px] flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/50">
      {/* Search */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields..."
            className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {FIELD_CATEGORIES.map((cat) => {
          const items = filteredTypes.filter((ft) => ft.category === cat.key);
          if (items.length === 0) return null;
          const isOpen = !collapsed.has(cat.key);

          return (
            <div key={cat.key}>
              <button
                onClick={() => toggleCategory(cat.key)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 hover:bg-gray-200/50 dark:text-gray-400 dark:hover:bg-gray-700/50"
              >
                {isOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {cat.label}
                <span className="ml-auto text-gray-400">{items.length}</span>
              </button>
              {isOpen && (
                <div className="mt-1 space-y-1 pb-2">
                  {items.map((ft) => (
                    <DraggableElement
                      key={ft.type}
                      type={ft.type}
                      label={ft.label}
                      icon={ft.icon}
                      description={ft.description}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
