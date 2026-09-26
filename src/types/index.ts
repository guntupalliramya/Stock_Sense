export type DocStatus = 'draft' | 'waiting' | 'ready' | 'done' | 'canceled';
export type Role = 'inventory_manager' | 'warehouse_staff';

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: Role;
  avatar_url: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  created_at: string;
}

export interface Location {
  id: string;
  warehouse_id: string;
  name: string;
  code: string;
  created_at: string;
  warehouse?: Warehouse;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category_id: string | null;
  uom: string;
  description: string;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
  stock_levels?: StockLevel[];
}

export interface StockLevel {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  updated_at: string;
  location?: Location;
}

export interface ReorderingRule {
  id: string;
  product_id: string;
  location_id: string;
  min_quantity: number;
  max_quantity: number;
}

export interface Receipt {
  id: string;
  reference: string;
  supplier_id: string | null;
  warehouse_id: string;
  status: DocStatus;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  warehouse?: Warehouse;
  receipt_items?: ReceiptItem[];
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  created_at: string;
  product?: Product;
  location?: Location;
}

export interface Delivery {
  id: string;
  reference: string;
  customer_name: string;
  warehouse_id: string;
  status: DocStatus;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  warehouse?: Warehouse;
  delivery_items?: DeliveryItem[];
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  picked: boolean;
  packed: boolean;
  created_at: string;
  product?: Product;
  location?: Location;
}

export interface Transfer {
  id: string;
  reference: string;
  from_location_id: string;
  to_location_id: string;
  status: DocStatus;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  from_location?: Location;
  to_location?: Location;
  transfer_items?: TransferItem[];
}

export interface TransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  product?: Product;
}

export interface Adjustment {
  id: string;
  reference: string;
  status: DocStatus;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  adjustment_items?: AdjustmentItem[];
}

export interface AdjustmentItem {
  id: string;
  adjustment_id: string;
  product_id: string;
  location_id: string;
  recorded_qty: number;
  counted_qty: number;
  difference: number;
  created_at: string;
  product?: Product;
  location?: Location;
}

export interface StockLedgerEntry {
  id: string;
  created_at: string;
  product_id: string;
  transaction_type: 'receipt' | 'delivery' | 'transfer' | 'adjustment';
  quantity: number;
  from_location_id: string | null;
  to_location_id: string | null;
  previous_stock: number;
  updated_stock: number;
  user_id: string | null;
  reference: string;
  status: string;
  product?: Product;
  from_location?: Location;
  to_location?: Location;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  product_id: string | null;
  severity: 'info' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

export interface DashboardStats {
  total_products: number;
  total_stock_units: number;
  low_stock_count: number;
  out_of_stock_count: number;
  pending_receipts: number;
  pending_deliveries: number;
  pending_transfers: number;
}
