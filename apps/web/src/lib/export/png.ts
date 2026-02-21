/**
 * Export a Recharts chart or HTML element to PNG.
 * For Recharts, pass the container element.
 */
export async function exportToPng(
  element: HTMLElement,
  filename: string,
  options?: {
    scale?: number;
    backgroundColor?: string;
  },
): Promise<void> {
  const { default: html2canvas } = await import('html2canvas');

  const canvas = await html2canvas(element, {
    scale: options?.scale ?? 2,
    useCORS: true,
    logging: false,
    backgroundColor: options?.backgroundColor ?? '#ffffff',
  });

  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Convert a Recharts SVG to base64 PNG.
 * The element should be the Recharts ResponsiveContainer or its parent.
 */
export async function chartToBase64(element: HTMLElement): Promise<string> {
  const { default: html2canvas } = await import('html2canvas');

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  return canvas.toDataURL('image/png');
}
