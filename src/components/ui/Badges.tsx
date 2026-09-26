import { DocStatus } from '@/types';

const styles: Record<DocStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  waiting: 'bg-amber-50 text-amber-700 border-amber-200',
  ready: 'bg-blue-50 text-blue-700 border-blue-200',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  canceled: 'bg-red-50 text-red-700 border-red-200',
};

const labels: Record<DocStatus, string> = {
  draft: 'Draft',
  waiting: 'Waiting',
  ready: 'Ready',
  done: 'Done',
  canceled: 'Canceled',
};

export function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

const stockStyles: Record<StockStatus, string> = {
  in_stock: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  low_stock: 'bg-amber-50 text-amber-700 border-amber-200',
  out_of_stock: 'bg-red-50 text-red-700 border-red-200',
};

const stockLabels: Record<StockStatus, string> = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${stockStyles[status]}`}>
      {stockLabels[status]}
    </span>
  );
}

export function getStockStatus(quantity: number, reorderLevel: number): StockStatus {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= reorderLevel) return 'low_stock';
  return 'in_stock';
}
