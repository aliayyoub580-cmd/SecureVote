import { motion } from 'framer-motion'
import { Quote, Sparkles } from 'lucide-react'

import { LandingSectionShell } from '@/components/landing/landing-section-shell'

const quotes = [
  {
    name: 'Elena Park',
    role: 'Director of Operations',
    org: 'Community Collective',
    text: 'We replaced outdated manual voting with this platform. Voter participation doubled in just one election cycle.',
  },
  {
    name: 'Marcus Reid',
    role: 'Student Council President',
    org: 'State University',
    text: 'The process is so simple that everyone understood it immediately. Real-time results made election night exciting.',
  },
  {
    name: 'Priya Sharma',
    role: 'IT Manager',
    org: 'Global Health',
    text: 'Security was our top priority, and this platform delivered. It is professional, secure, and very easy to manage.',
  },
]

export function LandingTestimonials() {
  return (
    <LandingSectionShell
      eyebrow="User Stories"
      title="Trusted by organizations."
      description="See why teams around the world choose our platform for their secure voting needs."
    >
      <div className="grid gap-6 md:grid-cols-3">
        {quotes.map((q, i) => (
          <motion.figure
            key={q.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="group relative flex h-full flex-col rounded-[2rem] border border-border bg-card p-8 shadow-sm transition-all hover:shadow-lg hover:border-primary/20 overflow-hidden"
          >
            <div className="relative z-10 flex items-center justify-between mb-6">
              <div className="flex size-12 items-center justify-center rounded-xl bg-muted border border-border shadow-sm">
                <Quote className="size-5 text-primary group-hover:scale-110 transition-transform duration-500" />
              </div>
              <Sparkles className="size-4 text-muted-foreground group-hover:text-primary transition-colors duration-500 opacity-20" />
            </div>
            
            <blockquote className="relative z-10 flex-1 text-base font-medium leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors">
              “{q.text}”
            </blockquote>
            
            <figcaption className="relative z-10 mt-8 flex items-center gap-4 border-t border-border pt-6">
              <div className="size-10 rounded-full bg-muted border border-border shadow-sm flex items-center justify-center">
                <span className="text-xs font-black text-foreground">{q.name.charAt(0)}</span>
              </div>
              <div>
                <p className="font-bold text-foreground text-sm">{q.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {q.role} <span className="text-primary">•</span> {q.org}
                </p>
              </div>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </LandingSectionShell>
  )
}
