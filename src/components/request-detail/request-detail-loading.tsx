import { Loader2Icon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function RequestDetailLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-6 w-24 rounded-md" />
      </div>
      <div className="flex-1 space-y-3 rounded-xl border border-border/40 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-5/6" />
        <Skeleton className="h-10 w-4/6" />
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" />
          Fetching trace from CloudWatch…
        </div>
      </div>
    </div>
  );
}
