-- AssetFlow schema. Run via: npm run db:init

DROP TABLE IF EXISTS activity_logs, notifications, audit_records, audit_assignments, audit_cycles,
  maintenance_requests, bookings, transfer_requests, allocations, assets, categories, users, departments CASCADE;

CREATE TABLE departments (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  head_id     INTEGER, -- FK added after users exists
  parent_id   INTEGER REFERENCES departments(id),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  -- Signup always creates 'employee'; only admin promotes (Org Setup > Employee Directory)
  role          TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','asset_manager','dept_head','employee')),
  department_id INTEGER REFERENCES departments(id),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE departments ADD CONSTRAINT fk_dept_head FOREIGN KEY (head_id) REFERENCES users(id);

CREATE TABLE categories (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  description   TEXT,
  custom_fields JSONB NOT NULL DEFAULT '[]', -- e.g. [{"name":"Warranty (months)","type":"number"}]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assets (
  id               SERIAL PRIMARY KEY,
  asset_tag        TEXT NOT NULL UNIQUE,           -- auto-generated AF-0001
  name             TEXT NOT NULL,
  category_id      INTEGER NOT NULL REFERENCES categories(id),
  serial_number    TEXT,
  acquisition_date DATE,
  acquisition_cost NUMERIC(12,2),                  -- reporting only, no accounting
  condition        TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('new','good','fair','poor')),
  location         TEXT,
  image_url        TEXT,
  brand            TEXT,
  model            TEXT,
  vendor           TEXT,
  warranty_expiry  DATE,
  is_bookable      BOOLEAN NOT NULL DEFAULT false, -- shared resource flag
  status           TEXT NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available','allocated','reserved','under_maintenance','lost','retired','disposed')),
  custom_values    JSONB NOT NULL DEFAULT '{}',    -- values for category custom_fields
  created_by       INTEGER REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE allocations (
  id                   SERIAL PRIMARY KEY,
  asset_id             INTEGER NOT NULL REFERENCES assets(id),
  employee_id          INTEGER REFERENCES users(id),
  department_id        INTEGER REFERENCES departments(id),
  allocated_by         INTEGER NOT NULL REFERENCES users(id),
  allocated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return_date DATE,
  returned_at          TIMESTAMPTZ,
  return_notes         TEXT,
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned')),
  CHECK (employee_id IS NOT NULL OR department_id IS NOT NULL)
);
-- Hard guarantee: one active allocation per asset
CREATE UNIQUE INDEX one_active_allocation_per_asset ON allocations(asset_id) WHERE status = 'active';

CREATE TABLE transfer_requests (
  id                 SERIAL PRIMARY KEY,
  asset_id           INTEGER NOT NULL REFERENCES assets(id),
  from_allocation_id INTEGER NOT NULL REFERENCES allocations(id),
  requested_by       INTEGER NOT NULL REFERENCES users(id),
  to_employee_id     INTEGER REFERENCES users(id),
  to_department_id   INTEGER REFERENCES departments(id),
  reason             TEXT,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by         INTEGER REFERENCES users(id),
  decided_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id         SERIAL PRIMARY KEY,
  asset_id   INTEGER NOT NULL REFERENCES assets(id),
  booked_by  INTEGER NOT NULL REFERENCES users(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time   TIMESTAMPTZ NOT NULL,
  purpose    TEXT,
  status     TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','ongoing','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE TABLE maintenance_requests (
  id          SERIAL PRIMARY KEY,
  asset_id    INTEGER NOT NULL REFERENCES assets(id),
  raised_by   INTEGER NOT NULL REFERENCES users(id),
  issue       TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  photo_url   TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected','assigned','in_progress','resolved')),
  technician  TEXT,
  decided_by  INTEGER REFERENCES users(id),
  decided_at  TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_cycles (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  scope_department_id INTEGER REFERENCES departments(id),
  scope_location      TEXT,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by          INTEGER NOT NULL REFERENCES users(id),
  closed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_assignments (
  cycle_id   INTEGER NOT NULL REFERENCES audit_cycles(id),
  auditor_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (cycle_id, auditor_id)
);

CREATE TABLE audit_records (
  id         SERIAL PRIMARY KEY,
  cycle_id   INTEGER NOT NULL REFERENCES audit_cycles(id),
  asset_id   INTEGER NOT NULL REFERENCES assets(id),
  result     TEXT NOT NULL CHECK (result IN ('verified','missing','damaged')),
  notes      TEXT,
  audited_by INTEGER NOT NULL REFERENCES users(id),
  audited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, asset_id)
);

CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL, -- asset_assigned, maintenance_approved, booking_confirmed, transfer_approved, overdue_return, audit_discrepancy...
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activity_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  action      TEXT NOT NULL,       -- e.g. asset.created, allocation.returned
  entity_type TEXT,
  entity_id   INTEGER,
  details     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_bookings_asset_time ON bookings(asset_id, start_time, end_time);
CREATE INDEX idx_notifications_user ON notifications(user_id, read);
CREATE INDEX idx_allocations_asset ON allocations(asset_id);
