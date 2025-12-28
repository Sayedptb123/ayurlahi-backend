-- =====================================================
-- PAYROLL MODULE - Database Migrations
-- =====================================================
-- This migration creates all tables needed for the Payroll module
-- Based on COMPLETE_FEATURES_INCLUDING_SALARY_PAYMENTS.md

-- =====================================================
-- 1. SALARY STRUCTURES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  -- Structure details
  name VARCHAR(255) NOT NULL,
  position VARCHAR(50),
  is_default BOOLEAN DEFAULT false,
  
  -- Salary components
  base_salary DECIMAL(12,2) NOT NULL,
  allowances JSONB DEFAULT '{}',
  deductions JSONB DEFAULT '{}',
  
  -- Calculation
  gross_salary DECIMAL(12,2) NOT NULL,
  total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_salary DECIMAL(12,2) NOT NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_salary_structures_org ON salary_structures(organisation_id) WHERE deleted_at IS NULL;

-- =====================================================
-- 2. STAFF SALARY ASSIGNMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS staff_salary_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  salary_structure_id UUID NOT NULL REFERENCES salary_structures(id) ON DELETE RESTRICT,
  
  -- Assignment
  effective_from DATE NOT NULL,
  effective_to DATE,
  
  -- Custom overrides
  base_salary DECIMAL(12,2),
  allowances JSONB,
  deductions JSONB,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_staff_salary_staff ON staff_salary_assignments(staff_id, is_active);
CREATE INDEX idx_staff_salary_org ON staff_salary_assignments(organisation_id);

-- =====================================================
-- 3. PAYROLLS TABLE (Monthly Salary Processing)
-- =====================================================
CREATE TABLE IF NOT EXISTS payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  
  -- Payroll period
  payroll_month INT NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
  payroll_year INT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
    'draft',
    'pending',
    'approved',
    'processing',
    'completed',
    'cancelled'
  )),
  
  -- Totals
  total_gross_salary DECIMAL(12,2) DEFAULT 0,
  total_deductions DECIMAL(12,2) DEFAULT 0,
  total_net_salary DECIMAL(12,2) DEFAULT 0,
  total_paid DECIMAL(12,2) DEFAULT 0,
  
  -- Approval
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  
  -- Payment
  payment_date DATE,
  payment_method VARCHAR(50),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE UNIQUE INDEX idx_payrolls_unique_period ON payrolls(organisation_id, branch_id, payroll_month, payroll_year) WHERE deleted_at IS NULL;
CREATE INDEX idx_payrolls_org ON payrolls(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payrolls_period ON payrolls(payroll_year, payroll_month);

-- =====================================================
-- 4. PAYROLL ITEMS TABLE (Individual Staff Salaries)
-- =====================================================
CREATE TABLE IF NOT EXISTS payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID NOT NULL REFERENCES payrolls(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  
  -- Salary calculation
  base_salary DECIMAL(12,2) NOT NULL,
  allowances JSONB DEFAULT '{}',
  total_allowances DECIMAL(12,2) DEFAULT 0,
  gross_salary DECIMAL(12,2) NOT NULL,
  
  -- Deductions
  deductions JSONB DEFAULT '{}',
  total_deductions DECIMAL(12,2) DEFAULT 0,
  net_salary DECIMAL(12,2) NOT NULL,
  
  -- Attendance adjustments
  days_worked DECIMAL(4,1),
  days_present DECIMAL(4,1),
  days_absent DECIMAL(4,1),
  days_leave DECIMAL(4,1),
  leave_deduction DECIMAL(12,2) DEFAULT 0,
  
  -- Overtime
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  overtime_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Bonuses/Incentives
  bonuses JSONB DEFAULT '{}',
  total_bonuses DECIMAL(12,2) DEFAULT 0,
  
  -- Final amount
  final_amount DECIMAL(12,2) NOT NULL,
  
  -- Payment
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN (
    'pending',
    'paid',
    'partially_paid',
    'cancelled'
  )),
  paid_amount DECIMAL(12,2) DEFAULT 0,
  payment_date DATE,
  payment_reference VARCHAR(255),
  
  -- Salary slip
  salary_slip_url TEXT,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payroll_items_payroll ON payroll_items(payroll_id);
CREATE INDEX idx_payroll_items_staff ON payroll_items(staff_id);

-- =====================================================
-- 5. SALARY ADVANCES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS salary_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  
  -- Advance details
  advance_amount DECIMAL(12,2) NOT NULL,
  advance_date DATE NOT NULL,
  reason TEXT,
  
  -- Repayment
  repayment_method VARCHAR(50) DEFAULT 'salary_deduction' CHECK (repayment_method IN (
    'salary_deduction',
    'lump_sum',
    'installments'
  )),
  total_installments INT DEFAULT 1,
  installment_amount DECIMAL(12,2),
  months_to_deduct INT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'approved',
    'rejected',
    'disbursed',
    'repaid',
    'partially_repaid'
  )),
  
  -- Repayment tracking
  repaid_amount DECIMAL(12,2) DEFAULT 0,
  remaining_amount DECIMAL(12,2) NOT NULL,
  
  -- Approval
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Payment
  disbursed_by UUID REFERENCES users(id),
  disbursed_at TIMESTAMP,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_salary_advances_org ON salary_advances(organisation_id);
CREATE INDEX idx_salary_advances_staff ON salary_advances(staff_id);

-- =====================================================
-- 6. SALARY ADVANCE REPAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS salary_advance_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id UUID NOT NULL REFERENCES salary_advances(id) ON DELETE CASCADE,
  payroll_item_id UUID REFERENCES payroll_items(id),
  
  -- Repayment
  repayment_amount DECIMAL(12,2) NOT NULL,
  repayment_date DATE NOT NULL,
  repayment_method VARCHAR(50),
  
  -- Reference
  payment_reference VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_salary_advance_repayments_advance ON salary_advance_repayments(advance_id);
CREATE INDEX idx_salary_advance_repayments_payroll ON salary_advance_repayments(payroll_item_id);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Payroll module tables created successfully!';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - salary_structures';
  RAISE NOTICE '  - staff_salary_assignments';
  RAISE NOTICE '  - payrolls';
  RAISE NOTICE '  - payroll_items';
  RAISE NOTICE '  - salary_advances';
  RAISE NOTICE '  - salary_advance_repayments';
END $$;
