# StockSense — Inventory Management System

A complete, modern inventory management system that digitizes and centralizes stock operations — receipts, deliveries, internal transfers, adjustments, and full stock ledger tracking across multiple warehouses.

## Project Description

StockSense is a professional SaaS-style inventory management application built for inventory managers and warehouse staff. It replaces manual registers and scattered Excel sheets with a centralized, real-time system for tracking stock across multiple warehouses and locations.

## Features

- **Authentication** — Sign up, login, OTP-based password reset, logout, and profile management
- **Dashboard** — KPI cards (total products, low stock, out of stock, pending receipts/deliveries/transfers), dynamic filters by document type/status/warehouse/category, and visual charts (stock by category, stock by warehouse, incoming vs outgoing)
- **Product Management** — Create, update, view, search, and filter products; manage categories; view stock availability by location; configure reorder levels
- **Receipts** — Record incoming stock from suppliers with line items; validate to automatically increase stock; full status workflow (draft → waiting → ready → done → canceled)
- **Delivery Orders** — Record outgoing stock with pick/pack tracking; validates available stock (cannot deliver more than available); automatically decreases stock on validation
- **Internal Transfers** — Move stock between locations; source decreases, destination increases; total company stock unchanged; every move recorded in ledger
- **Inventory Adjustments** — Reconcile physical vs recorded stock; shows recorded, counted, and difference; updates stock on confirmation
- **Move History / Stock Ledger** — Complete append-only transaction log with filters by date, product, SKU, transaction type, and status
- **Low Stock Alerts** — Automatic notifications when stock falls at or below reorder level; out-of-stock alerts for zero quantity
- **Multi-Warehouse Support** — Multiple warehouses, each with multiple locations (racks, zones); stock tracked per location
- **Notifications** — Bell icon in header opens a notification drawer with low-stock and out-of-stock alerts

## Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React (icons)
- **Backend:** Supabase (PostgreSQL database, Auth, Row Level Security, RPC functions)
- **Database:** PostgreSQL with proper relational schema, foreign keys, triggers, and SECURITY DEFINER functions

## Project Structure

```
stocksense/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # Responsive sidebar + header
│   │   │   └── NotificationDrawer.tsx # Low-stock alert drawer
│   │   └── ui/
│   │       ├── Button.tsx            # Reusable button component
│   │       ├── Field.tsx             # Form inputs (Input, Select, Textarea, Field)
│   │       ├── Modal.tsx             # Modal dialog
│   │       ├── ConfirmDialog.tsx     # Confirmation dialog
│   │       ├── Badges.tsx            # Status & stock badges
│   │       ├── States.tsx            # Loading, empty, error states
│   │       └── DataTable.tsx         # Reusable table component
│   ├── contexts/
│   │   ├── AuthContext.tsx           # Auth state management
│   │   └── ToastContext.tsx          # Toast notifications
│   ├── lib/
│   │   └── supabase.ts               # Supabase client
│   ├── pages/
│   │   ├── AuthPage.tsx              # Login / Signup / Forgot / Reset
│   │   ├── DashboardPage.tsx         # Dashboard with KPIs & charts
│   │   ├── ProductsPage.tsx          # Product CRUD & categories
│   │   ├── ReceiptsPage.tsx          # Incoming stock
│   │   ├── DeliveriesPage.tsx        # Outgoing stock
│   │   ├── TransfersPage.tsx         # Internal transfers
│   │   ├── AdjustmentsPage.tsx       # Stock reconciliation
│   │   ├── MoveHistoryPage.tsx       # Stock ledger
│   │   ├── WarehousesPage.tsx        # Warehouse & location settings
│   │   └── ProfilePage.tsx           # User profile
│   ├── types/
│   │   └── index.ts                  # TypeScript types
│   ├── App.tsx                       # Main app with routing
│   ├── main.tsx                      # Entry point
│   └── index.css                     # Global styles
├── supabase/
│   └── migrations/                   # Database migrations (applied)
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Database Setup

The database is already provisioned and migrations are applied. The schema includes:

- `profiles` — extends Supabase auth.users with role and name
- `categories` — product categories
- `suppliers` — vendor records
- `warehouses` — top-level warehouse entities
- `locations` — storage locations within warehouses
- `products` — product master data with SKU, UoM, reorder level
- `stock_levels` — current stock per product per location (source of truth)
- `reordering_rules` — optional per-location reorder rules
- `receipts` / `receipt_items` — incoming stock documents
- `deliveries` / `delivery_items` — outgoing stock documents
- `transfers` / `transfer_items` — internal transfer documents
- `adjustments` / `adjustment_items` — stock reconciliation documents
- `stock_ledger` — append-only transaction history
- `notifications` — low-stock and out-of-stock alerts

**Key database functions:**
- `apply_stock_movement()` — SECURITY DEFINER function that updates stock_levels and writes ledger entries atomically
- `check_stock_available()` — Pre-check stock before delivery/transfer
- `dashboard_stats()` — Aggregated KPI counts
- `handle_new_user()` — Auto-creates profile on signup (trigger)

All tables have Row Level Security enabled with authenticated-only policies.

## Environment Variables

The following are pre-populated in `.env`:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

No manual configuration needed.

## How to Run

### Frontend

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

### Backend

The backend is Supabase — no separate server to run. Database migrations are already applied. All API operations go through the Supabase client directly.

### Build

```bash
npm run build
```

## Demo Login Details

1. **Sign up** with any email and password (6+ characters) on the Sign Up page
2. After signup, you'll be redirected to the dashboard
3. The system comes pre-loaded with sample data:
   - 2 warehouses (Main Warehouse, Warehouse 2) with 4 locations
   - 5 categories, 4 suppliers, 7 products
   - Sample receipts, deliveries, and transfers
   - Pre-seeded stock levels and low-stock notifications

## Screenshots

*(Add screenshots here after running the app)*

## Stock Calculation Logic

| Operation | Formula |
|-----------|---------|
| Receipt | Stock = Stock + Received Quantity |
| Delivery | Stock = Stock − Delivered Quantity (validated against available) |
| Transfer | Source Stock −= Qty, Destination Stock += Qty |
| Adjustment | Stock = Physical Count (counted quantity) |

Every stock change creates a `stock_ledger` entry with previous stock, updated stock, quantity, location info, user, and reference.

## Future Improvements

- Barcode/QR code scanning for products
- Supplier purchase order management
- Customer management for deliveries
- Role-based access control (restrict warehouse staff to specific operations)
- Export reports to PDF/Excel
- Real-time stock updates via Supabase Realtime
- Mobile app for warehouse staff
- Automated reordering when stock hits reorder level
- Audit trail for user actions
- Multi-currency support for supplier pricing
