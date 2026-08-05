import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type LandingSectionShellProps = {
  id?: string
  eyebrow?: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function LandingSectionShell({ id, eyebrow, title, description, children, className }: LandingSectionShellProps) {
  return (
    <section id={id} className={cn('relative scroll-mt-24 px-6 py-20 lg:py-28', className)}>
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center mb-12 lg:mb-16"
        >
          {eyebrow ? (
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="h-1 w-1 rounded-full bg-primary" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary">{eyebrow}</p>
              <span className="h-1 w-1 rounded-full bg-primary" />
            </div>
          ) : null}
          <h2 className="text-3xl font-black tracking-tighter text-foreground md:text-4xl lg:text-5xl">{title}</h2>
          {description ? <p className="mt-4 text-base font-medium leading-relaxed text-muted-foreground max-w-2xl mx-auto">{description}</p> : null}
        </motion.div>
        <div className="relative z-10">{children}</div>
      </div>
    </section>
  )
}
