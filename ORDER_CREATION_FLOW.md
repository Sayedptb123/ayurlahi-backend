# Order Creation Flow for Dropshipper Model

## 🎯 Overview

As a dropshipper, Ayurlahi facilitates orders between clinics and manufacturers without holding inventory. Clinics need a comprehensive product catalog to browse, search, and create orders.

## 📋 Current State

### Existing Endpoints:
- `GET /api/products` - List products (basic, only manufacturerId filter)
- `GET /api/products/:id` - Get product details
- `POST /api/orders` - Create order (requires productId and quantity)

### Current Limitations:
- ❌ No search functionality
- ❌ No category filtering
- ❌ No price range filtering
- ❌ No stock availability filtering
- ❌ No pagination
- ❌ No sorting options
- ❌ Limited product information for clinics

## ✅ Proposed Solution

### Enhanced Product Catalog API

#### 1. **Enhanced Product Listing** (`GET /api/products`)
   - **Search**: By name, SKU, description
   - **Filters**: 
     - Category
     - Manufacturer
     - Price range (min/max)
     - Stock availability (in stock, low stock, out of stock)
     - Active status
   - **Sorting**: Price (low to high, high to low), Name, Stock
   - **Pagination**: Page and limit
   - **Response**: Includes manufacturer info, stock status, pricing

#### 2. **Product Search** (`GET /api/products/search`)
   - Full-text search across name, description, SKU
   - Returns relevant products with relevance scoring

#### 3. **Product Categories** (`GET /api/products/categories`)
   - List all available product categories
   - Count of products per category

#### 4. **Cart/Order Preview** (`POST /api/orders/preview`)
   - Preview order before creation
   - Calculate totals, GST, shipping
   - Validate stock availability
   - Check minimum order quantities

### Order Creation Flow

#### Step 1: Browse Products
```
GET /api/products?page=1&limit=20&category=herbal&inStock=true
```

#### Step 2: Search Products
```
GET /api/products/search?q=ashwagandha&category=herbal
```

#### Step 3: View Product Details
```
GET /api/products/:id
```

#### Step 4: Preview Order
```
POST /api/orders/preview
{
  "items": [
    { "productId": "uuid", "quantity": 10 },
    { "productId": "uuid", "quantity": 5 }
  ]
}
```

#### Step 5: Create Order
```
POST /api/orders
{
  "items": [...],
  "source": "WEB",
  "shippingAddress": "...",
  "notes": "..."
}
```

## 🏗️ Implementation Plan

### Phase 1: Enhanced Product Catalog
1. ✅ Add search functionality
2. ✅ Add filtering (category, price, stock)
3. ✅ Add pagination
4. ✅ Add sorting
5. ✅ Enhance product response with stock status

### Phase 2: Order Preview
1. ✅ Create order preview endpoint
2. ✅ Calculate totals, GST, shipping
3. ✅ Validate stock and minimum quantities

### Phase 3: Frontend Integration
1. Product catalog page with filters
2. Product search page
3. Product detail page
4. Shopping cart
5. Order preview page
6. Order confirmation

## 📊 Data Flow

```
Clinic User
    ↓
Browse/Search Products (GET /api/products)
    ↓
View Product Details (GET /api/products/:id)
    ↓
Add to Cart (Frontend State)
    ↓
Preview Order (POST /api/orders/preview)
    ↓
Create Order (POST /api/orders)
    ↓
Initiate Payment (POST /api/payments/initiate/:orderId)
    ↓
Order Confirmed
```

## 🔍 Key Features

### Product Catalog Features:
- **Search**: Full-text search across product fields
- **Filters**: Category, manufacturer, price, stock
- **Sorting**: Multiple sort options
- **Pagination**: Handle large catalogs
- **Stock Status**: Real-time stock information
- **Pricing**: Clear pricing with GST breakdown

### Order Creation Features:
- **Cart Management**: Frontend cart (or backend cart API)
- **Order Preview**: Calculate totals before order creation
- **Validation**: Stock, minimum quantities, clinic approval
- **Shipping**: Default to clinic address, allow override
- **Notes**: Order-specific notes

## 🎨 Frontend Requirements

### Product Catalog Page:
- Product grid/list view
- Search bar
- Filter sidebar (category, price, manufacturer)
- Sort dropdown
- Pagination controls
- Stock badges (In Stock, Low Stock, Out of Stock)

### Product Detail Page:
- Product images
- Full description
- Specifications
- Pricing (with GST breakdown)
- Stock availability
- Minimum order quantity
- Add to cart button
- Quantity selector

### Shopping Cart:
- List of selected products
- Quantity adjustment
- Remove items
- Subtotal, GST, Total
- Proceed to checkout

### Order Preview:
- Review items
- Shipping address
- Order summary
- Total breakdown
- Create order button

## 🔐 Security & Validation

- ✅ Only approved clinics can create orders
- ✅ Only active products can be ordered
- ✅ Stock validation before order creation
- ✅ Minimum order quantity validation
- ✅ Manufacturer approval check
- ✅ Price validation (prevent price manipulation)

## 📝 Next Steps

1. Implement enhanced product catalog API
2. Add order preview endpoint
3. Update frontend to use new APIs
4. Test order creation flow
5. Add analytics for popular products

