# Clinic Order Creation API - Complete Guide

## 🎯 Overview

This guide explains how clinics can browse products and create orders in the dropshipper model. The system provides a comprehensive product catalog with search, filters, and order preview capabilities.

## 📋 Order Creation Flow

### Step 1: Browse Products

**Endpoint:** `GET /api/products`

**Description:** Enhanced product listing with search, filters, pagination, and sorting.

**Query Parameters:**
- `search` (string, optional) - Search in name, description, SKU
- `category` (string, optional) - Filter by category
- `manufacturerId` (string, optional) - Filter by manufacturer
- `minPrice` (number, optional) - Minimum price filter
- `maxPrice` (number, optional) - Maximum price filter
- `stockStatus` (enum, optional) - `in_stock` | `low_stock` | `out_of_stock`
- `inStock` (boolean, optional) - Simple in-stock filter
- `isActive` (boolean, optional) - Active products only (default: true)
- `sortBy` (enum, optional) - `price_asc` | `price_desc` | `name_asc` | `name_desc` | `stock_asc` | `stock_desc` | `created_desc`
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Items per page (default: 20, max: 100)

**Example Request:**
```http
GET /api/products?search=ashwagandha&category=herbal&inStock=true&sortBy=price_asc&page=1&limit=20
```

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "sku": "ASH-001",
      "name": "Ashwagandha Extract",
      "description": "Premium ashwagandha extract...",
      "category": "herbal",
      "price": 500.00,
      "gstRate": 12,
      "stockQuantity": 150,
      "stockStatus": "in_stock",
      "isInStock": true,
      "unit": "bottle",
      "minOrderQuantity": 1,
      "images": ["https://s3.../image1.jpg"],
      "specifications": {...},
      "manufacturer": {
        "id": "uuid",
        "companyName": "ABC Pharmaceuticals"
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

### Step 2: Search Products

**Endpoint:** `GET /api/products/search`

**Description:** Full-text search across product name, description, and SKU.

**Query Parameters:**
- `q` (string, required) - Search term
- `limit` (number, optional) - Max results (default: 20)

**Example Request:**
```http
GET /api/products/search?q=ashwagandha&limit=10
```

**Success Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "name": "Ashwagandha Extract",
    "sku": "ASH-001",
    "price": 500.00,
    "stockStatus": "in_stock",
    "isInStock": true,
    "manufacturer": {
      "companyName": "ABC Pharmaceuticals"
    }
  }
]
```

---

### Step 3: Get Product Categories

**Endpoint:** `GET /api/products/categories`

**Description:** Get all available product categories with product counts.

**Success Response (200 OK):**
```json
[
  {
    "category": "herbal",
    "count": 45
  },
  {
    "category": "tablets",
    "count": 120
  },
  {
    "category": "syrups",
    "count": 30
  }
]
```

---

### Step 4: View Product Details

**Endpoint:** `GET /api/products/:id`

**Description:** Get detailed information about a specific product.

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "sku": "ASH-001",
  "name": "Ashwagandha Extract",
  "description": "Premium ashwagandha extract...",
  "category": "herbal",
  "price": 500.00,
  "gstRate": 12,
  "stockQuantity": 150,
  "unit": "bottle",
  "minOrderQuantity": 1,
  "images": ["https://s3.../image1.jpg"],
  "specifications": {
    "strength": "500mg",
    "packSize": "60 capsules"
  },
  "manufacturer": {
    "id": "uuid",
    "companyName": "ABC Pharmaceuticals"
  },
  "isActive": true,
  "requiresPrescription": false
}
```

---

### Step 5: Preview Order

**Endpoint:** `POST /api/orders/preview`

**Description:** Preview order before creation. Calculates totals, validates stock, and shows order summary without creating the order.

**Authentication:** Required (Clinic role)

**Request Body:**
```json
{
  "items": [
    {
      "productId": "uuid",
      "quantity": 10,
      "notes": "Urgent order"
    },
    {
      "productId": "uuid",
      "quantity": 5
    }
  ],
  "shippingAddress": "123 Clinic Street",  // Optional, defaults to clinic address
  "shippingCity": "Mumbai",                // Optional
  "shippingState": "Maharashtra",          // Optional
  "shippingPincode": "400001"              // Optional
}
```

**Success Response (200 OK):**
```json
{
  "items": [
    {
      "productId": "uuid",
      "productName": "Ashwagandha Extract",
      "productSku": "ASH-001",
      "manufacturerId": "uuid",
      "manufacturerName": "ABC Pharmaceuticals",
      "quantity": 10,
      "unitPrice": 500.00,
      "unit": "bottle",
      "gstRate": 12,
      "subtotal": 5000.00,
      "gstAmount": 600.00,
      "totalAmount": 5600.00,
      "commissionAmount": 250.00,
      "notes": "Urgent order",
      "stockAvailable": 150,
      "minOrderQuantity": 1
    }
  ],
  "summary": {
    "subtotal": 5000.00,
    "gstAmount": 600.00,
    "shippingCharges": 0.00,
    "platformFee": 0.00,
    "total": 5600.00
  },
  "shipping": {
    "address": "123 Clinic Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  },
  "clinic": {
    "id": "uuid",
    "name": "ABC Clinic",
    "gstin": "27AAAAA0000A1Z5"
  },
  "warnings": [
    "Low stock for Product X. Only 5 units available."
  ],
  "isValid": true
}
```

**Error Response (400 Bad Request):**
```json
{
  "items": [...],
  "summary": {...},
  "errors": [
    "Insufficient stock for Product Y. Available: 3, Requested: 10",
    "Minimum order quantity for Product Z is 5"
  ],
  "warnings": [...],
  "isValid": false
}
```

---

### Step 6: Create Order

**Endpoint:** `POST /api/orders`

**Description:** Create the actual order. This will:
- Validate all items
- Check stock availability
- Create order and order items
- Update product stock
- Generate order number

**Authentication:** Required (Clinic role)

**Request Body:**
```json
{
  "items": [
    {
      "productId": "uuid",
      "quantity": 10,
      "notes": "Urgent order"
    }
  ],
  "source": "WEB",
  "shippingAddress": "123 Clinic Street",
  "shippingCity": "Mumbai",
  "shippingState": "Maharashtra",
  "shippingPincode": "400001",
  "shippingPhone": "+919876543210",
  "shippingContactName": "Dr. John Doe",
  "notes": "Please deliver before 5 PM"
}
```

**Success Response (201 Created):**
```json
{
  "id": "uuid",
  "orderNumber": "AY-2024-000001",
  "clinicId": "uuid",
  "status": "PENDING",
  "subtotal": 5000.00,
  "gstAmount": 600.00,
  "shippingCharges": 0.00,
  "totalAmount": 5600.00,
  "items": [...],
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

## 🔍 Product Catalog Features

### Search & Filter Options

1. **Text Search**
   - Searches in: product name, description, SKU
   - Case-insensitive
   - Partial matching

2. **Category Filter**
   - Filter by product category
   - Use `/api/products/categories` to get available categories

3. **Manufacturer Filter**
   - Filter by manufacturer ID
   - Shows only products from that manufacturer

4. **Price Range**
   - `minPrice`: Minimum price filter
   - `maxPrice`: Maximum price filter

5. **Stock Status**
   - `inStock=true`: Only in-stock products
   - `inStock=false`: Only out-of-stock products
   - `stockStatus=in_stock`: Products with stock > 0
   - `stockStatus=low_stock`: Products with stock 1-10
   - `stockStatus=out_of_stock`: Products with stock = 0

6. **Sorting Options**
   - `price_asc`: Price low to high
   - `price_desc`: Price high to low
   - `name_asc`: Name A-Z
   - `name_desc`: Name Z-A
   - `stock_asc`: Stock low to high
   - `stock_desc`: Stock high to low
   - `created_desc`: Newest first (default)

### Stock Status Indicators

Products include stock status information:
- `stockStatus`: `"in_stock"` | `"low_stock"` | `"out_of_stock"`
- `isInStock`: `true` | `false`
- `stockQuantity`: Actual stock number

---

## 🛒 Frontend Implementation Guide

### Product Catalog Page

```typescript
// 1. Load products with filters
const response = await fetch('/api/products?category=herbal&inStock=true&page=1&limit=20');
const { data, pagination } = await response.json();

// 2. Display products in grid/list
// 3. Show stock status badges
// 4. Add to cart button
```

### Shopping Cart

```typescript
// Frontend cart state
const cart = [
  { productId: 'uuid', quantity: 10 },
  { productId: 'uuid', quantity: 5 }
];

// Preview order before checkout
const preview = await fetch('/api/orders/preview', {
  method: 'POST',
  body: JSON.stringify({ items: cart })
});
```

### Order Creation

```typescript
// 1. Preview order first
const preview = await fetch('/api/orders/preview', {
  method: 'POST',
  body: JSON.stringify({ items: cart })
});

// 2. Show preview to user
// 3. If valid, create order
if (preview.isValid) {
  const order = await fetch('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      items: cart,
      source: 'WEB',
      shippingAddress: '...'
    })
  });
}
```

---

## 📊 Example Workflow

### Complete Order Creation Flow

1. **Browse Products**
   ```
   GET /api/products?category=herbal&page=1&limit=20
   ```

2. **Search for Specific Product**
   ```
   GET /api/products/search?q=ashwagandha
   ```

3. **View Product Details**
   ```
   GET /api/products/:id
   ```

4. **Add to Cart** (Frontend state)

5. **Preview Order**
   ```
   POST /api/orders/preview
   {
     "items": [
       { "productId": "uuid", "quantity": 10 }
     ]
   }
   ```

6. **Create Order**
   ```
   POST /api/orders
   {
     "items": [...],
     "source": "WEB",
     "shippingAddress": "..."
   }
   ```

7. **Initiate Payment**
   ```
   POST /api/payments/initiate/:orderId
   ```

---

## ✅ Validation Rules

### Product Selection:
- ✅ Product must be active
- ✅ Product must have stock
- ✅ Quantity must meet minimum order quantity
- ✅ Manufacturer must be approved

### Order Creation:
- ✅ Clinic must be approved
- ✅ All items must pass validation
- ✅ Stock is reserved when order is created
- ✅ Order number is auto-generated

---

## 🎯 Best Practices

1. **Always Preview First**
   - Use `/api/orders/preview` before creating order
   - Show errors/warnings to user
   - Allow user to fix issues before order creation

2. **Handle Stock Warnings**
   - Show low stock warnings
   - Suggest alternative quantities
   - Update cart if stock changes

3. **Search Optimization**
   - Use search for specific products
   - Use filters for browsing
   - Cache popular searches

4. **Pagination**
   - Load products in pages
   - Use infinite scroll or pagination controls
   - Default to 20 items per page

5. **Error Handling**
   - Check `isValid` in preview response
   - Display errors clearly
   - Allow user to remove invalid items

---

## 🔐 Security

- ✅ Only approved clinics can create orders
- ✅ Only active products are shown
- ✅ Stock validation prevents overselling
- ✅ Price validation prevents manipulation
- ✅ Manufacturer approval check

---

## 📝 Notes

- Products are listed from all approved manufacturers
- Stock is real-time (checked on order creation)
- Order preview doesn't reserve stock
- Actual order creation reserves stock
- Shipping charges can be calculated based on order value/weight (to be implemented)

