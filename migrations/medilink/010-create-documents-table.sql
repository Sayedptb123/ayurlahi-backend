-- ============================================
-- Phase 4: Document Storage - Documents Table
-- MediLink - A product from Team Ayurlahi
-- ============================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  -- Document ownership
  related_type VARCHAR(50) NOT NULL, -- 'staff', 'patient', 'organisation', 'expense', 'purchase_order', etc.
  related_id UUID NOT NULL, -- ID of the related entity
  
  -- Document details
  name VARCHAR(255) NOT NULL, -- Original filename or document name
  file_name VARCHAR(255) NOT NULL, -- Stored filename
  file_path TEXT NOT NULL, -- Path to file (S3 key or local path)
  file_url TEXT, -- Public URL if available
  file_type VARCHAR(100), -- MIME type (e.g., 'application/pdf', 'image/jpeg')
  file_size BIGINT, -- File size in bytes
  file_extension VARCHAR(10), -- File extension (pdf, jpg, png, etc.)
  
  -- Document category
  category VARCHAR(50), -- 'cv', 'biodata', 'license', 'certificate', 'invoice', 'receipt', 'prescription', etc.
  subcategory VARCHAR(50), -- Optional subcategory
  
  -- Document metadata
  description TEXT,
  tags JSONB, -- Array of tags for searching
  metadata JSONB, -- Additional metadata (dimensions, pages, etc.)
  
  -- Access control
  is_public BOOLEAN DEFAULT false, -- Publicly accessible
  access_level VARCHAR(20) DEFAULT 'private' CHECK (access_level IN (
    'public',   -- Publicly accessible
    'internal', -- Internal to organisation
    'private'   -- Private to owner
  )),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false, -- Verified documents (e.g., licenses)
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,
  
  -- Versioning
  version INT DEFAULT 1, -- Document version
  parent_document_id UUID REFERENCES documents(id), -- For versioning
  
  -- Expiry (for time-sensitive documents)
  expiry_date DATE,
  is_expired BOOLEAN DEFAULT false,
  
  -- Metadata
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_documents_org ON documents(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_related ON documents(related_type, related_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_category ON documents(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_active ON documents(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_expiry ON documents(expiry_date) WHERE is_expired = false AND deleted_at IS NULL;
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE documents IS 'Documents table - stores all documents (CVs, biodata, licenses, invoices, etc.)';
COMMENT ON COLUMN documents.related_type IS 'Type of entity this document belongs to (staff, patient, organisation, etc.)';
COMMENT ON COLUMN documents.related_id IS 'ID of the related entity';
COMMENT ON COLUMN documents.category IS 'Document category (cv, biodata, license, certificate, etc.)';





