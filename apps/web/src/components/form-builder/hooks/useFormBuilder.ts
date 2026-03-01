// FormBuilder — Main Zustand store
import { create } from 'zustand';
import type {
  FormSchema,
  FormSection,
  FormField,
  FormTemplateData,
} from '../utils/form-schema';
import {
  createDefaultField,
  createDefaultSection,
  createDefaultFormSchema,
} from '../utils/form-schema';

interface FormBuilderState {
  // Form data
  form: FormTemplateData | null;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;

  // Selections
  selectedFieldId: string | null;
  selectedSectionId: string | null;

  // UI
  isPreviewOpen: boolean;
  searchFilter: string;

  // History (undo/redo)
  history: FormSchema[];
  historyIndex: number;

  // Actions - Form
  initForm: (form: FormTemplateData) => void;
  initNewForm: (name: string, domain: string) => void;
  getSchema: () => FormSchema;
  setSchema: (schema: FormSchema) => void;
  setSaving: (saving: boolean) => void;
  setLastSaved: (date: Date) => void;
  markClean: () => void;

  // Actions - Sections
  addSection: (section?: Partial<FormSection>) => void;
  updateSection: (sectionId: string, data: Partial<FormSection>) => void;
  removeSection: (sectionId: string) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  duplicateSection: (sectionId: string) => void;

  // Actions - Fields
  addField: (sectionId: string, fieldType: string, index?: number) => void;
  updateField: (fieldId: string, data: Partial<FormField>) => void;
  removeField: (fieldId: string) => void;
  moveField: (fieldId: string, targetSectionId: string, targetIndex: number) => void;
  duplicateField: (fieldId: string) => void;

  // Actions - Selection
  selectField: (fieldId: string | null) => void;
  selectSection: (sectionId: string | null) => void;
  clearSelection: () => void;

  // Actions - History
  undo: () => void;
  redo: () => void;

  // Actions - UI
  setPreviewOpen: (open: boolean) => void;
  setSearchFilter: (filter: string) => void;
}

function pushHistory(state: FormBuilderState, schema: FormSchema): Partial<FormBuilderState> {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(schema)));
  // Keep max 50 history entries
  if (newHistory.length > 50) newHistory.shift();
  return {
    history: newHistory,
    historyIndex: newHistory.length - 1,
    isDirty: true,
  };
}

export const useFormBuilderStore = create<FormBuilderState>((set, get) => ({
  form: null,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  selectedFieldId: null,
  selectedSectionId: null,
  isPreviewOpen: false,
  searchFilter: '',
  history: [],
  historyIndex: -1,

  initForm: (form) => {
    const schema = (form.schema && typeof form.schema === 'object' && 'sections' in form.schema)
      ? form.schema as FormSchema
      : createDefaultFormSchema();
    set({
      form,
      isDirty: false,
      selectedFieldId: null,
      selectedSectionId: null,
      history: [JSON.parse(JSON.stringify(schema))],
      historyIndex: 0,
    });
  },

  initNewForm: (name, domain) => {
    const schema = createDefaultFormSchema();
    const form: FormTemplateData = {
      id: '',
      tenantId: '',
      name,
      domain,
      version: 1,
      parentTemplateId: null,
      schema,
      uiSchema: {},
      dataContractId: null,
      status: 'DRAFT',
      dataClassification: 'RESTRICTED',
      createdBy: '',
      updatedBy: null,
      publishedAt: null,
      archivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set({
      form,
      isDirty: false,
      selectedFieldId: null,
      selectedSectionId: null,
      history: [JSON.parse(JSON.stringify(schema))],
      historyIndex: 0,
    });
  },

  getSchema: () => {
    const { form } = get();
    if (!form) return createDefaultFormSchema();
    return (form.schema && typeof form.schema === 'object' && 'sections' in form.schema)
      ? form.schema as FormSchema
      : createDefaultFormSchema();
  },

  setSchema: (schema) => {
    const { form } = get();
    if (!form) return;
    set((state) => ({
      form: { ...form, schema },
      ...pushHistory(state, schema),
    }));
  },

  setSaving: (saving) => set({ isSaving: saving }),
  setLastSaved: (date) => set({ lastSavedAt: date }),
  markClean: () => set({ isDirty: false }),

  // Sections
  addSection: (partial) => {
    const schema = get().getSchema();
    const section = { ...createDefaultSection(), ...partial };
    section.order = schema.sections.length;
    const newSchema = {
      ...schema,
      sections: [...schema.sections, section],
    };
    get().setSchema(newSchema);
  },

  updateSection: (sectionId, data) => {
    const schema = get().getSchema();
    const newSchema = {
      ...schema,
      sections: schema.sections.map((s) =>
        s.id === sectionId ? { ...s, ...data } : s,
      ),
    };
    get().setSchema(newSchema);
  },

  removeSection: (sectionId) => {
    const schema = get().getSchema();
    const newSchema = {
      ...schema,
      sections: schema.sections
        .filter((s) => s.id !== sectionId)
        .map((s, i) => ({ ...s, order: i })),
    };
    set({ selectedSectionId: null, selectedFieldId: null });
    get().setSchema(newSchema);
  },

  reorderSections: (fromIndex, toIndex) => {
    const schema = get().getSchema();
    const sections = [...schema.sections];
    const [moved] = sections.splice(fromIndex, 1);
    sections.splice(toIndex, 0, moved);
    const newSchema = {
      ...schema,
      sections: sections.map((s, i) => ({ ...s, order: i })),
    };
    get().setSchema(newSchema);
  },

  duplicateSection: (sectionId) => {
    const schema = get().getSchema();
    const original = schema.sections.find((s) => s.id === sectionId);
    if (!original) return;
    const copy: FormSection = JSON.parse(JSON.stringify(original));
    copy.id = crypto.randomUUID();
    copy.name = { ...copy.name, en: `${copy.name.en || ''} (Copy)` };
    copy.fields = copy.fields.map((f) => ({ ...f, id: crypto.randomUUID() }));
    copy.order = schema.sections.length;
    const newSchema = {
      ...schema,
      sections: [...schema.sections, copy],
    };
    get().setSchema(newSchema);
  },

  // Fields
  addField: (sectionId, fieldType, index) => {
    const schema = get().getSchema();
    const field = createDefaultField(fieldType, sectionId);
    const newSchema = {
      ...schema,
      sections: schema.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const fields = [...s.fields];
        const insertAt = index !== undefined ? index : fields.length;
        field.order = insertAt;
        fields.splice(insertAt, 0, field);
        return {
          ...s,
          fields: fields.map((f, i) => ({ ...f, order: i })),
        };
      }),
    };
    get().setSchema(newSchema);
    set({ selectedFieldId: field.id, selectedSectionId: null });
  },

  updateField: (fieldId, data) => {
    const schema = get().getSchema();
    const newSchema = {
      ...schema,
      sections: schema.sections.map((s) => ({
        ...s,
        fields: s.fields.map((f) =>
          f.id === fieldId ? { ...f, ...data } : f,
        ),
      })),
    };
    get().setSchema(newSchema);
  },

  removeField: (fieldId) => {
    const schema = get().getSchema();
    const newSchema = {
      ...schema,
      sections: schema.sections.map((s) => ({
        ...s,
        fields: s.fields
          .filter((f) => f.id !== fieldId)
          .map((f, i) => ({ ...f, order: i })),
      })),
    };
    set({ selectedFieldId: null });
    get().setSchema(newSchema);
  },

  moveField: (fieldId, targetSectionId, targetIndex) => {
    const schema = get().getSchema();
    let movedField: FormField | null = null;

    // Remove from source
    const withoutField = schema.sections.map((s) => {
      const idx = s.fields.findIndex((f) => f.id === fieldId);
      if (idx === -1) return s;
      movedField = s.fields[idx];
      return {
        ...s,
        fields: s.fields.filter((f) => f.id !== fieldId).map((f, i) => ({ ...f, order: i })),
      };
    });

    if (!movedField) return;

    // Insert into target
    const newSchema = {
      ...schema,
      sections: withoutField.map((s) => {
        if (s.id !== targetSectionId) return s;
        const fields = [...s.fields];
        fields.splice(targetIndex, 0, movedField!);
        return {
          ...s,
          fields: fields.map((f, i) => ({ ...f, order: i })),
        };
      }),
    };
    get().setSchema(newSchema);
  },

  duplicateField: (fieldId) => {
    const schema = get().getSchema();
    let newFieldId = '';
    const newSchema = {
      ...schema,
      sections: schema.sections.map((s) => {
        const idx = s.fields.findIndex((f) => f.id === fieldId);
        if (idx === -1) return s;
        const copy: FormField = JSON.parse(JSON.stringify(s.fields[idx]));
        copy.id = crypto.randomUUID();
        newFieldId = copy.id;
        copy.code = copy.code ? `${copy.code}_copy` : '';
        copy.label = { ...copy.label, en: `${copy.label.en || ''} (Copy)` };
        const fields = [...s.fields];
        fields.splice(idx + 1, 0, copy);
        return {
          ...s,
          fields: fields.map((f, i) => ({ ...f, order: i })),
        };
      }),
    };
    get().setSchema(newSchema);
    if (newFieldId) set({ selectedFieldId: newFieldId });
  },

  // Selection
  selectField: (fieldId) => set({ selectedFieldId: fieldId, selectedSectionId: null }),
  selectSection: (sectionId) => set({ selectedSectionId: sectionId, selectedFieldId: null }),
  clearSelection: () => set({ selectedFieldId: null, selectedSectionId: null }),

  // History
  undo: () => {
    const { historyIndex, history, form } = get();
    if (historyIndex <= 0 || !form) return;
    const newIndex = historyIndex - 1;
    const schema = JSON.parse(JSON.stringify(history[newIndex]));
    set({
      form: { ...form, schema },
      historyIndex: newIndex,
      isDirty: true,
    });
  },

  redo: () => {
    const { historyIndex, history, form } = get();
    if (historyIndex >= history.length - 1 || !form) return;
    const newIndex = historyIndex + 1;
    const schema = JSON.parse(JSON.stringify(history[newIndex]));
    set({
      form: { ...form, schema },
      historyIndex: newIndex,
      isDirty: true,
    });
  },

  // UI
  setPreviewOpen: (open) => set({ isPreviewOpen: open }),
  setSearchFilter: (filter) => set({ searchFilter: filter }),
}));
