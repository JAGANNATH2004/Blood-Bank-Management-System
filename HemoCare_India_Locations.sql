-- ==============================================================================
-- HEMOCARE OS - Production Supabase PostgreSQL Schema
-- Run this in your Supabase SQL Editor: Dashboard > SQL Editor > New Query
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Table: blood_centers
-- Dedicated database table for Blood Bank & Hospital Centers to register and login
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blood_centers (
    id TEXT PRIMARY KEY, -- e.g. 'CTR-APOLLO-01' or unique center code
    center_code TEXT UNIQUE NOT NULL,
    center_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT,
    address TEXT NOT NULL,
    license_number TEXT,
    contact_person TEXT,
    category TEXT DEFAULT 'Blood Bank & Component Center',
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Verified', 'Suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Backward-compatibility view alias
CREATE OR REPLACE VIEW public.centers AS SELECT * FROM public.blood_centers;

-- ------------------------------------------------------------------------------
-- 2. Table: user_profiles
-- Stores registered users (Donors / General Public / Center Officers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('donor', 'center_staff', 'admin')),
    phone TEXT,
    blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    city TEXT,
    center_name TEXT, -- only for center_staff
    center_code TEXT, -- linked center code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. Table: blood_inventory
-- Tracks individual blood units in cold chain storage per center
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blood_inventory (
    id TEXT PRIMARY KEY, -- e.g. 'BLD-2026-091'
    blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    component TEXT NOT NULL CHECK (component IN ('Whole Blood', 'Red Blood Cells', 'Platelets', 'Fresh Frozen Plasma')),
    volume_ml INTEGER NOT NULL DEFAULT 450,
    donor_name TEXT,
    donor_id TEXT,
    collected_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL,
    storage_location TEXT NOT NULL DEFAULT 'Refrigerated Bay 1',
    center_code TEXT DEFAULT 'DEFAULT',
    status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Reserved', 'Quarantined', 'Dispatched', 'Expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. Table: donors
-- Clinical registry of qualified voluntary donors
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.donors (
    id TEXT PRIMARY KEY, -- e.g. 'DNR-1001'
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 18 AND age <= 65),
    gender TEXT NOT NULL,
    blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    phone TEXT NOT NULL,
    email TEXT,
    city TEXT NOT NULL,
    address TEXT,
    weight_kg NUMERIC(5, 2) NOT NULL CHECK (weight_kg >= 50.0),
    hemoglobin NUMERIC(4, 1) DEFAULT 14.0,
    total_donations INTEGER DEFAULT 0,
    last_donated DATE,
    status TEXT NOT NULL DEFAULT 'Eligible' CHECK (status IN ('Eligible', 'Cooldown', 'Deferred')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 5. Table: blood_requests
-- Hospital requisitions and emergency patient requirements
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blood_requests (
    id TEXT PRIMARY KEY, -- e.g. 'REQ-8901'
    patient_name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    hospital TEXT NOT NULL,
    department TEXT DEFAULT 'Emergency Care',
    blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    component TEXT DEFAULT 'Whole Blood',
    units_needed INTEGER NOT NULL DEFAULT 1 CHECK (units_needed > 0),
    urgency TEXT NOT NULL DEFAULT 'NORMAL' CHECK (urgency IN ('CRITICAL', 'URGENT', 'NORMAL')),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Dispatched', 'Rejected')),
    doctor TEXT,
    notes TEXT,
    requester_email TEXT,
    center_code TEXT DEFAULT 'DEFAULT',
    dispatched_units TEXT[],
    dispatched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 6. Table: donation_camps
-- Scheduled voluntary donation drives & mobile collection vans
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.donation_camps (
    id TEXT PRIMARY KEY, -- e.g. 'CMP-401'
    name TEXT NOT NULL,
    organizer TEXT NOT NULL,
    venue TEXT NOT NULL,
    date DATE NOT NULL,
    time TEXT DEFAULT '09:00 AM - 04:00 PM',
    target_units INTEGER DEFAULT 100,
    registered_donors INTEGER DEFAULT 0,
    collected_units INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Upcoming' CHECK (status IN ('Upcoming', 'Ongoing', 'Completed')),
    contact_person TEXT,
    contact_phone TEXT,
    center_code TEXT DEFAULT 'DEFAULT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 7. Stored Procedure: Dynamic Per-Center Dedicated Table Provisioning
-- Allows optional isolated database table per center
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_center_tables(center_code_param TEXT)
RETURNS void AS $$
DECLARE
    clean_code TEXT;
BEGIN
    clean_code := lower(regexp_replace(center_code_param, '[^a-zA-Z0-9]', '_', 'g'));
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS public.center_%s_inventory (
            id TEXT PRIMARY KEY,
            blood_group TEXT NOT NULL CHECK (blood_group IN (''A+'', ''A-'', ''B+'', ''B-'', ''AB+'', ''AB-'', ''O+'', ''O-'')),
            component TEXT NOT NULL,
            volume_ml INTEGER NOT NULL DEFAULT 450,
            donor_name TEXT,
            donor_id TEXT,
            collected_date DATE NOT NULL DEFAULT CURRENT_DATE,
            expiry_date DATE NOT NULL,
            storage_location TEXT NOT NULL DEFAULT ''Refrigerated Bay 1'',
            status TEXT NOT NULL DEFAULT ''Available'' CHECK (status IN (''Available'', ''Reserved'', ''Quarantined'', ''Dispatched'', ''Expired'')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(''utc''::text, now()) NOT NULL
        );
        ALTER TABLE public.center_%s_inventory ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow public access to center_%s_inventory" ON public.center_%s_inventory;
        CREATE POLICY "Allow public access to center_%s_inventory" ON public.center_%s_inventory FOR ALL USING (true);
    ', clean_code, clean_code, clean_code, clean_code, clean_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- Enable Row Level Security (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.blood_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_camps ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS Policies (Idempotent: Drop if exists before creating)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access to centers" ON public.blood_centers;
CREATE POLICY "Allow public read access to centers" ON public.blood_centers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert/update to centers" ON public.blood_centers;
CREATE POLICY "Allow public insert/update to centers" ON public.blood_centers FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read access to inventory" ON public.blood_inventory;
CREATE POLICY "Allow public read access to inventory" ON public.blood_inventory FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert/update to inventory" ON public.blood_inventory;
CREATE POLICY "Allow public insert/update to inventory" ON public.blood_inventory FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read access to donors" ON public.donors;
CREATE POLICY "Allow public read access to donors" ON public.donors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert/update to donors" ON public.donors;
CREATE POLICY "Allow public insert/update to donors" ON public.donors FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read access to requests" ON public.blood_requests;
CREATE POLICY "Allow public read access to requests" ON public.blood_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert/update to requests" ON public.blood_requests;
CREATE POLICY "Allow public insert/update to requests" ON public.blood_requests FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read access to camps" ON public.donation_camps;
CREATE POLICY "Allow public read access to camps" ON public.donation_camps FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert/update to camps" ON public.donation_camps;
CREATE POLICY "Allow public insert/update to camps" ON public.donation_camps FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public access to user profiles" ON public.user_profiles;
CREATE POLICY "Allow public access to user profiles" ON public.user_profiles FOR ALL USING (true);

-- ------------------------------------------------------------------------------
-- 8. Table: donor_appointments
-- Booking slots for voluntary donors at certified blood bank centers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.donor_appointments (
    id TEXT PRIMARY KEY, -- e.g. 'APT-7492'
    donor_id TEXT, -- linked donor record id
    donor_name TEXT NOT NULL,
    donor_email TEXT,
    donor_phone TEXT NOT NULL,
    blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    center_code TEXT NOT NULL, -- linked center code
    center_name TEXT NOT NULL,
    appointment_date DATE NOT NULL,
    time_slot TEXT NOT NULL, -- e.g. '10:00 AM - 11:00 AM'
    donation_type TEXT NOT NULL DEFAULT 'Whole Blood', -- 'Whole Blood', 'Platelets (Apheresis)', 'Plasma', 'Red Blood Cells'
    status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Confirmed', 'Completed', 'Cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.donor_appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access to donor_appointments" ON public.donor_appointments;
CREATE POLICY "Allow public access to donor_appointments" ON public.donor_appointments FOR ALL USING (true);

