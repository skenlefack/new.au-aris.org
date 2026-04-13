'use client';

// Self-hosted TinyMCE wrapper for the Knowledge Management System.
//
// Loads TinyMCE assets from /tinymce (copied to public/ by scripts/copy-tinymce.js)
// so the editor runs entirely without the TinyMCE Cloud — required by the
// AU-IBAR self-hosting policy.
//
// Configured with the standard editing toolbar plus image / file upload via
// the drive-service. Image uploads are streamed through `onImageUpload`.

import { Editor } from '@tinymce/tinymce-react';
import { useRef } from 'react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  height?: number;
  language?: 'en' | 'fr' | 'pt' | 'ar';
  /** Returns the public URL the uploaded image should be embedded with. */
  onImageUpload?: (file: File) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  en: 'en',
  fr: 'fr_FR',
  pt: 'pt_PT',
  ar: 'ar',
};

export function TinyMCEEditor({
  value,
  onChange,
  height = 500,
  language = 'en',
  onImageUpload,
  disabled = false,
  placeholder,
}: Props) {
  const editorRef = useRef<any>(null);

  return (
    <Editor
      tinymceScriptSrc="/tinymce/tinymce.min.js"
      licenseKey="gpl"
      onInit={(_evt, editor) => (editorRef.current = editor)}
      value={value}
      onEditorChange={(content) => onChange(content)}
      disabled={disabled}
      init={{
        height,
        min_height: 500,
        menubar: 'file edit view insert format tools table help',
        language: LANGUAGE_MAP[language] ?? 'en',
        directionality: language === 'ar' ? 'rtl' : 'ltr',
        promotion: false,
        branding: false,
        placeholder,
        plugins: [
          'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
          'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
          'insertdatetime', 'media', 'table', 'help', 'wordcount', 'emoticons',
          'codesample', 'autoresize',
        ],
        toolbar:
          'undo redo | blocks fontfamily fontsize | ' +
          'bold italic underline strikethrough forecolor backcolor | ' +
          'alignleft aligncenter alignright alignjustify | ' +
          'bullist numlist outdent indent | ' +
          'link image media table codesample | ' +
          'removeformat | preview fullscreen code | help',
        content_style:
          'body { font-family: Inter, system-ui, sans-serif; font-size: 14px; line-height: 1.6 } ' +
          'img { max-width: 100%; height: auto } ' +
          'pre { background: #f5f5f5; padding: 12px; border-radius: 6px }',
        // File / image picker — uses the drive-service via onImageUpload
        images_upload_handler: async (blobInfo) => {
          if (!onImageUpload) throw new Error('Image upload not configured');
          const file = new File([blobInfo.blob()], blobInfo.filename(), { type: blobInfo.blob().type });
          return await onImageUpload(file);
        },
        automatic_uploads: true,
        file_picker_types: 'image media',
        paste_data_images: true,
      }}
    />
  );
}
