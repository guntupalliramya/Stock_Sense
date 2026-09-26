/*
# StockSense Schema — Part 2: Operations & Ledger

## Tables
1. receipts — incoming stock header (supplier, warehouse, status)
2. receipt_items — line items (product, location, quantity)
3. deliveries — outgoing stock header (customer/destination, status)
4. delivery_items — line items
5. transfers — internal transfer header (from/to location)
6. transfer_items — line items
7. adjustments — inventory adjustment header
8. adjustment_items — line items (recorded vs counted)
9. stock_ledger — append-only transaction history
10. notifications — low-stock alerts etc.

## Stock function
`apply_stock_movement(p_product, p_from_loc, p_to_loc, p_qty, p_type, p_ref, p_user)`
- Updates stock_levels for from (decrement) and to (increment) locations.
- Appends a stock_ledger row with previous & updated stock.
- SECURITY DEFINER so it can run from RLS-protected client calls.

## Security
- RLS enabled, authenticated CRUD on all.
*/

-- receipts
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','waiting','ready','done','canceled')),
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rec_select" ON receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "rec_insert" ON receipts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rec_update" ON receipts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rec_delete" ON receipts FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ri_select" ON receipt_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "ri_insert" ON receipt_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ri_update" ON receipt_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ri_delete" ON receipt_items FOR DELETE TO authenticated USING (true);

-- deliveries
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  customer_name text NOT NULL DEFAULT '',
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','waiting','ready','done','canceled')),
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "del_select" ON deliveries FOR SELECT TO authenticated USING (true);
CREATE POLICY "del_insert" ON deliveries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "del_update" ON deliveries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "del_delete" ON deliveries FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS delivery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  picked boolean NOT NULL DEFAULT false,
  packed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "di_select" ON delivery_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "di_insert" ON delivery_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "di_update" ON delivery_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "di_delete" ON delivery_items FOR DELETE TO authenticated USING (true);

-- transfers
CREATE TABLE IF NOT EXISTS transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  from_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  to_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','waiting','ready','done','canceled')),
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tr_select" ON transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "tr_insert" ON transfers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tr_update" ON transfers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tr_delete" ON transfers FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE transfer_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ti_select" ON transfer_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "ti_insert" ON transfer_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ti_update" ON transfer_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ti_delete" ON transfer_items FOR DELETE TO authenticated USING (true);

-- adjustments
CREATE TABLE IF NOT EXISTS adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','waiting','ready','done','canceled')),
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adj_select" ON adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "adj_insert" ON adjustments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "adj_update" ON adjustments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "adj_delete" ON adjustments FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS adjustment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id uuid NOT NULL REFERENCES adjustments(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  recorded_qty numeric NOT NULL DEFAULT 0,
  counted_qty numeric NOT NULL DEFAULT 0,
  difference numeric GENERATED ALWAYS AS (counted_qty - recorded_qty) STORED,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE adjustment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_select" ON adjustment_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_insert" ON adjustment_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ai_update" ON adjustment_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ai_delete" ON adjustment_items FOR DELETE TO authenticated USING (true);

-- stock_ledger — append-only
CREATE TABLE IF NOT EXISTS stock_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  transaction_type text NOT NULL CHECK (transaction_type IN ('receipt','delivery','transfer','adjustment')),
  quantity numeric NOT NULL DEFAULT 0,
  from_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  to_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  previous_stock numeric NOT NULL DEFAULT 0,
  updated_stock numeric NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reference text DEFAULT '',
  status text NOT NULL DEFAULT 'done'
);
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sl_sel" ON stock_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "sl_ins" ON stock_ledger FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ledger_product ON stock_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON stock_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON stock_ledger(created_at DESC);

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'low_stock',
  title text NOT NULL,
  message text NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','error')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "not_select" ON notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "not_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "not_update" ON notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "not_delete" ON notifications FOR DELETE TO authenticated USING (true);

-- triggers for updated_at
DROP TRIGGER IF EXISTS receipts_set_updated_at ON receipts;
CREATE TRIGGER receipts_set_updated_at BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS deliveries_set_updated_at ON deliveries;
CREATE TRIGGER deliveries_set_updated_at BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS transfers_set_updated_at ON transfers;
CREATE TRIGGER transfers_set_updated_at BEFORE UPDATE ON transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS adjustments_set_updated_at ON adjustments;
CREATE TRIGGER adjustments_set_updated_at BEFORE UPDATE ON adjustments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Stock movement function
CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  p_product uuid,
  p_from_loc uuid DEFAULT NULL,
  p_to_loc uuid DEFAULT NULL,
  p_qty numeric DEFAULT 0,
  p_type text DEFAULT 'adjustment',
  p_ref text DEFAULT '',
  p_user uuid DEFAULT NULL,
  p_status text DEFAULT 'done'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_prev numeric;
  v_from_new numeric;
  v_to_prev numeric;
  v_to_new numeric;
BEGIN
  -- FROM location: decrement
  IF p_from_loc IS NOT NULL AND p_qty <> 0 THEN
    SELECT COALESCE(quantity,0) INTO v_from_prev
      FROM stock_levels WHERE product_id=p_product AND location_id=p_from_loc;
    IF v_from_prev IS NULL THEN v_from_prev := 0; END IF;
    IF v_from_prev - p_qty < 0 THEN
      RAISE EXCEPTION 'Insufficient stock at source location. Available: %, Required: %', v_from_prev, p_qty;
    END IF;
    v_from_new := v_from_prev - p_qty;
    INSERT INTO stock_levels (product_id, location_id, quantity)
      VALUES (p_product, p_from_loc, v_from_new)
      ON CONFLICT (product_id, location_id)
      DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now();
    INSERT INTO stock_ledger (product_id, transaction_type, quantity, from_location_id, to_location_id, previous_stock, updated_stock, user_id, reference, status)
      VALUES (p_product, p_type, -p_qty, p_from_loc, p_to_loc, v_from_prev, v_from_new, p_user, p_ref, p_status);
  END IF;

  -- TO location: increment
  IF p_to_loc IS NOT NULL AND p_qty <> 0 THEN
    SELECT COALESCE(quantity,0) INTO v_to_prev
      FROM stock_levels WHERE product_id=p_product AND location_id=p_to_loc;
    IF v_to_prev IS NULL THEN v_to_prev := 0; END IF;
    v_to_new := v_to_prev + p_qty;
    INSERT INTO stock_levels (product_id, location_id, quantity)
      VALUES (p_product, p_to_loc, v_to_new)
      ON CONFLICT (product_id, location_id)
      DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now();
    -- Only add a separate ledger row if from and to are both present (transfer) —
    -- otherwise the single ledger row above already covers receipt/delivery/adjustment.
    IF p_from_loc IS NOT NULL THEN
      INSERT INTO stock_ledger (product_id, transaction_type, quantity, from_location_id, to_location_id, previous_stock, updated_stock, user_id, reference, status)
        VALUES (p_product, p_type, p_qty, p_from_loc, p_to_loc, v_to_prev, v_to_new, p_user, p_ref, p_status);
    ELSE
      INSERT INTO stock_ledger (product_id, transaction_type, quantity, from_location_id, to_location_id, previous_stock, updated_stock, user_id, reference, status)
        VALUES (p_product, p_type, p_qty, NULL, p_to_loc, v_to_prev, v_to_new, p_user, p_ref, p_status);
    END IF;
  END IF;
END;
$$;

-- Dashboard stats function
CREATE OR REPLACE FUNCTION public.dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_products', (SELECT count(*) FROM products WHERE is_active=true),
    'total_stock_units', (SELECT COALESCE(sum(quantity),0) FROM stock_levels),
    'low_stock_count', (
      SELECT count(DISTINCT p.id) FROM products p
      JOIN stock_levels sl ON sl.product_id = p.id
      WHERE p.is_active=true AND sl.quantity > 0 AND sl.quantity <= p.reorder_level
    ),
    'out_of_stock_count', (
      SELECT count(DISTINCT p.id) FROM products p
      WHERE p.is_active=true AND p.id NOT IN (SELECT product_id FROM stock_levels WHERE quantity > 0)
    ),
    'pending_receipts', (SELECT count(*) FROM receipts WHERE status IN ('draft','waiting','ready')),
    'pending_deliveries', (SELECT count(*) FROM deliveries WHERE status IN ('draft','waiting','ready')),
    'pending_transfers', (SELECT count(*) FROM transfers WHERE status IN ('draft','waiting','ready'))
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_stock_movement(uuid,uuid,uuid,numeric,text,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_stats() TO authenticated;
