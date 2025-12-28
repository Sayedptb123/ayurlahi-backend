-- Purchase & Inventory Management Schema

-- 1. Suppliers Table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  tax_id VARCHAR(100), -- GSTIN/VAT
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(organisation_id, name)
);

CREATE INDEX idx_suppliers_org ON suppliers(organisation_id);

-- 2. Inventory Items Table
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  description TEXT,
  category VARCHAR(100), -- 'medicine', 'consumable', 'equipment'
  unit VARCHAR(50) NOT NULL, -- 'strip', 'box', 'piece'
  
  -- Stock
  current_stock INT DEFAULT 0,
  min_stock_level INT DEFAULT 10, -- Reorder point
  
  -- Price
  unit_price DECIMAL(10,2), -- Selling price
  cost_price DECIMAL(10,2), -- Last purchase price
  
  -- Tracking
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(organisation_id, name),
  UNIQUE(organisation_id, sku)
);

CREATE INDEX idx_inventory_org ON inventory_items(organisation_id);
CREATE INDEX idx_inventory_category ON inventory_items(organisation_id, category);

-- 3. Purchase Orders Table
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  
  po_number VARCHAR(50) NOT NULL, -- "PO-2024-001"
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'received', 'cancelled')),
  
  total_amount DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(organisation_id, po_number)
);

CREATE INDEX idx_po_org ON purchase_orders(organisation_id);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON purchase_orders(status);

-- 4. Purchase Order Items Table
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory_items(id), -- Optional, allows ad-hoc items
  
  item_name VARCHAR(255) NOT NULL, -- Snapshot
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL, -- Snapshot cost
  total_price DECIMAL(12,2) NOT NULL,
  
  received_quantity INT DEFAULT 0
);

CREATE INDEX idx_po_items_po ON purchase_order_items(purchase_order_id);
