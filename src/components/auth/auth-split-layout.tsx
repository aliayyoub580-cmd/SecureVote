import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, ShieldCheck, Zap, Globe } from 'lucide-react'

import { ROUTES } from '@/constants/routes'

type AuthSplitLayoutProps = {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthSplitLayout({ title, subtitle, children, footer }: AuthSplitLayoutProps) {
  return (
    <div className="grid min-h-dvh w-full lg:grid-cols-2 bg-background transition-colors duration-500">
      {/* Left Side - Hero/Visual */}
      <div className="relative hidden flex-col justify-between overflow-hidden lg:flex p-12 border-r border-border bg-muted/30">
        <div className="absolute inset-0 bg-grid-slate-500/[0.05]" />
        
        <Link to={ROUTES.home} className="relative z-10 flex items-center gap-3 group">
          <div className="flex size-10 items-center justify-center rounded-xl bg-transparent transition-transform group-hover:scale-105 overflow-hidden">
            <img src="/logo.png" alt="SecureVote" className="size-full object-contain" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">SecureVote</span>
        </Link>

        <div className="relative z-10 space-y-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl font-black tracking-tight text-foreground leading-[1.1]">
              The modern way to <br />
              <span className="text-primary">run elections.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground leading-relaxed font-medium">
              Join professional organizations using our secure platform to run their most important voting events.
            </p>
          </motion.div>

          <div className="space-y-4">
            {[
              { icon: ShieldCheck, text: 'Private and secure voting' },
              { icon: Zap, text: 'Real-time verifiable results' },
              { icon: Globe, text: 'Vote from any device' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * i }}
                className="flex items-center gap-3 text-foreground"
              >
                <div className="flex size-9 items-center justify-center rounded-xl bg-background border border-border shadow-sm">
                  <feature.icon className="size-4 text-primary" />
                </div>
                <span className="text-sm font-bold">{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            © {new Date().getFullYear()} SecureVote Platform · Professional Edition
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="relative flex flex-col justify-center px-4 py-12 sm:px-8 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10 lg:hidden flex justify-center">
            <Link to={ROUTES.home} className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-transparent overflow-hidden">
                <img src="/logo.png" alt="SecureVote" className="size-full object-contain" />
              </div>
              <span className="text-2xl font-bold text-foreground">SecureVote</span>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-card border border-border rounded-2xl sm:rounded-[2rem] p-5 sm:p-10 shadow-xl"
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed font-medium">{subtitle}</p>
            </div>

            <div className="space-y-6">
              {children}
            </div>
          </motion.div>

          {footer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-8 text-center text-sm text-muted-foreground font-medium"
            >
              {footer}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
