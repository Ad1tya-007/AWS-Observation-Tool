import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
} from 'lucide-react';
import type { ObservedRequest } from '@/lib/aws-api';

export function StatusCell({ row }: { row: ObservedRequest }) {
  if (row.errorCount > 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-destructive"
        title={`${row.errorCount} error(s)`}>
        <AlertCircleIcon className="size-4 shrink-0" aria-hidden />
        <span className="text-xs font-medium">
          Errors <span className="sr-only">({row.errorCount})</span>
        </span>
      </span>
    );
  }
  if (row.warningCount > 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-amber-400"
        title={`${row.warningCount} warning(s)`}>
        <AlertTriangleIcon className="size-4 shrink-0" aria-hidden />
        <span className="text-xs font-medium">
          Warnings <span className="sr-only">({row.warningCount})</span>
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-emerald-400">
      <CheckCircle2Icon className="size-4 shrink-0" aria-hidden />
      <span className="text-xs font-medium">Healthy</span>
    </span>
  );
}
