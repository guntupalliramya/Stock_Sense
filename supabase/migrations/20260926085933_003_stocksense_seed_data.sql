/*
# StockSense — Part 3: Seed Data & Validation Helpers (fixed)
*/
DO $$
DECLARE
  wh1 uuid; wh2 uuid; loc1a uuid; loc1b uuid; loc2a uuid; loc2b uuid;
  cat1 uuid; cat2 uuid; cat3 uuid; cat4 uuid; cat5 uuid;
  sup1 uuid; sup2 uuid; sup3 uuid; sup4 uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid; p7 uuid;
BEGIN
  INSERT INTO warehouses (id, name, code, address) VALUES
    ('11111111-1111-1111-1111-111111111111','Main Warehouse','WH-001','123 Industrial Ave')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO warehouses (id, name, code, address) VALUES
    ('22222222-2222-2222-2222-222222222222','Warehouse 2','WH-002','456 Logistics Blvd')
  ON CONFLICT (code) DO NOTHING;
  SELECT id INTO wh1 FROM warehouses WHERE code='WH-001';
  SELECT id INTO wh2 FROM warehouses WHERE code='WH-002';

  INSERT INTO locations (id, warehouse_id, name, code) VALUES
    ('11111111-1111-1111-1111-aaaaaaaaaaaa', wh1, 'Rack A','WH1-RA')
  ON CONFLICT (warehouse_id, code) DO NOTHING;
  INSERT INTO locations (id, warehouse_id, name, code) VALUES
    ('11111111-1111-1111-1111-bbbbbbbbbbbb', wh1, 'Rack B','WH1-RB')
  ON CONFLICT (warehouse_id, code) DO NOTHING;
  INSERT INTO locations (id, warehouse_id, name, code) VALUES
    ('22222222-2222-2222-2222-aaaaaaaaaaaa', wh2, 'Rack A','WH2-RA')
  ON CONFLICT (warehouse_id, code) DO NOTHING;
  INSERT INTO locations (id, warehouse_id, name, code) VALUES
    ('22222222-2222-2222-2222-bbbbbbbbbbbb', wh2, 'Rack B','WH2-RB')
  ON CONFLICT (warehouse_id, code) DO NOTHING;
  SELECT id INTO loc1a FROM locations WHERE warehouse_id=wh1 AND code='WH1-RA';
  SELECT id INTO loc1b FROM locations WHERE warehouse_id=wh1 AND code='WH1-RB';
  SELECT id INTO loc2a FROM locations WHERE warehouse_id=wh2 AND code='WH2-RA';
  SELECT id INTO loc2b FROM locations WHERE warehouse_id=wh2 AND code='WH2-RB';

  INSERT INTO categories (id, name, description) VALUES
    ('33333333-1111-1111-1111-111111111111','Construction','Construction materials') ON CONFLICT (name) DO NOTHING;
  INSERT INTO categories (id, name, description) VALUES
    ('33333333-2222-2222-2222-222222222222','Office Furniture','Furniture for offices') ON CONFLICT (name) DO NOTHING;
  INSERT INTO categories (id, name, description) VALUES
    ('33333333-3333-3333-3333-333333333333','Electronics','IT and electronics') ON CONFLICT (name) DO NOTHING;
  INSERT INTO categories (id, name, description) VALUES
    ('33333333-4444-4444-4444-444444444444','Safety Equipment','PPE and safety gear') ON CONFLICT (name) DO NOTHING;
  INSERT INTO categories (id, name, description) VALUES
    ('33333333-5555-5555-5555-555555555555','Office Supplies','General supplies') ON CONFLICT (name) DO NOTHING;
  SELECT id INTO cat1 FROM categories WHERE name='Construction';
  SELECT id INTO cat2 FROM categories WHERE name='Office Furniture';
  SELECT id INTO cat3 FROM categories WHERE name='Electronics';
  SELECT id INTO cat4 FROM categories WHERE name='Safety Equipment';
  SELECT id INTO cat5 FROM categories WHERE name='Office Supplies';

  INSERT INTO suppliers (id, name, email, phone, address) VALUES
    ('44444444-1111-1111-1111-111111111111','SteelCo Supplies','sales@steelco.com','555-0101','Steel City')
  ON CONFLICT DO NOTHING;
  INSERT INTO suppliers (id, name, email, phone, address) VALUES
    ('44444444-2222-2222-2222-222222222222','Office World','info@officeworld.com','555-0102','Furniture District')
  ON CONFLICT DO NOTHING;
  INSERT INTO suppliers (id, name, email, phone, address) VALUES
    ('44444444-3333-3333-3333-333333333333','TechDistributors','orders@techdist.com','555-0103','Tech Park')
  ON CONFLICT DO NOTHING;
  INSERT INTO suppliers (id, name, email, phone, address) VALUES
    ('44444444-4444-4444-4444-444444444444','SafeGuard PPE','contact@safeguard.com','555-0104','Safety Town')
  ON CONFLICT DO NOTHING;
  SELECT id INTO sup1 FROM suppliers WHERE name='SteelCo Supplies';
  SELECT id INTO sup2 FROM suppliers WHERE name='Office World';
  SELECT id INTO sup3 FROM suppliers WHERE name='TechDistributors';
  SELECT id INTO sup4 FROM suppliers WHERE name='SafeGuard PPE';

  INSERT INTO products (id, name, sku, category_id, uom, description, reorder_level) VALUES
    ('55555555-1111-1111-1111-111111111111','Steel Rods','SKU-001', cat1, 'Pieces','10mm reinforced steel rods', 10)
  ON CONFLICT (sku) DO NOTHING;
  INSERT INTO products (id, name, sku, category_id, uom, description, reorder_level) VALUES
    ('55555555-2222-2222-2222-222222222222','Office Chairs','SKU-002', cat2, 'Pieces','Ergonomic office chairs', 15)
  ON CONFLICT (sku) DO NOTHING;
  INSERT INTO products (id, name, sku, category_id, uom, description, reorder_level) VALUES
    ('55555555-3333-3333-3333-333333333333','Wooden Tables','SKU-003', cat2, 'Pieces','Oak wood conference tables', 5)
  ON CONFLICT (sku) DO NOTHING;
  INSERT INTO products (id, name, sku, category_id, uom, description, reorder_level) VALUES
    ('55555555-4444-4444-4444-444444444444','Computer Monitors','SKU-004', cat3, 'Pieces','27-inch 4K monitors', 8)
  ON CONFLICT (sku) DO NOTHING;
  INSERT INTO products (id, name, sku, category_id, uom, description, reorder_level) VALUES
    ('55555555-5555-5555-5555-555555555555','Keyboards','SKU-005', cat3, 'Pieces','Mechanical USB keyboards', 20)
  ON CONFLICT (sku) DO NOTHING;
  INSERT INTO products (id, name, sku, category_id, uom, description, reorder_level) VALUES
    ('55555555-6666-6666-6666-666666666666','Mouse','SKU-006', cat3, 'Pieces','Wireless optical mouse', 20)
  ON CONFLICT (sku) DO NOTHING;
  INSERT INTO products (id, name, sku, category_id, uom, description, reorder_level) VALUES
    ('55555555-7777-7777-7777-777777777777','Safety Helmets','SKU-007', cat4, 'Pieces','Industrial safety helmets', 12)
  ON CONFLICT (sku) DO NOTHING;
  SELECT id INTO p1 FROM products WHERE sku='SKU-001';
  SELECT id INTO p2 FROM products WHERE sku='SKU-002';
  SELECT id INTO p3 FROM products WHERE sku='SKU-003';
  SELECT id INTO p4 FROM products WHERE sku='SKU-004';
  SELECT id INTO p5 FROM products WHERE sku='SKU-005';
  SELECT id INTO p6 FROM products WHERE sku='SKU-006';
  SELECT id INTO p7 FROM products WHERE sku='SKU-007';

  INSERT INTO stock_levels (product_id, location_id, quantity) VALUES
    (p1, loc1a, 100),(p1, loc2a, 0),
    (p2, loc1a, 60),(p2, loc2a, 40),
    (p3, loc1b, 25),(p3, loc2b, 10),
    (p4, loc1a, 35),(p4, loc2a, 12),
    (p5, loc1b, 80),(p5, loc2a, 30),
    (p6, loc1b, 8),(p6, loc2a, 50),
    (p7, loc1a, 0),(p7, loc2b, 45)
  ON CONFLICT (product_id, location_id) DO NOTHING;

  INSERT INTO receipts (id, reference, supplier_id, warehouse_id, status, notes) VALUES
    ('66666666-1111-1111-1111-111111111111','REC-0001', sup1, wh1, 'done','Initial steel rod delivery')
  ON CONFLICT (reference) DO NOTHING;
  INSERT INTO receipt_items (receipt_id, product_id, location_id, quantity) VALUES
    ('66666666-1111-1111-1111-111111111111', p1, loc1a, 100)
  ON CONFLICT DO NOTHING;

  INSERT INTO deliveries (id, reference, customer_name, warehouse_id, status, notes) VALUES
    ('77777777-1111-1111-1111-111111111111','DEL-0001','Acme Corp', wh1, 'done','Chairs to Acme')
  ON CONFLICT (reference) DO NOTHING;
  INSERT INTO delivery_items (delivery_id, product_id, location_id, quantity, picked, packed) VALUES
    ('77777777-1111-1111-1111-111111111111', p2, loc1a, 10, true, true)
  ON CONFLICT DO NOTHING;

  INSERT INTO transfers (id, reference, from_location_id, to_location_id, status, notes) VALUES
    ('88888888-1111-1111-1111-111111111111','TRF-0001', loc1a, loc2a, 'done','Chairs balance transfer')
  ON CONFLICT (reference) DO NOTHING;
  INSERT INTO transfer_items (transfer_id, product_id, quantity) VALUES
    ('88888888-1111-1111-1111-111111111111', p2, 40)
  ON CONFLICT DO NOTHING;

  INSERT INTO receipts (id, reference, supplier_id, warehouse_id, status, notes) VALUES
    ('66666666-2222-2222-2222-222222222222','REC-0002', sup3, wh1, 'waiting','Monitors pending')
  ON CONFLICT (reference) DO NOTHING;
  INSERT INTO receipt_items (receipt_id, product_id, location_id, quantity) VALUES
    ('66666666-2222-2222-2222-222222222222', p4, loc1a, 20)
  ON CONFLICT DO NOTHING;

  INSERT INTO deliveries (id, reference, customer_name, warehouse_id, status, notes) VALUES
    ('77777777-2222-2222-2222-222222222222','DEL-0002','Globex Inc', wh2, 'draft','Keyboards order')
  ON CONFLICT (reference) DO NOTHING;
  INSERT INTO delivery_items (delivery_id, product_id, location_id, quantity, picked, packed) VALUES
    ('77777777-2222-2222-2222-222222222222', p5, loc2a, 15, false, false)
  ON CONFLICT DO NOTHING;

  INSERT INTO transfers (id, reference, from_location_id, to_location_id, status, notes) VALUES
    ('88888888-2222-2222-2222-222222222222','TRF-0002', loc1b, loc2b, 'waiting','Tables transfer')
  ON CONFLICT (reference) DO NOTHING;
  INSERT INTO transfer_items (transfer_id, product_id, quantity) VALUES
    ('88888888-2222-2222-2222-222222222222', p3, 5)
  ON CONFLICT DO NOTHING;

  INSERT INTO notifications (type, title, message, product_id, severity) VALUES
    ('low_stock','Low Stock Alert: Mouse','Mouse are running low. Current stock: 8. Reorder level: 20.', p6, 'warning')
  ON CONFLICT DO NOTHING;
  INSERT INTO notifications (type, title, message, product_id, severity) VALUES
    ('low_stock','Out of Stock: Safety Helmets','Safety Helmets are out of stock at Main Warehouse.', p7, 'error')
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.check_stock_available(
  p_product uuid, p_location uuid, p_qty numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty numeric;
BEGIN
  SELECT COALESCE(quantity,0) INTO v_qty
    FROM stock_levels WHERE product_id=p_product AND location_id=p_location;
  RETURN COALESCE(v_qty,0) >= p_qty;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_stock_available(uuid, uuid, numeric) TO authenticated;
