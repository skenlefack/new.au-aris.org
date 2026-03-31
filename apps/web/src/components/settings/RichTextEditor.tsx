'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link as LinkIcon, Image as ImageIcon,
  Undo2, Redo2, Heading2, Heading3, RemoveFormatting,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  height?: number;
}

export function RichTextEditor({ value, onChange, disabled = false, height = 400 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const suppressRef = useRef(true);

  // Set initial content once
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = value || '';
    // Allow change events after initial set
    requestAnimationFrame(() => { suppressRef.current = false; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external value changes (e.g. data load from API)
  useEffect(() => {
    if (!editorRef.current || suppressRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      suppressRef.current = true;
      editorRef.current.innerHTML = value || '';
      requestAnimationFrame(() => { suppressRef.current = false; });
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (suppressRef.current || !editorRef.current) return;
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const exec = useCallback((command: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    // Trigger onChange after formatting
    if (!suppressRef.current && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const addLink = useCallback(() => {
    const url = window.prompt('URL', 'https://');
    if (url) exec('createLink', url);
  }, [exec]);

  const addImage = useCallback(() => {
    const url = window.prompt('Image URL');
    if (url) exec('insertImage', url);
  }, [exec]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result) exec('insertImage', reader.result as string);
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }, [exec]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800">
        <TBtn onClick={() => exec('undo')} title="Undo"><Undo2 className="h-4 w-4" /></TBtn>
        <TBtn onClick={() => exec('redo')} title="Redo"><Redo2 className="h-4 w-4" /></TBtn>
        <TSep />
        <TBtn onClick={() => exec('formatBlock', 'h2')} title="Heading 2"><Heading2 className="h-4 w-4" /></TBtn>
        <TBtn onClick={() => exec('formatBlock', 'h3')} title="Heading 3"><Heading3 className="h-4 w-4" /></TBtn>
        <TSep />
        <TBtn onClick={() => exec('bold')} title="Bold"><Bold className="h-4 w-4" /></TBtn>
        <TBtn onClick={() => exec('italic')} title="Italic"><Italic className="h-4 w-4" /></TBtn>
        <TBtn onClick={() => exec('underline')} title="Underline"><UnderlineIcon className="h-4 w-4" /></TBtn>
        <TBtn onClick={() => exec('strikeThrough')} title="Strikethrough"><Strikethrough className="h-4 w-4" /></TBtn>
        <TSep />
        <TBtn onClick={() => exec('justifyLeft')} title="Align Left"><AlignLeft className="h-4 w-4" /></TBtn>
        <TBtn onClick={() => exec('justifyCenter')} title="Align Center"><AlignCenter className="h-4 w-4" /></TBtn>
        <TBtn onClick={() => exec('justifyRight')} title="Align Right"><AlignRight className="h-4 w-4" /></TBtn>
        <TBtn onClick={() => exec('justifyFull')} title="Justify"><AlignJustify className="h-4 w-4" /></TBtn>
        <TSep />
        <TBtn onClick={() => exec('insertUnorderedList')} title="Bullet List"><List className="h-4 w-4" /></TBtn>
        <TBtn onClick={() => exec('insertOrderedList')} title="Ordered List"><ListOrdered className="h-4 w-4" /></TBtn>
        <TSep />
        <TBtn onClick={addLink} title="Link"><LinkIcon className="h-4 w-4" /></TBtn>
        <TBtn onClick={addImage} title="Image"><ImageIcon className="h-4 w-4" /></TBtn>
        <TSep />
        <TBtn onClick={() => exec('removeFormat')} title="Clear Formatting"><RemoveFormatting className="h-4 w-4" /></TBtn>
      </div>

      {/* Editable Area */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        className="rich-editor-content overflow-y-auto px-4 py-3 text-sm leading-relaxed text-gray-800 focus:outline-none dark:text-gray-200"
        style={{ minHeight: height - 50, maxHeight: height - 50 }}
      />
    </div>
  );
}

function TBtn({ onClick, title, disabled, children }: {
  onClick: () => void; title: string; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700"
    >
      {children}
    </button>
  );
}

function TSep() {
  return <div className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" />;
}
