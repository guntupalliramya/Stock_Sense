/*
# StockSense Core Schema — Part 1: Reference Tables

## Overview
Creates the foundational tables for the StockSense inventory management system:
profiles, categories, suppliers, warehouses, locations, and products.

## Tables Created
1. profiles — extends auth.users with role, full_name, phone
2. categories — product categories (name, description)
3. suppliers — vendor/supplier records
4. warehouses — top-level warehouse entities
5. locations — specific locations within a warehouse (rack/shelf/zone)
6. products — product master data with SKU, UoM, reorder level
7. stock_levels — current stock quantity per product per location
8. reordering_rules — optional per-product-per-location reorder rules

## Stock Design
Stock is stored in `stock_levels` (product_id + location_id = unique row).
This is the single source of truth for "current stock".
All movements (receipts, deliveries, transfers, adjustments) append to stock_ledger
and update stock_levels via database functions.

## Security
- RLS enabled on all tables.
- All tables scoped to `authenticated` role (app has sign-in).
- profiles: owner can read/update own row; inserts blocked (created via trigger).
- All inventory tables: any authenticated user can CRUD (team-based warehouse app).
*/

-- profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  role text NOT NULL DEFAULT 'inventory_manager' CHECK (role IN ('inventory_manager','warehouse_staff')),
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- categories
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_select" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_insert" ON categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cat_update" ON categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cat_delete" ON categories FOR DELETE TO authenticated USING (true);

-- suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sup_select" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "sup_insert" ON suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sup_update" ON suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sup_delete" ON suppliers FOR DELETE TO authenticated USING (true);

-- warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wh_select" ON warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "wh_insert" ON warehouses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wh_update" ON warehouses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wh_delete" ON warehouses FOR DELETE TO authenticated USING (true);

-- locations
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(warehouse_id, code)
);
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loc_select" ON locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "loc_insert" ON locations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "loc_update" ON locations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "loc_delete" ON locations FOR DELETE TO authenticated USING (true);

-- products
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text NOT NULL UNIQUE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  uom text NOT NULL DEFAULT 'Units',
  description text DEFAULT '',
  reorder_level integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_select" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod_insert" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prod_update" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prod_delete" ON products FOR DELETE TO authenticated USING (true);

-- stock_levels — current stock per product per location
CREATE TABLE IF NOT EXISTS stock_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, location_id)
);
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sl_select" ON stock_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "sl_insert" ON stock_levels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sl_update" ON stock_levels FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sl_delete" ON stock_levels FOR DELETE TO authenticated USING (true);

-- reordering_rules — optional override per product+location
CREATE TABLE IF NOT EXISTS reordering_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  min_quantity numeric NOT NULL DEFAULT 0,
  max_quantity numeric NOT NULL DEFAULT 0,
  UNIQUE(product_id, location_id)
);
ALTER TABLE reordering_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rr_select" ON reordering_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "rr_insert" ON reordering_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rr_update" ON reordering_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rr_delete" ON reordering_rules FOR DELETE TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_stock_product ON stock_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_location ON stock_levels(location_id);
CREATE INDEX IF NOT EXISTS idx_locations_warehouse ON locations(warehouse_id);

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.raw_user_meta_data->>'role','inventory_manager'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS stock_levels_set_updated_at ON stock_levels;
CREATE TRIGGER stock_levels_set_updated_at BEFORE UPDATE ON stock_levels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
