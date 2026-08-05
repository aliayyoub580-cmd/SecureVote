import { motion } from 'framer-motion'
import { ShieldAlert, KeyRound, DatabaseZap, Lock } from 'lucide-react'

import { LandingSectionShell } from '@/components/landing/landing-section-shell'

const securityFeatures = [
  {
    icon: KeyRound,
    title: 'Data Privacy',
    description: 'Your election data is isolated and protected using advanced encryption standards.',
  },
  {
    icon: Lock,
    title: 'Private Voting',
    description: 'Voter privacy is guaranteed. Your choice remains completely anonymous and untraceable.',
  },
  {
    icon: DatabaseZap,
    title: 'Fraud Detection',
    description: 'Automatic systems prevent duplicate voting and identify suspicious activity immediately.',
  },
  {
    icon: ShieldAlert,
    title: 'Audit Logs',
    description: 'Every major action is recorded in a permanent log for complete transparency.',
  },
]

export function LandingSecurity() {
  return (
    <LandingSectionShell
      id="security"
      eyebrow="Security First"
      title="Safe & Secure Voting"
      description="Professional security measures to ensure every election is fair, honest, and private."
    >
      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {securityFeatures.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="group relative flex h-full flex-col rounded-[2rem] border border-border bg-card p-8 shadow-sm transition-all hover:shadow-lg hover:border-primary/20 overflow-hidden"
          >
            <div className="relative z-10 flex size-12 items-center justify-center rounded-xl bg-muted border border-border shadow-sm mb-6">
              <feature.icon className="size-6 text-primary group-hover:scale-110 transition-transform duration-500" />
            </div>
            
            <h3 className="relative z-10 text-lg font-bold text-foreground mb-3">{feature.title}</h3>
            <p className="relative z-10 text-sm text-muted-foreground font-medium leading-relaxed">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>
    </LandingSectionShell>
  )
}
