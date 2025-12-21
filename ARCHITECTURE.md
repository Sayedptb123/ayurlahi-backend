# Ayurlahi Backend Architecture

## Overview

Ayurlahi is a B2B marketplace platform for Ayurvedic medicines. The platform facilitates transactions between clinics and manufacturers without storing or reselling products. All orders are prepaid, and the platform earns through commissions and subscriptions.

## Database Schema

### Core Entities

1. **User** - Authentication and user management
   - One-to-one with Clinic or Manufacturer
   - Roles: CLINIC, MANUFACTURER, ADMIN, SUPPORT

2. **Clinic** - Clinic/healthcare provider profiles
   - Requires approval before ordering
   - Contains GSTIN, license, address
   - Contact details are platform-owned (not shared with manufacturers)

3. **Manufacturer** - Medicine manufacturer profiles
   - Requires approval before product listing
   - Commission rate per manufacturer
   - Cannot access clinic contact details

4. **Product** - Medicine catalog
   - Belongs to a manufacturer
   - Stock management
   - GST rates, pricing, specifications

5. **Order** - Order management
   - Can originate from Web or WhatsApp
   - Status: PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED, PAYMENT_FAILED, etc.
   - Contains shipping address (clinic address by default)

6. **OrderItem** - Individual line items
   - Links product to order
   - Tracks quantity, pricing, GST, commission
   - Supports partial fulfillment

7. **Payment** - Payment records
   - Razorpay integration
   - Split payment support
   - Status tracking

8. **Invoice** - Tax invoices
   - Generated after payment capture
   - Stored in S3
   - GST-compliant

9. **Subscription** - Clinic subscriptions
   - Monthly plans
   - Features and limits

10. **AuditLog** - Audit trail
    - All money and state changes
    - User actions
    - Full auditability

11. **Dispute** - Order disputes
    - Quality, delivery, quantity issues
    - Resolution workflow

12. **Refund** - Refund management
    - Full or partial refunds
    - Razorpay integration
    - Split refund handling

## Module Structure

```
src/
├── auth/              # Authentication & JWT
├── users/             # User management
├── clinics/           # Clinic onboarding & management
├── manufacturers/     # Manufacturer onboarding & management
├── products/          # Product catalog
├── orders/            # Order creation & management
├── payments/          # Payment processing
├── invoices/          # Invoice generation & S3 storage
├── subscriptions/     # Subscription management
├── whatsapp/          # WhatsApp order ingestion
├── razorpay/          # Razorpay integration
├── s3/                # AWS S3 service
├── jobs/              # BullMQ background jobs
├── audit/             # Audit logging
├── disputes/          # Dispute management
├── refunds/           # Refund processing
└── common/            # Shared utilities, guards, decorators
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Clinics
- `POST /api/clinics` - Create clinic profile (CLINIC role)
- `GET /api/clinics/me` - Get own clinic (CLINIC role)
- `GET /api/clinics` - List all clinics (ADMIN/SUPPORT)
- `GET /api/clinics/:id` - Get clinic details
- `PATCH /api/clinics/:id` - Update clinic
- `POST /api/clinics/:id/approve` - Approve clinic (ADMIN)
- `POST /api/clinics/:id/reject` - Reject clinic (ADMIN)

### Manufacturers
- `POST /api/manufacturers` - Create manufacturer profile (MANUFACTURER role)
- `GET /api/manufacturers/me` - Get own manufacturer (MANUFACTURER role)
- `GET /api/manufacturers` - List all manufacturers (ADMIN/SUPPORT)
- `GET /api/manufacturers/:id` - Get manufacturer details
- `POST /api/manufacturers/:id/approve` - Approve manufacturer (ADMIN)
- `POST /api/manufacturers/:id/reject` - Reject manufacturer (ADMIN)

### Products
- `POST /api/products` - Create product (MANUFACTURER role)
- `GET /api/products` - List products (filter by manufacturerId)
- `GET /api/products/:id` - Get product details
- `PATCH /api/products/:id` - Update product (MANUFACTURER/ADMIN)
- `DELETE /api/products/:id` - Delete product (MANUFACTURER/ADMIN)

### Orders
- `POST /api/orders` - Create order (CLINIC role)
- `GET /api/orders` - List orders (filtered by role)
- `GET /api/orders/:id` - Get order details
- `PATCH /api/orders/:id/status` - Update order status (ADMIN/SUPPORT/MANUFACTURER)
- `POST /api/orders/:id/cancel` - Cancel order (CLINIC/ADMIN)

### Payments
- `POST /api/payments/initiate/:orderId` - Initiate payment (CLINIC role)
- `GET /api/payments/:id` - Get payment details
- `GET /api/payments/order/:orderId` - Get payment by order

### Webhooks
- `POST /api/webhooks/razorpay/payment` - Razorpay payment webhook
- `POST /api/webhooks/whatsapp/incoming` - WhatsApp incoming message

### Invoices
- `POST /api/invoices/generate/:orderId` - Generate invoice (ADMIN/SUPPORT)
- `GET /api/invoices/:id` - Get invoice
- `GET /api/invoices/order/:orderId` - Get invoice by order

## Payment Flow

1. **Order Creation** - Clinic creates order via Web or WhatsApp
2. **Payment Initiation** - Clinic initiates payment, Razorpay order created
3. **Payment Capture** - Razorpay webhook confirms payment
4. **Order Confirmation** - Order status updated to CONFIRMED
5. **Invoice Generation** - Background job generates invoice, uploads to S3
6. **Split Payment** - Platform commission and manufacturer payments handled

## WhatsApp Order Flow

1. **Menu-Based Interface** - Structured menu sent to clinic
2. **Order Creation** - Clinic sends structured order command
3. **Order Processing** - Standard Order entity created
4. **Confirmation** - WhatsApp confirmation sent
5. **Payment Link** - Payment link sent via WhatsApp

## Background Jobs (BullMQ)

1. **Invoice Generation** - Async invoice PDF generation and S3 upload
2. **Order Status Updates** - Async order status changes
3. **WhatsApp Notifications** - Async WhatsApp message sending

## Failure Scenarios & Recovery

### Payment Failures
- Order status: PAYMENT_FAILED
- Retry mechanism for payment initiation
- Automatic order cancellation after timeout

### Order Failures
- Order status: FAILED
- Stock restoration on cancellation
- Refund processing for failed orders

### Partial Fulfillment
- OrderItem-level status tracking
- Partial refund support
- Order status: PARTIALLY_FULFILLED

### Dispute Handling
- Dispute creation by clinic
- Admin review and resolution
- Refund processing based on resolution

## Security & Compliance

- **RBAC** - Role-based access control enforced at route level
- **Data Privacy** - Clinic contact details not exposed to manufacturers
- **Audit Logging** - All financial and state changes logged
- **Payment Safety** - Razorpay webhook signature verification
- **GST Compliance** - Invoice generation with proper GST handling

## Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=ayurlahi
DB_SSL=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Razorpay
RAZORPAY_KEY_ID=your-key-id
RAZORPAY_KEY_SECRET=your-key-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-south-1
AWS_S3_BUCKET=ayurlahi-invoices

# WhatsApp
WHATSAPP_API_URL=https://api.gupshup.io/sm/api/v1
WHATSAPP_API_KEY=your-api-key
WHATSAPP_SOURCE_NAME=your-source-name

# Application
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
BCRYPT_ROUNDS=10
```

## Key Design Decisions

1. **Prepaid Only** - No credit, no postpaid, no ledger-based settlement
2. **Single Source of Truth** - Backend database is authoritative
3. **WhatsApp as Input Channel** - Orders from WhatsApp create standard Order entities
4. **No Direct Contact** - Manufacturers cannot access clinic contact details
5. **Event-Driven** - Webhooks and async jobs for scalability
6. **Full Auditability** - All changes logged for compliance





