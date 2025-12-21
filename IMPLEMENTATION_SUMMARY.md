# Implementation Summary

## Overview

This document summarizes the complete backend architecture implementation for Ayurlahi, a B2B marketplace platform for Ayurvedic medicines.

## Database Schema (PostgreSQL)

### Core Tables

1. **users** - User authentication and profiles
   - One-to-one relationship with Clinic or Manufacturer
   - Roles: CLINIC, MANUFACTURER, ADMIN, SUPPORT
   - JWT-based authentication

2. **clinics** - Clinic/healthcare provider profiles
   - Approval workflow (pending → approved/rejected)
   - GSTIN, license number, address
   - Contact details are platform-owned (not shared with manufacturers)

3. **manufacturers** - Medicine manufacturer profiles
   - Approval workflow
   - Commission rate per manufacturer
   - Cannot access clinic contact details

4. **products** - Medicine catalog
   - Stock management
   - GST rates, pricing, specifications
   - Batch numbers, expiry dates

5. **orders** - Order management
   - Source: WEB or WHATSAPP
   - Status tracking with failure states
   - Shipping address management

6. **order_items** - Line items
   - Individual item status for partial fulfillment
   - Commission calculation per item
   - Quantity tracking (shipped, delivered)

7. **payments** - Payment records
   - Razorpay integration
   - Split payment details
   - Status: PENDING, INITIATED, CAPTURED, FAILED, REFUNDED

8. **invoices** - Tax invoices
   - Generated after payment capture
   - S3 storage with pre-signed URLs
   - GST-compliant structure

9. **subscriptions** - Clinic subscription plans
   - Monthly plans with features
   - Status tracking

10. **audit_logs** - Comprehensive audit trail
    - All financial and state changes
    - User actions
    - Full auditability for compliance

11. **disputes** - Order dispute management
    - Types: quality, delivery, wrong item, etc.
    - Resolution workflow
    - Evidence storage

12. **refunds** - Refund processing
    - Full or partial refunds
    - Split refund handling
    - Razorpay integration

## NestJS Module Structure

### Core Modules

- **auth/** - JWT authentication, login, registration
- **users/** - User management
- **clinics/** - Clinic onboarding and management
- **manufacturers/** - Manufacturer onboarding and management
- **products/** - Product catalog management
- **orders/** - Order creation and management
- **payments/** - Payment processing with Razorpay
- **invoices/** - Invoice generation and S3 storage
- **subscriptions/** - Subscription management
- **whatsapp/** - WhatsApp order ingestion
- **razorpay/** - Razorpay service integration
- **s3/** - AWS S3 file storage
- **jobs/** - BullMQ background jobs
- **audit/** - Audit logging service
- **disputes/** - Dispute management
- **refunds/** - Refund processing

### Common Utilities

- **common/decorators/** - @Roles, @CurrentUser decorators
- **common/guards/** - JWT auth guard, roles guard
- **common/filters/** - HTTP exception filter
- **common/interceptors/** - Logging interceptor
- **common/pipes/** - Validation pipe
- **common/enums/** - All enums (OrderStatus, PaymentStatus, etc.)
- **common/config/** - Database and Redis configuration

## REST API Design

### Authentication & Authorization

- JWT-based authentication
- Role-based access control (RBAC)
- Guards protect routes based on user roles
- Current user available via @CurrentUser decorator

### Key API Endpoints

#### Clinics
- `POST /api/clinics` - Create clinic profile (CLINIC role)
- `GET /api/clinics/me` - Get own clinic
- `POST /api/clinics/:id/approve` - Approve clinic (ADMIN)

#### Manufacturers
- `POST /api/manufacturers` - Create manufacturer profile
- `GET /api/manufacturers/me` - Get own manufacturer
- `POST /api/manufacturers/:id/approve` - Approve manufacturer (ADMIN)

#### Products
- `POST /api/products` - Create product (MANUFACTURER)
- `GET /api/products` - List products (filtered)
- `PATCH /api/products/:id` - Update product

#### Orders
- `POST /api/orders` - Create order (CLINIC)
- `GET /api/orders` - List orders (role-filtered)
- `POST /api/orders/:id/cancel` - Cancel order

#### Payments
- `POST /api/payments/initiate/:orderId` - Initiate payment
- `GET /api/payments/:id` - Get payment details

#### Webhooks
- `POST /api/webhooks/razorpay/payment` - Razorpay webhook
- `POST /api/webhooks/whatsapp/incoming` - WhatsApp webhook

## Razorpay Integration

### Features

1. **Payment Creation**
   - Razorpay order creation
   - Amount in paise (Indian currency)
   - Receipt and notes

2. **Split Payments**
   - Platform commission
   - Manufacturer payments
   - Automatic split calculation

3. **Webhook Verification**
   - Signature verification
   - Payment capture handling
   - Payment failure handling

4. **Refunds**
   - Full and partial refunds
   - Split refund handling
   - Status tracking

## WhatsApp Integration

### Menu-Based Ordering

1. **Structured Menu**
   - Numbered options
   - Clear navigation
   - No free-text ordering

2. **Order Flow**
   - Menu → Product selection → Order creation
   - Standard Order entity created
   - WhatsApp confirmation sent

3. **Webhook Handler**
   - Incoming message processing
   - Clinic identification by WhatsApp number
   - Order creation via standard API

## Invoice Generation

### Process

1. **Trigger**: After payment capture
2. **Generation**: PDF using PDFKit
3. **Storage**: Upload to S3
4. **Access**: Pre-signed URLs (1 hour expiry)

### Invoice Contents

- Invoice number and date
- Clinic details (GSTIN if available)
- Itemized list with GST
- Totals (subtotal, GST, shipping, platform fee)
- GST-compliant format

## Background Jobs (BullMQ)

### Queues

1. **invoice-generation**
   - Async invoice PDF generation
   - S3 upload
   - Triggered after payment capture

2. **order-status-update**
   - Async order status changes
   - Manufacturer updates
   - System updates

3. **whatsapp-notification**
   - Async WhatsApp message sending
   - Order confirmations
   - Status updates

## Failure Scenarios & Recovery

### Payment Failures

- **Status**: PAYMENT_FAILED
- **Recovery**: Retry payment initiation
- **Timeout**: Automatic order cancellation

### Order Failures

- **Status**: FAILED
- **Recovery**: Stock restoration
- **Refund**: Automatic refund processing

### Partial Fulfillment

- **OrderItem Status**: Individual item tracking
- **Order Status**: PARTIALLY_FULFILLED
- **Refund**: Partial refund support

### Dispute Handling

1. **Creation**: Clinic creates dispute
2. **Review**: Admin reviews with evidence
3. **Resolution**: Resolution with refund if needed
4. **Status**: OPEN → IN_REVIEW → RESOLVED

## Security & Compliance

### RBAC Implementation

- Route-level role protection
- Guards enforce access control
- Clinic data privacy (not shared with manufacturers)

### Audit Logging

- All financial transactions logged
- Order state changes tracked
- User actions recorded
- Full audit trail for compliance

### Payment Safety

- Razorpay webhook signature verification
- Secure payment processing
- Refund safety checks

### GST Compliance

- Invoice generation with GST
- HSN code support
- GST-compliant structure

## Key Design Decisions

1. **Prepaid Only**: No credit, no postpaid, no ledger-based settlement
2. **Single Source of Truth**: Backend database is authoritative
3. **WhatsApp as Input**: Orders from WhatsApp create standard Order entities
4. **No Direct Contact**: Manufacturers cannot access clinic contact details
5. **Event-Driven**: Webhooks and async jobs for scalability
6. **Full Auditability**: All changes logged for compliance
7. **Menu-Based WhatsApp**: Structured ordering, no free-text

## Next Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Update all required variables

3. **Database Setup**
   - Create PostgreSQL database
   - TypeORM will auto-sync in development

4. **Redis Setup**
   - Start Redis server
   - Configure connection in `.env`

5. **Run Application**
   ```bash
   npm run start:dev
   ```

6. **Test Endpoints**
   - Use Postman or similar tool
   - Test authentication flow
   - Test order creation
   - Test payment flow

## Notes

- All entities use UUID primary keys
- Soft deletes implemented (deletedAt column)
- Timestamps: createdAt, updatedAt
- TypeORM relations properly configured
- DTOs with class-validator for input validation
- Error handling with proper HTTP status codes
- Comprehensive logging for debugging





