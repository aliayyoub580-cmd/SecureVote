import { Skeleton } from '@/components/ui/skeleton'

export function RouteFallback() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
      </div>
    </div>
  )
}
