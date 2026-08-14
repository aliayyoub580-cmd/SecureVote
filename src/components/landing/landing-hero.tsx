import { motion, useScroll } from 'framer-motion'
import { ArrowRight, ShieldCheck, Globe, Lock, Zap, CheckCircle2, Vote, Activity } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'

type LandingHeroProps = {
  totalVotes: number
  totalUsers: number
  totalElections: number
}

export function LandingHero({ totalVotes, totalUsers, totalElections }: LandingHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  })



  return (
    <section ref={containerRef} className="relative min-h-screen flex items-center justify-center pt-32 pb-32 overflow-hidden bg-background transition-colors duration-500">
      {/* Subtle Background Accents */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] bg-[radial-gradient(circle_at_center,rgba(216,154,0,0.05)_0%,transparent_70%)] opacity-50" />
        <div className="absolute bottom-0 left-0 w-full h-[600px] bg-[radial-gradient(circle_at_bottom_left,rgba(216,154,0,0.03)_0%,transparent_60%)] opacity-50" />
      </div>
      
      {/* Decorative Gradients */}
      <motion.div 
        animate={{ 
          y: [0, -30, 0],
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-10 size-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" 
      />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center max-w-6xl mx-auto">
          {/* Status Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "circOut" }}
            className="mb-10 inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-card border border-border shadow-sm glow-border"
          >
            <div className="flex gap-2 mr-1">
              {[
                { icon: ShieldCheck, color: 'text-[var(--accent-primary)]', bg: 'bg-[var(--accent-primary)]/10' },
                { icon: Lock, color: 'text-primary', bg: 'bg-primary/10' },
                { icon: CheckCircle2, color: 'text-[var(--accent-secondary)]', bg: 'bg-[var(--accent-secondary)]/10' },
              ].map((item, i) => (
                <div key={i} className={`size-5 rounded-full border border-border ${item.bg} flex items-center justify-center`}>
                  <item.icon className={`size-3 ${item.color}`} />
                </div>
              ))}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Secure · Anonymous · Real-time Results</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "circOut" }}
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-foreground tracking-tight leading-[1.1] mb-6 select-none"
          >
            Modern Voting <br />
            <span className="text-primary">Made Simple.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed mb-12 font-medium"
          >
            The ultimate platform for secure online elections. Professional, transparent, and built for everyone.
          </motion.p>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24 w-full px-4 sm:px-0"
          >
            <Button asChild size="lg" className="h-14 sm:h-16 w-full sm:w-[320px] rounded-2xl premium-gradient text-white text-base sm:text-lg font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
              <Link to={ROUTES.register} className="flex items-center justify-center w-full h-full gap-3">
                <span>Get Started</span>
                <ArrowRight className="size-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 sm:h-16 w-full sm:w-[320px] rounded-2xl border-border bg-card text-foreground text-base sm:text-lg font-bold hover:bg-muted transition-all">
              <Link to={ROUTES.elections} className="flex items-center justify-center w-full h-full gap-3">
                <Vote className="size-6 text-primary" />
                <span>Browse Elections</span>
              </Link>
            </Button>
          </motion.div>

          {/* Platform Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="relative w-full max-w-6xl mx-auto px-4"
          >
            <div className="absolute inset-0 bg-primary/10 blur-[120px] rounded-full -z-10 opacity-30" />
            <div className="bg-card rounded-[3rem] p-6 md:p-12 border border-border shadow-2xl relative overflow-hidden group/mockup">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.03),transparent)]" />
              
              {/* Header */}
              <div className="flex items-center justify-between mb-16 pb-8 border-b border-border relative z-10">
                <div className="flex items-center gap-6">
                  <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                    <Vote className="size-7 text-primary" />
                  </div>
                  <div className="text-left hidden sm:block">
                    <h4 className="text-xl font-bold text-foreground">SecureVote Dashboard</h4>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Professional Election Management</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="hidden md:flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-[var(--accent-primary)]">Live</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Status</span>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-foreground">Verified</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Identity</span>
                    </div>
                  </div>
                  <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
                    <Activity className="size-5 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8 relative z-10">
                {[
                  { name: 'Total Votes', stats: totalVotes.toLocaleString(), growth: 'Live', icon: Globe, color: 'text-primary' },
                  { name: 'Active Users', stats: totalUsers.toLocaleString(), growth: 'Verified', icon: Zap, color: 'text-[var(--accent-secondary)]' },
                  { name: 'Total Elections', stats: totalElections.toLocaleString(), growth: 'Active', icon: ShieldCheck, color: 'text-[var(--accent-primary)]' },
                ].map((item, i) => (
                  <motion.div 
                    key={i} 
                    className="p-6 md:p-8 rounded-[2rem] bg-muted/30 border border-border flex flex-col gap-4 md:gap-6 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className={`size-12 rounded-xl bg-background flex items-center justify-center border border-border shadow-sm ${item.color}`}>
                        <item.icon className="size-6" />
                      </div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest bg-background px-2 py-1 rounded-lg border border-border">{item.growth}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-3xl md:text-4xl font-black text-foreground tracking-tighter">{item.stats}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{item.name}</p>
                    </div>
                    <div className="h-1.5 rounded-full bg-background overflow-hidden border border-border">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "70%" }}
                        transition={{ duration: 2, delay: 1.2 + i * 0.1 }}
                        className="h-full bg-primary" 
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

