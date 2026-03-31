'use client';

import { useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  height?: number;
}

export function RichTextEditor({ value, onChange, disabled = false, height = 400 }: RichTextEditorProps) {
  const editorRef = useRef<any>(null);

  return (
    <Editor
      tinymceScriptSrc="/tinymce/tinymce.min.js"
      licenseKey="gpl"
      onInit={(_evt, editor) => {
        editorRef.current = editor;
      }}
      value={value}
      onEditorChange={(content) => onChange(content)}
      disabled={disabled}
      init={{
        height,
        menubar: true,
        plugins: [
          'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
          'anchor', 'searchreplace', 'visualblocks', 'code',
          'insertdatetime', 'media', 'table', 'help', 'wordcount',
        ],
        toolbar:
          'undo redo | blocks | bold italic forecolor backcolor | ' +
          'alignleft aligncenter alignright alignjustify | ' +
          'bullist numlist outdent indent | link image | ' +
          'removeformat | help',
        content_style: `
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #374151;
            padding: 8px;
          }
          h3 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
          p { margin-bottom: 0.75rem; }
          a { color: #006B3F; }
        `,
        paste_data_images: true,
        paste_retain_style_properties: 'all',
        paste_word_valid_elements: 'b,strong,i,em,h1,h2,h3,h4,h5,h6,p,ol,ul,li,a[href],img[src|alt|width|height],table,thead,tbody,tr,td,th,br,span,div,blockquote,pre,code,hr,sub,sup,u,s',
        images_upload_handler: (blobInfo: any) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blobInfo.blob());
          });
        },
        promotion: false,
        branding: false,
      }}
    />
  );
}
