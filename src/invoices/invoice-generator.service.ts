import { Injectable } from '@nestjs/common';
import { Order } from '../orders/entities/order.entity';
import PDFDocument from 'pdfkit';

@Injectable()
export class InvoiceGeneratorService {
  async generatePDF(
    order: Order,
    invoiceNumber: string,
    invoiceDate: Date,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('TAX INVOICE', { align: 'center' });
      doc.moveDown();

      // Invoice details
      doc.fontSize(12);
      doc.text(`Invoice Number: ${invoiceNumber}`);
      doc.text(`Invoice Date: ${invoiceDate.toLocaleDateString()}`);
      doc.text(`Order Number: ${order.orderNumber}`);
      doc.moveDown();

      // Clinic details
      doc.fontSize(14).text('Bill To:', { underline: true });
      doc.fontSize(12);
      doc.text(order.clinic.clinicName);
      if (order.clinic.gstin) {
        doc.text(`GSTIN: ${order.clinic.gstin}`);
      }
      doc.text(order.clinic.address);
      doc.text(`${order.clinic.city}, ${order.clinic.state} - ${order.clinic.pincode}`);
      doc.moveDown();

      // Items table
      doc.fontSize(14).text('Items:', { underline: true });
      doc.moveDown(0.5);

      // Table header
      const tableTop = doc.y;
      doc.fontSize(10);
      doc.text('Product', 50, tableTop);
      doc.text('SKU', 200, tableTop);
      doc.text('Qty', 280, tableTop);
      doc.text('Price', 320, tableTop);
      doc.text('GST', 380, tableTop);
      doc.text('Total', 430, tableTop);

      let y = tableTop + 20;
      order.items.forEach((item) => {
        doc.text(item.productName, 50, y);
        doc.text(item.productSku, 200, y);
        doc.text(item.quantity.toString(), 280, y);
        doc.text(`₹${item.unitPrice.toFixed(2)}`, 320, y);
        doc.text(`${item.gstRate}%`, 380, y);
        doc.text(`₹${item.totalAmount.toFixed(2)}`, 430, y);
        y += 20;
      });

      doc.moveDown(2);

      // Totals
      doc.fontSize(12);
      doc.text(`Subtotal: ₹${order.subtotal.toFixed(2)}`, { align: 'right' });
      doc.text(`GST: ₹${order.gstAmount.toFixed(2)}`, { align: 'right' });
      if (order.shippingCharges > 0) {
        doc.text(`Shipping: ₹${order.shippingCharges.toFixed(2)}`, { align: 'right' });
      }
      if (order.platformFee > 0) {
        doc.text(`Platform Fee: ₹${order.platformFee.toFixed(2)}`, { align: 'right' });
      }
      doc.fontSize(14).text(`Total: ₹${order.totalAmount.toFixed(2)}`, { align: 'right' });

      doc.end();
    });
  }
}

