'use client';

import React, { useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  closestCenter,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useFormBuilderStore } from './hooks/useFormBuilder';
import { FormBuilderToolbar } from './FormBuilderToolbar';
import { FormBuilderStatusBar } from './FormBuilderStatusBar';
import { ElementsPanel } from './panels/ElementsPanel';
import { CanvasPanel } from './panels/CanvasPanel';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { PreviewModal } from './modals/PreviewModal';
import { getFieldTypeDefinition } from './utils/field-types';

interface FormBuilderProps {
  onSave: () => void;
  onPublish: () => void;
}

export function FormBuilder({ onSave, onPublish }: FormBuilderProps) {
  const {
    form,
    getSchema,
    addField,
    moveField,
    reorderSections,
    isPreviewOpen,
    setPreviewOpen,
    undo,
    redo,
  } = useFormBuilderStore();

  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);
  const [activeDragType, setActiveDragType] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, redo, onSave]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveDragId(active.id as string);
    setActiveDragType(active.data.current?.type || null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);
      setActiveDragType(null);

      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;

      // New field dropped from elements panel
      if (activeData?.type === 'new-field') {
        const fieldType = activeData.fieldType as string;
        // Determine which section to drop into
        let targetSectionId: string | null = null;
        let targetIndex: number | undefined;

        if (overData?.type === 'section-drop') {
          targetSectionId = overData.sectionId as string;
        } else if (overData?.type === 'field') {
          targetSectionId = overData.sectionId as string;
          // Find the index of the field we're over
          const schema = getSchema();
          const section = schema.sections.find((s) => s.id === targetSectionId);
          if (section) {
            const idx = section.fields.findIndex((f) => f.id === over.id);
            targetIndex = idx >= 0 ? idx : undefined;
          }
        }

        if (targetSectionId) {
          addField(targetSectionId, fieldType, targetIndex);
        } else {
          // Drop into first section if available
          const schema = getSchema();
          if (schema.sections.length > 0) {
            addField(schema.sections[0].id, fieldType);
          }
        }
        return;
      }

      // Reorder sections
      if (activeData?.type === 'section' && overData?.type === 'section') {
        const schema = getSchema();
        const oldIndex = schema.sections.findIndex((s) => s.id === active.id);
        const newIndex = schema.sections.findIndex((s) => s.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          reorderSections(oldIndex, newIndex);
        }
        return;
      }

      // Reorder/move fields
      if (activeData?.type === 'field') {
        const sourceSectionId = activeData.sectionId as string;
        const schema = getSchema();

        // Determine target
        let targetSectionId = sourceSectionId;
        let targetIndex = 0;

        if (overData?.type === 'field') {
          targetSectionId = overData.sectionId as string;
          const targetSection = schema.sections.find((s) => s.id === targetSectionId);
          if (targetSection) {
            targetIndex = targetSection.fields.findIndex((f) => f.id === over.id);
            if (targetIndex === -1) targetIndex = targetSection.fields.length;
          }
        } else if (overData?.type === 'section-drop') {
          targetSectionId = overData.sectionId as string;
          const targetSection = schema.sections.find((s) => s.id === targetSectionId);
          targetIndex = targetSection ? targetSection.fields.length : 0;
        }

        if (sourceSectionId === targetSectionId) {
          // Same section reorder
          const section = schema.sections.find((s) => s.id === sourceSectionId);
          if (section) {
            const oldIndex = section.fields.findIndex((f) => f.id === active.id);
            if (oldIndex !== -1 && oldIndex !== targetIndex) {
              moveField(active.id as string, targetSectionId, targetIndex);
            }
          }
        } else {
          // Cross-section move
          moveField(active.id as string, targetSectionId, targetIndex);
        }
      }
    },
    [addField, getSchema, moveField, reorderSections],
  );

  if (!form) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Loading form...</p>
      </div>
    );
  }

  // Drag overlay content
  let dragOverlayContent: React.ReactNode = null;
  if (activeDragId && activeDragType === 'new-field') {
    const fieldType = activeDragId.replace('new-field-', '');
    const typeDef = getFieldTypeDefinition(fieldType);
    if (typeDef) {
      const Icon = typeDef.icon;
      dragOverlayContent = (
        <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5 shadow-lg">
          <Icon className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-medium text-blue-700">{typeDef.label}</span>
        </div>
      );
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full flex-col bg-white dark:bg-gray-900">
        <FormBuilderToolbar
          onSave={onSave}
          onPublish={onPublish}
          onPreview={() => setPreviewOpen(true)}
        />

        <div className="flex flex-1 overflow-hidden">
          <ElementsPanel />
          <CanvasPanel />
          <PropertiesPanel />
        </div>

        <FormBuilderStatusBar />
      </div>

      <DragOverlay dropAnimation={null}>
        {dragOverlayContent}
      </DragOverlay>

      {isPreviewOpen && (
        <PreviewModal onClose={() => setPreviewOpen(false)} />
      )}
    </DndContext>
  );
}
