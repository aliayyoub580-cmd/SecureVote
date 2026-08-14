import { motion } from 'framer-motion'
import { Activity, Zap, ShieldCheck, Globe, Smartphone, Heart } from 'lucide-react'

import { LandingSectionShell } from '@/components/landing/landing-section-shell'
import { cn } from '@/lib/utils'

const features = [
  {
    icon: ShieldCheck,
    title: 'Complete Privacy',
    body: 'Anonymous voting ensures your choice is never linked to your identity. Private and secure.',
    color: 'text-[var(--accent-primary)]',
  },
  {
    icon: Heart,
    title: 'Trust & Integrity',
    body: 'Every vote is securely recorded and verifiable. No one can change or tamper with the results.',
    color: 'text-[var(--accent-danger)]',
  },
  {
    icon: Activity,
    title: 'Live Results',
    body: 'Track participation rates and see winners emerge in real-time with clear, easy-to-read charts.',
    color: 'text-[var(--accent-secondary)]',
  },
  {
    icon: Zap,
    title: 'Easy Setup',
    body: 'Create your election in minutes. Our simple wizard guides you through every single step.',
    color: 'text-primary',
  },
  {
    icon: Globe,
    title: 'Work Anywhere',
    body: 'Works on any device. Your team can vote from their computer, tablet, or phone with ease.',
    color: 'text-[var(--accent-info)]',
  },
  {
    icon: Smartphone,
    title: 'Mobile Ready',
    body: 'A beautiful and simple mobile experience designed for on-the-go voting and management.',
    color: 'text-[var(--accent-info)]',
  },
]

export function LandingFeatures() {
  return (
    <LandingSectionShell
      id="features"
      eyebrow="Key Features"
      title="Everything you need."
      description="Professional election tools designed for people, not just developers. Simple, secure, and reliable."
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="group relative rounded-3xl border border-border bg-card p-8 transition-all hover:shadow-xl shadow-sm overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
              <f.icon className="size-24" />
            </div>
            <div className={cn(
              "mb-6 inline-flex size-14 items-center justify-center rounded-xl bg-muted border border-border transition-transform duration-500 group-hover:scale-110 shadow-sm",
            )}>
              <f.icon className={cn("size-7", f.color)} />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-medium">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </LandingSectionShell>
  )
}
