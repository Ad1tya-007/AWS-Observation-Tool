import { AlertCircleIcon, ArrowLeftIcon, RadarIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type RequestDetailErrorProps = {
  fetchError: string;
  requestId: string | undefined;
};

export function RequestDetailError({ fetchError, requestId }: RequestDetailErrorProps) {
  const isNoContext = fetchError === 'no-context';
  const isNotFound = fetchError === 'not-found';

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
      {isNoContext ? (
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <RadarIcon className="size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No active session found. Go back to the dashboard, select log groups and fetch logs
            first — then open a trace.
          </p>
        </div>
      ) : isNotFound ? (
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <AlertCircleIcon className="size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No events found for request{' '}
            <code className="rounded bg-muted/50 px-1.5 font-mono text-xs">{requestId}</code> in the
            selected log groups and time window.
          </p>
        </div>
      ) : (
        <Alert variant="destructive" className="max-w-lg">
          <AlertCircleIcon className="size-4" />
          <AlertTitle>Failed to load trace</AlertTitle>
          <AlertDescription className="font-mono text-xs">{fetchError}</AlertDescription>
        </Alert>
      )}
      <Button asChild variant="outline">
        <Link to="/" className="gap-2">
          <ArrowLeftIcon className="size-4" />
          Back to dashboard
        </Link>
      </Button>
    </div>
  );
}
