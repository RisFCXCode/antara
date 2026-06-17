const PdfPrinter = require('pdfmake');
import { BatikInvoice } from '../src/db/database';

type PdfTheme = 'normal' | 'white';

// Define fonts (using standard fonts provided by pdfmake to avoid Vercel filesystem issues)
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};
PdfPrinter.setFonts(fonts);

export async function generatePdfBuffer(
  invoice: BatikInvoice,
  theme: PdfTheme = 'normal'
): Promise<Buffer> {
  const isDark = theme === 'normal';
  
  const bgColor = isDark ? '#1a1410' : '#ffffff';
  const textColor = isDark ? '#d4cfc9' : '#333333';
  const titleColor = isDark ? '#cfab6d' : '#1a1a2e';
  const goldColor = '#cfab6d';

  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [ 40, 60, 40, 60 ],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: textColor
    },
    background: function() {
      return {
        canvas: [
          {
            type: 'rect',
            x: 0, y: 0, w: 595.28, h: 841.89,
            color: bgColor
          }
        ]
      };
    },
    content: [
      {
        canvas: [
          { type: 'rect', x: 0, y: 0, w: 515, h: 4, color: goldColor }
        ],
        margin: [0, 0, 0, 30]
      },
      {
        columns: [
          {
            width: '*',
            text: [
              { text: 'ANTARA BATIK\n', fontSize: 24, bold: true, color: titleColor },
              { text: 'Antara Studio (NS0322739-K)\n\n', fontSize: 10, color: goldColor },
              { text: 'No. 6, Jalan Wangsa Perdana 1\n53300 Kuala Lumpur\nTel: +6019-988 7272', fontSize: 9, color: textColor }
            ]
          },
          {
            width: 'auto',
            alignment: 'right',
            text: [
              { text: (invoice.status === 'paid' ? 'Receipt' : 'Invoice') + '\n', fontSize: 18, bold: true, color: titleColor },
              { text: `ID: ${invoice.id}\nDate: ${new Date(invoice.created_at).toLocaleDateString()}\nStatus: ${invoice.status.toUpperCase()}`, fontSize: 10 }
            ]
          }
        ]
      },
      { text: '', margin: [0, 20] },
      {
        columns: [
          {
            width: '50%',
            text: [
              { text: 'Billed to (Customer)\n', fontSize: 10, bold: true, color: goldColor },
              { text: `${invoice.customer_name}\n${invoice.customer_phone}`, fontSize: 10 }
            ]
          },
          {
            width: '50%',
            text: [
              { text: 'Payment & Terms\n', fontSize: 10, bold: true, color: goldColor },
              { text: 'Bank Transfer / FPX Direct\nHong Leong Bank: 39501284728\nAntara Studio', fontSize: 10 }
            ]
          }
        ]
      },
      { text: '', margin: [0, 20] },
      {
        table: {
          headerRows: 1,
          widths: [ '*', '15%', '20%', '20%' ],
          body: [
            [ 
              { text: 'Fabric Product', bold: true, color: goldColor }, 
              { text: 'Quantity', bold: true, color: goldColor }, 
              { text: 'Unit Price', bold: true, color: goldColor }, 
              { text: 'Total', bold: true, alignment: 'right', color: goldColor } 
            ],
            ...(invoice.items || []).map(item => [
              { text: item.fabric_type, color: textColor },
              { text: `${item.quantity_meters} m`, color: textColor },
              { text: `RM ${item.price_per_meter}`, color: textColor },
              { text: `RM ${item.total}`, alignment: 'right', color: textColor }
            ])
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => isDark ? '#333333' : '#e0e0e0',
          paddingTop: () => 8,
          paddingBottom: () => 8
        }
      },
      { text: '', margin: [0, 20] },
      {
        columns: [
          {
            width: '*',
            text: [
              { text: 'Notes & Terms\n', bold: true, color: goldColor },
              { text: 'All invoices must be settled in Malaysian Ringgit.', fontSize: 9 }
            ]
          },
          {
            width: '30%',
            text: [
              { text: `Subtotal: RM ${invoice.subtotal?.toFixed(2)}\n`, alignment: 'right' },
              { text: `Discount: - RM ${invoice.discount_amount?.toFixed(2)}\n`, alignment: 'right' },
              { text: `\nTotal: RM ${invoice.total?.toFixed(2)}`, alignment: 'right', bold: true, fontSize: 14, color: titleColor }
            ]
          }
        ]
      }
    ]
  };

  const pdfDoc = PdfPrinter.createPdf(docDefinition);
  return await pdfDoc.getBuffer();
}
