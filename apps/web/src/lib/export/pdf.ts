/**
 * Export an HTML element to PDF.
 * Uses dynamic imports for jsPDF and html2canvas to avoid SSR issues.
 */
export async function exportToPdf(
  element: HTMLElement,
  filename: string,
  options?: {
    title?: string;
    orientation?: 'portrait' | 'landscape';
    headerHtml?: string;
    footerHtml?: string;
  },
): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const orientation = options?.orientation ?? 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

  const pageWidth = orientation === 'portrait' ? 210 : 297;
  const pageHeight = orientation === 'portrait' ? 297 : 210;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Render the element to canvas
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  const imgWidth = contentWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // Add title if provided
  let yOffset = margin;
  if (options?.title) {
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(options.title, margin, yOffset + 5);
    yOffset += 12;

    // Subtitle with date
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(128);
    pdf.text(
      `Generated: ${new Date().toLocaleString()}`,
      margin,
      yOffset + 3,
    );
    pdf.setTextColor(0);
    yOffset += 8;
  }

  // Handle multi-page content
  let remainingHeight = imgHeight;
  let sourceY = 0;

  while (remainingHeight > 0) {
    const availableHeight = pageHeight - yOffset - margin;
    const sliceHeight = Math.min(availableHeight, remainingHeight);

    // Create a slice of the canvas
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = (sliceHeight / imgWidth) * canvas.width;
    const ctx = sliceCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceCanvas.height,
        0,
        0,
        sliceCanvas.width,
        sliceCanvas.height,
      );
    }

    const sliceData = sliceCanvas.toDataURL('image/png');
    pdf.addImage(sliceData, 'PNG', margin, yOffset, imgWidth, sliceHeight);

    remainingHeight -= sliceHeight;
    sourceY += sliceCanvas.height;

    if (remainingHeight > 0) {
      pdf.addPage();
      yOffset = margin;
    }
  }

  // Add page numbers
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(128);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, {
      align: 'center',
    });
    // AU-IBAR footer
    pdf.text(
      'AU-IBAR \u2014 ARIS Animal Resources Information System',
      pageWidth / 2,
      pageHeight - 4,
      { align: 'center' },
    );
  }

  pdf.save(`${filename}.pdf`);
}
