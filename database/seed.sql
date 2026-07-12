-- AssetFlow demo data. Paste into Supabase SQL Editor AFTER schema.sql.
-- Logins:  admin@assetflow.com / admin123   |   others / password123

INSERT INTO departments (id, name) VALUES (1, 'IT'), (2, 'Operations');

INSERT INTO users (id, name, email, password_hash, role, department_id) VALUES
  (1, 'Admin',         'admin@assetflow.com',   '$2a$10$wIoFXaCuLL.qV1qRL6VSZONLMjUTa49/mw9CnWqFZ0ykn7NWpt9V2', 'admin',         NULL),
  (2, 'Meera Manager', 'manager@assetflow.com', '$2a$10$atcbY4AczBdO7rYmvumdpOQzCkaG5mfbdmaxaCphIA.IlRkI09.bi', 'asset_manager', 1),
  (3, 'Harish Head',   'head@assetflow.com',    '$2a$10$atcbY4AczBdO7rYmvumdpOQzCkaG5mfbdmaxaCphIA.IlRkI09.bi', 'dept_head',     2),
  (4, 'Priya',         'priya@assetflow.com',   '$2a$10$atcbY4AczBdO7rYmvumdpOQzCkaG5mfbdmaxaCphIA.IlRkI09.bi', 'employee',      1),
  (5, 'Raj',           'raj@assetflow.com',     '$2a$10$atcbY4AczBdO7rYmvumdpOQzCkaG5mfbdmaxaCphIA.IlRkI09.bi', 'employee',      2);

UPDATE departments SET head_id = 3 WHERE id = 2;

INSERT INTO categories (id, name, description, custom_fields) VALUES
  (1, 'Electronics',   'Laptops, monitors, phones', '[{"name":"Warranty (months)","type":"number"}]'),
  (2, 'Meeting Rooms', 'Bookable shared spaces',    '[]'),
  (3, 'Vehicles',      'Company vehicles',          '[]');

INSERT INTO assets (id, asset_tag, name, category_id, serial_number, acquisition_date, acquisition_cost, condition, location, is_bookable, status, created_by) VALUES
  (1, 'AF-0001', 'Dell Latitude 5440', 1, 'SN-DL-2201', '2025-01-15', 85000, 'good', 'HQ Floor 2', false, 'allocated', 2),
  (2, 'AF-0002', 'MacBook Air M3',     1, 'SN-MB-1102', NULL,         NULL,  'new',  'HQ Floor 2', false, 'available', 2),
  (3, 'AF-0003', 'Room B2',            2, NULL,         NULL,         NULL,  'good', 'HQ Floor 1', true,  'available', 2);

-- Priya holds the Dell laptop, due back in 14 days
INSERT INTO allocations (asset_id, employee_id, allocated_by, expected_return_date)
VALUES (1, 4, 2, CURRENT_DATE + 14);

INSERT INTO notifications (user_id, type, message)
VALUES (4, 'asset_assigned', 'Dell Latitude 5440 (AF-0001) has been assigned to you');

INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
VALUES (2, 'allocation.created', 'asset', 1, 'AF-0001 allocated to Priya');

INSERT INTO technicians (id, name, email, phone, specialty) VALUES
  (1, 'Rajesh Kumar', 'rajesh.k@assetflow.com', '+91 98765 43210', 'Electronics & Hardware'),
  (2, 'Sarah Dsouza', 'sarah.d@assetflow.com', '+91 98765 43211', 'IT & Networking'),
  (3, 'Amit Sharma', 'amit.s@assetflow.com', '+91 98765 43212', 'HVAC & Facilities');

-- Explicit IDs above bypass the sequences — resync them so the app's next INSERTs don't collide
SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));
SELECT setval('users_id_seq',       (SELECT MAX(id) FROM users));
SELECT setval('categories_id_seq',  (SELECT MAX(id) FROM categories));
SELECT setval('assets_id_seq',      (SELECT MAX(id) FROM assets));
SELECT setval('technicians_id_seq', (SELECT MAX(id) FROM technicians));
