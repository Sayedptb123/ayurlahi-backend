# API Routes Summary

All routes are prefixed with `/api` (configured in `main.ts`).

## Authentication (`/api/auth`)

| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| POST | `/auth/register` | ❌ | - | Register new user |
| POST | `/auth/login` | ❌ | - | Login and get JWT token |
| GET | `/auth/me` | ✅ | Any | Get current user profile |
| POST | `/auth/refresh` | ✅* | Any | Refresh JWT token (accepts expired tokens) |

*Refresh endpoint uses `JwtRefreshGuard` which accepts expired tokens

## Users (`/api/users`)

| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| GET | `/users` | ✅ | ADMIN, SUPPORT | List all users |
| GET | `/users/:id` | ✅ | ADMIN, SUPPORT | Get user by ID |

## Analytics (`/api/analytics`)

| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| GET | `/analytics/dashboard` | ✅ | ADMIN, SUPPORT | Get dashboard statistics |

## Clinics (`/api/clinics`)

| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| POST | `/clinics` | ✅ | CLINIC | Create clinic profile |
| GET | `/clinics` | ✅ | ADMIN, SUPPORT | List all clinics |
| GET | `/clinics/me` | ✅ | CLINIC | Get current user's clinic |
| GET | `/clinics/:id` | ✅ | Any | Get clinic by ID |
| PATCH | `/clinics/:id` | ✅ | CLINIC, ADMIN | Update clinic (CLINIC can only update own) |
| POST | `/clinics/:id/approve` | ✅ | ADMIN | Approve clinic |
| POST | `/clinics/:id/reject` | ✅ | ADMIN | Reject clinic |
| DELETE | `/clinics/:id` | ✅ | ADMIN | Delete clinic |

## Manufacturers (`/api/manufacturers`)

| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| POST | `/manufacturers` | ✅ | MANUFACTURER | Create manufacturer profile |
| GET | `/manufacturers` | ✅ | ADMIN, SUPPORT | List all manufacturers |
| GET | `/manufacturers/me` | ✅ | MANUFACTURER | Get current user's manufacturer |
| GET | `/manufacturers/:id` | ✅ | Any | Get manufacturer by ID |
| POST | `/manufacturers/:id/approve` | ✅ | ADMIN | Approve manufacturer |
| POST | `/manufacturers/:id/reject` | ✅ | ADMIN | Reject manufacturer |

## Products (`/api/products`)

| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| POST | `/products` | ✅ | MANUFACTURER | Create product |
| GET | `/products` | ❌ | - | List products (public, filter by manufacturerId) |
| GET | `/products/:id` | ❌ | - | Get product by ID (public) |
| PATCH | `/products/:id` | ✅ | MANUFACTURER, ADMIN | Update product |
| DELETE | `/products/:id` | ✅ | MANUFACTURER, ADMIN | Delete product |

## Orders (`/api/orders`)

| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| POST | `/orders` | ✅ | CLINIC | Create order |
| GET | `/orders` | ✅ | Any | List orders (filtered by role) |
| GET | `/orders/:id` | ✅ | Any | Get order by ID |
| PATCH | `/orders/:id/status` | ✅ | ADMIN, SUPPORT, MANUFACTURER | Update order status |
| POST | `/orders/:id/cancel` | ✅ | CLINIC, ADMIN | Cancel order |
| PATCH | `/orders/:orderId/items/:itemId` | ✅ | MANUFACTURER, ADMIN, SUPPORT | Update order item (partial fulfillment) |

## Payments (`/api/payments`)

| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| POST | `/payments/initiate/:orderId` | ✅ | CLINIC | Initiate payment |
| GET | `/payments/:id` | ✅ | Any | Get payment by ID |
| GET | `/payments/order/:orderId` | ✅ | Any | Get payment by order ID |

## Webhooks (`/api/webhooks`)

| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| POST | `/webhooks/razorpay/payment` | ❌ | - | Razorpay payment webhook |
| POST | `/webhooks/whatsapp/incoming` | ❌ | - | WhatsApp incoming message webhook |

## Invoices (`/api/invoices`)

| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| POST | `/invoices/generate/:orderId` | ✅ | ADMIN, SUPPORT | Manually generate invoice |
| GET | `/invoices/:id` | ✅ | Any | Get invoice by ID |
| GET | `/invoices/order/:orderId` | ✅ | Any | Get invoice by order ID |

## Disputes (`/api/disputes`)

| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| POST | `/disputes` | ✅ | CLINIC | Create dispute |
| GET | `/disputes` | ✅ | ADMIN, SUPPORT | List disputes (with status & limit filters) |
| GET | `/disputes/:id` | ✅ | Any | Get dispute by ID |
| POST | `/disputes/:id/resolve` | ✅ | ADMIN, SUPPORT | Resolve dispute |
| POST | `/disputes/:id/comments` | ✅ | Any | Add comment to dispute |

## Refunds (`/api/refunds`)

| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| POST | `/refunds/order/:orderId` | ✅ | CLINIC, ADMIN, SUPPORT | Create refund for order |
| GET | `/refunds` | ✅ | ADMIN, SUPPORT | List all refunds |
| GET | `/refunds/:id` | ✅ | Any | Get refund by ID |
| GET | `/refunds/order/:orderId` | ✅ | Any | Get refunds by order ID |

## App Root (`/api`)

| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| GET | `/` | ❌ | - | Health check / Hello |

---

## Route Ordering Notes

⚠️ **Important**: In NestJS, route order matters. More specific routes should be defined before parameterized routes.

**Correct order examples:**
- ✅ `GET /clinics/me` before `GET /clinics/:id`
- ✅ `GET /manufacturers/me` before `GET /manufacturers/:id`
- ✅ `GET /payments/order/:orderId` before `GET /payments/:id`
- ✅ `GET /invoices/order/:orderId` before `GET /invoices/:id`
- ✅ `GET /refunds/order/:orderId` before `GET /refunds/:id`

All controllers follow this pattern correctly.

---

## Authentication

- **JWT Bearer Token**: Most endpoints require `Authorization: Bearer <token>` header
- **Token Refresh**: Use `/api/auth/refresh` when token expires (accepts expired tokens)
- **Public Endpoints**: Products listing, webhooks, app root

---

## Role-Based Access Control (RBAC)

- **ADMIN**: Full access to all endpoints
- **SUPPORT**: Access to admin functions, disputes, refunds, analytics
- **CLINIC**: Can create orders, disputes, view own data
- **MANUFACTURER**: Can manage products, update order items, view own data

---

## Status Codes

- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., duplicate email)




