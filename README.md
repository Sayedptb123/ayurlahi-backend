# Ayurlahi Backend

B2B marketplace backend for Ayurvedic medicines built with NestJS, PostgreSQL, and TypeScript.

## Features

- ✅ Complete database schema with all entities
- ✅ Authentication & RBAC (Clinic, Manufacturer, Admin, Support)
- ✅ Clinic & Manufacturer onboarding with approval workflow
- ✅ Product catalog management
- ✅ Order creation from Web & WhatsApp
- ✅ Razorpay payment integration with split payments
- ✅ Invoice generation & S3 storage
- ✅ WhatsApp order ingestion (menu-based)
- ✅ Background jobs with BullMQ
- ✅ Dispute & refund management
- ✅ Comprehensive audit logging
- ✅ Order failure states & recovery flows

## Tech Stack

- **Framework**: NestJS 11
- **Language**: TypeScript
- **Database**: PostgreSQL with TypeORM
- **Queue**: BullMQ with Redis
- **Payments**: Razorpay
- **Storage**: AWS S3
- **Messaging**: WhatsApp Business API (Gupshup/Twilio)

## Getting Started

### Prerequisites

- Node.js 18 LTS
- PostgreSQL 14+
- Redis 6+

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration

5. Run database migrations (TypeORM will auto-sync in development):
```bash
npm run start:dev
```

### Environment Variables

See `.env.example` for all required environment variables.

### Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Key Endpoints

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user

#### Orders
- `POST /orders` - Create order (CLINIC role)
- `GET /orders` - List orders (filtered by role)
- `GET /orders/:id` - Get order details
- `POST /orders/:id/cancel` - Cancel order

#### Payments
- `POST /payments/initiate/:orderId` - Initiate payment
- `GET /payments/:id` - Get payment details

#### Webhooks
- `POST /webhooks/razorpay/payment` - Razorpay payment webhook
- `POST /webhooks/whatsapp/incoming` - WhatsApp incoming message

See `ARCHITECTURE.md` for complete API documentation.

## Database Schema

The database schema includes:

- **Users** - Authentication & user management
- **Clinics** - Clinic profiles with approval workflow
- **Manufacturers** - Manufacturer profiles with commission rates
- **Products** - Product catalog with stock management
- **Orders** - Order management with status tracking
- **OrderItems** - Line items with partial fulfillment support
- **Payments** - Payment records with Razorpay integration
- **Invoices** - Tax invoices stored in S3
- **Subscriptions** - Clinic subscription plans
- **AuditLogs** - Comprehensive audit trail
- **Disputes** - Order dispute management
- **Refunds** - Refund processing with split refunds

## Architecture

See `ARCHITECTURE.md` for detailed architecture documentation including:
- Database schema design
- Module structure
- API endpoints
- Payment flows
- WhatsApp integration
- Background jobs
- Failure scenarios & recovery

## Business Rules

1. **Prepaid Only** - All orders must be prepaid, no credit/postpaid
2. **Platform as Facilitator** - Platform does not store or resell medicines
3. **Direct Shipping** - Manufacturers ship directly to clinics
4. **Data Privacy** - Manufacturers cannot access clinic contact details
5. **Single Source of Truth** - Backend database is authoritative
6. **WhatsApp as Input** - WhatsApp orders create standard Order entities
7. **Full Auditability** - All financial and state changes are logged

## Development

### Code Structure

```
src/
├── auth/              # Authentication & JWT
├── users/             # User management
├── clinics/           # Clinic management
├── manufacturers/     # Manufacturer management
├── products/          # Product catalog
├── orders/            # Order management
├── payments/          # Payment processing
├── invoices/          # Invoice generation
├── subscriptions/     # Subscription management
├── whatsapp/          # WhatsApp integration
├── razorpay/          # Razorpay integration
├── s3/                # AWS S3 service
├── jobs/              # Background jobs
├── audit/             # Audit logging
├── disputes/          # Dispute management
├── refunds/           # Refund processing
└── common/            # Shared utilities
```

### Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Deployment

1. Set `NODE_ENV=production`
2. Set `DB_SSL=true` for production database
3. Configure all environment variables
4. Run migrations:
```bash
npm run build
npm run start:prod
```

## License

UNLICENSED
