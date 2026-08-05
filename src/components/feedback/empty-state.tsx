import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="rounded-[4rem] border-dashed border-white/5 bg-zinc-900/10 backdrop-blur-3xl glow-border shadow-2xl overflow-hidden relative p-12 lg:p-20">
      <div className="absolute top-0 right-0 p-16 opacity-[0.02] pointer-events-none">
        <Icon className="size-64 text-primary" />
      </div>
      <CardHeader className="items-center text-center p-0 space-y-6">
        <div className="size-20 rounded-[2.5rem] bg-zinc-950 border border-white/5 flex items-center justify-center shadow-2xl">
          <Icon className="size-10 text-primary" aria-hidden />
        </div>
        <div className="space-y-4">
          <CardTitle className="text-3xl font-black text-white tracking-tighter leading-none">{title}</CardTitle>
          <CardDescription className="max-w-md text-zinc-500 font-bold text-lg leading-relaxed">{description}</CardDescription>
        </div>
      </CardHeader>
      {action ? <CardContent className="flex justify-center p-0 pt-10">{action}</CardContent> : null}
    </Card>
  )
}
