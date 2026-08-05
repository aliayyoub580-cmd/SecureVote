import { motion } from 'framer-motion'
import { CheckCircle2, Rocket, ShieldCheck, Vote } from 'lucide-react'

import { LandingSectionShell } from '@/components/landing/landing-section-shell'

const steps = [
  {
    icon: Rocket,
    title: 'Create Election',
    body: 'Set up your election, add candidates, and configure voting rules in minutes.',
  },
  {
    icon: ShieldCheck,
    title: 'Verify Voters',
    body: 'Secure authentication ensures that only eligible people can participate in the election.',
  },
  {
    icon: Vote,
    title: 'Cast Votes',
    body: 'Voters cast their private ballots securely from any device, anywhere in the world.',
  },
  {
    icon: CheckCircle2,
    title: 'View Results',
    body: 'Track real-time results with clear and honest outcomes that everyone can trust.',
  },
]

export function LandingHowItWorks() {
  return (
    <LandingSectionShell
      id="solutions"
      eyebrow="The Process"
      title="How it Works"
      description="A simple, secure, and transparent voting experience for everyone."
    >
      <div className="relative mt-12 max-w-5xl mx-auto">
        <div className="absolute left-[2rem] md:left-1/2 top-0 bottom-0 w-[1px] bg-border -translate-x-1/2 hidden sm:block" />
        
        <div className="space-y-12 lg:space-y-20">
          {steps.map((s, i) => {
            const isEven = i % 2 === 0
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className={`relative flex flex-col md:flex-row items-center gap-8 md:gap-16 ${
                  isEven ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                <div className={`flex-1 w-full text-left ${isEven ? 'md:text-right' : 'md:text-left'} pl-16 md:pl-0`}>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">Step 0{i + 1}</p>
                  <h3 className="text-xl md:text-2xl font-bold text-foreground mb-3">{s.title}</h3>
                  <p className="text-muted-foreground text-base leading-relaxed font-medium">{s.body}</p>
                </div>

                <div className="absolute left-[2rem] md:static md:w-auto -translate-x-1/2 md:translate-x-0 flex shrink-0 items-center justify-center">
                  <div className="relative group">
                    <div className="relative flex size-16 items-center justify-center rounded-2xl bg-card border border-border shadow-md z-10 transition-transform duration-500 group-hover:scale-110">
                      <s.icon className="size-7 text-primary relative z-10" />
                    </div>
                  </div>
                </div>

                <div className="flex-1 hidden md:block" />
              </motion.div>
            )
          })}
        </div>
      </div>
    </LandingSectionShell>
  )
}
