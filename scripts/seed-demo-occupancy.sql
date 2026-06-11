-- ───────────────────────────────────────────────────────────────────────────
-- LOCAL-ONLY demo occupancy dataset for the booking occupancy board.
-- Org: CNS Ayurvedic Hospital (6e82bc9e-4dfb-4192-8cf8-308e0672e20d)
-- "Today" reference: 2026-06-10. All data lives in June 2026 (current month) so
-- it's visible the moment the calendar opens.
--
-- Everything is namespaced under UUID prefix '0de00000-' for trivial cleanup.
-- Re-runnable: it deletes prior demo rows first, so running twice is safe.
--
-- Apply:   psql -U sayedsuhailk -d medilink -f scripts/seed-demo-occupancy.sql
-- Remove:  psql -U sayedsuhailk -d medilink -c "DELETE FROM admissions WHERE id::text LIKE '0de00000-%'; DELETE FROM room_bookings WHERE id::text LIKE '0de00000-%'; DELETE FROM booking_enquiries WHERE id::text LIKE '0de00000-%'; DELETE FROM rooms WHERE id::text LIKE '0de00000-%'; DELETE FROM patients WHERE id::text LIKE '0de00000-%';"
-- ───────────────────────────────────────────────────────────────────────────

BEGIN;

-- Clean any prior demo rows (child → parent order)
DELETE FROM admissions       WHERE id::text LIKE '0de00000-%';
DELETE FROM room_bookings     WHERE id::text LIKE '0de00000-%';
DELETE FROM booking_enquiries WHERE id::text LIKE '0de00000-%';
DELETE FROM rooms             WHERE id::text LIKE '0de00000-%';
DELETE FROM patients          WHERE id::text LIKE '0de00000-%';

-- ── Rooms: 9 across 2 floors, mixed types ──────────────────────────────────
INSERT INTO rooms (id, organisation_id, room_number, floor, type, status, price_per_day, is_active, created_at, updated_at) VALUES
('0de00000-0000-4000-9000-000000000101','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','101','1','PRIVATE','AVAILABLE',2000,true,now(),now()),
('0de00000-0000-4000-9000-000000000102','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','102','1','PRIVATE','AVAILABLE',2000,true,now(),now()),
('0de00000-0000-4000-9000-000000000103','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','103','1','DELUXE','AVAILABLE',3500,true,now(),now()),
('0de00000-0000-4000-9000-000000000104','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','104','1','SUITE','OCCUPIED',6000,true,now(),now()),
('0de00000-0000-4000-9000-000000000105','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','105','1','WARD','OCCUPIED',1200,true,now(),now()),
('0de00000-0000-4000-9000-000000000201','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','201','2','PRIVATE','AVAILABLE',2000,true,now(),now()),
('0de00000-0000-4000-9000-000000000202','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','202','2','DELUXE','OCCUPIED',3500,true,now(),now()),
('0de00000-0000-4000-9000-000000000203','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','203','2','SUITE','AVAILABLE',6000,true,now(),now()),
('0de00000-0000-4000-9000-000000000204','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','204','2','WARD','AVAILABLE',1200,true,now(),now());

-- ── Patients (distinct surnames so bar labels read clearly) ─────────────────
INSERT INTO patients (id, organisation_id, patient_code, first_name, last_name, phone, gender, created_at, updated_at) VALUES
('0de00000-0000-4000-9001-000000000001','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','DEMO-001','Anjali','Nair','9000000001','female',now(),now()),
('0de00000-0000-4000-9001-000000000002','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','DEMO-002','Ravi','Menon','9000000002','male',now(),now()),
('0de00000-0000-4000-9001-000000000003','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','DEMO-003','Suresh','Pillai','9000000003','male',now(),now()),
('0de00000-0000-4000-9001-000000000004','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','DEMO-004','Deepa','Kumar','9000000004','female',now(),now()),
('0de00000-0000-4000-9001-000000000005','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','DEMO-005','Maya','Iyer','9000000005','female',now(),now()),
('0de00000-0000-4000-9001-000000000006','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','DEMO-006','Anil','Das','9000000006','male',now(),now());

-- ── Enquiries (for held-via-enquiry bookings, no patient yet) ───────────────
INSERT INTO booking_enquiries (id, organisation_id, contact_name, phone, channel, status, created_at, updated_at) VALUES
('0de00000-0000-4000-9002-000000000001','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','Lakshmi Warrier','9000000011','PHONE','NEW',now(),now()),
('0de00000-0000-4000-9002-000000000002','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','Gopan Nair','9000000012','WHATSAPP','NEW',now(),now());

-- ── ACTIVE admissions (red bars; occupying now) ─────────────────────────────
-- Room 104: long suite stay with package (label "S28"); frees Jun 20
-- Room 105: long ward stay; frees Jun 28
-- Room 202: short stay; frees FIRST (Jun 12) → answers "which room frees first?"
INSERT INTO admissions (id, organisation_id, patient_id, room_id, package_id, check_in_date, expected_check_out_date, status, created_at, updated_at) VALUES
('0de00000-0000-4000-9003-000000000001','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','0de00000-0000-4000-9001-000000000001','0de00000-0000-4000-9000-000000000104','7b11f153-fcb9-4373-877d-70fed2168dab','2026-06-05 10:00:00','2026-06-20 11:00:00','ACTIVE',now(),now()),
('0de00000-0000-4000-9003-000000000002','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','0de00000-0000-4000-9001-000000000004','0de00000-0000-4000-9000-000000000105',NULL,'2026-06-01 09:00:00','2026-06-28 11:00:00','ACTIVE',now(),now()),
('0de00000-0000-4000-9003-000000000003','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','0de00000-0000-4000-9001-000000000002','0de00000-0000-4000-9000-000000000202',NULL,'2026-06-08 12:00:00','2026-06-12 11:00:00','ACTIVE',now(),now());

-- ── CONFIRMED bookings (solid amber) ────────────────────────────────────────
-- Room 101: back-to-back — Pillai Jun12-16 then Iyer Jun16-19 (same-day handover)
-- Room 203: Das Jun14-21 with package (label "S28")
INSERT INTO room_bookings (id, organisation_id, patient_id, enquiry_id, room_id, package_id, check_in_date, check_out_date, total_price, advance_paid, status, booking_date, created_at, updated_at) VALUES
('0de00000-0000-4000-9004-000000000001','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','0de00000-0000-4000-9001-000000000003',NULL,'0de00000-0000-4000-9000-000000000101',NULL,'2026-06-12','2026-06-16',8000,2000,'CONFIRMED',now(),now(),now()),
('0de00000-0000-4000-9004-000000000002','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','0de00000-0000-4000-9001-000000000005',NULL,'0de00000-0000-4000-9000-000000000101',NULL,'2026-06-16','2026-06-19',6000,1500,'CONFIRMED',now(),now(),now()),
('0de00000-0000-4000-9004-000000000003','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','0de00000-0000-4000-9001-000000000006',NULL,'0de00000-0000-4000-9000-000000000203','7b11f153-fcb9-4373-877d-70fed2168dab','2026-06-14','2026-06-21',42000,10000,'CONFIRMED',now(),now(),now());

-- ── HELD bookings (lighter amber; tentative) ───────────────────────────────
-- Room 102: enquiry-only hold (Warrier) Jun11-14
-- Room 201: patient hold (Menon) Jun18-22
-- Room 103: enquiry-only hold (Gopan) Jun20-25
INSERT INTO room_bookings (id, organisation_id, patient_id, enquiry_id, room_id, package_id, check_in_date, check_out_date, total_price, advance_paid, status, booking_date, created_at, updated_at) VALUES
('0de00000-0000-4000-9005-000000000001','6e82bc9e-4dfb-4192-8cf8-308e0672e20d',NULL,'0de00000-0000-4000-9002-000000000001','0de00000-0000-4000-9000-000000000102',NULL,'2026-06-11','2026-06-14',6000,0,'HELD',now(),now(),now()),
('0de00000-0000-4000-9005-000000000002','6e82bc9e-4dfb-4192-8cf8-308e0672e20d','0de00000-0000-4000-9001-000000000002',NULL,'0de00000-0000-4000-9000-000000000201',NULL,'2026-06-18','2026-06-22',8000,0,'HELD',now(),now(),now()),
('0de00000-0000-4000-9005-000000000003','6e82bc9e-4dfb-4192-8cf8-308e0672e20d',NULL,'0de00000-0000-4000-9002-000000000002','0de00000-0000-4000-9000-000000000103',NULL,'2026-06-20','2026-06-25',17500,0,'HELD',now(),now(),now());

COMMIT;

-- Summary
SELECT 'rooms'      AS kind, count(*) FROM rooms             WHERE id::text LIKE '0de00000-%'
UNION ALL SELECT 'patients',  count(*) FROM patients          WHERE id::text LIKE '0de00000-%'
UNION ALL SELECT 'enquiries', count(*) FROM booking_enquiries WHERE id::text LIKE '0de00000-%'
UNION ALL SELECT 'admissions (ACTIVE)', count(*) FROM admissions WHERE id::text LIKE '0de00000-%'
UNION ALL SELECT 'bookings',  count(*) FROM room_bookings     WHERE id::text LIKE '0de00000-%';
