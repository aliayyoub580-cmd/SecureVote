import { motion } from 'framer-motion'
import { ArrowRight, ShieldCheck, Zap } from 'lucide-react'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
}

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }
}

export function LandingTeam() {
  return (
    <section id="team" className="relative overflow-hidden py-24 sm:py-32 lg:py-40">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent opacity-50" />
      
      <div className="mx-auto max-w-[1400px] px-6 lg:px-8 relative z-10">
        <motion.div 
          className="mx-auto max-w-2xl text-center"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.div variants={item} className="flex justify-center">
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
              Our Development Team
            </span>
          </motion.div>
          <motion.h2 variants={item} className="mt-6 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl text-foreground">
            Project <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Contributors</span>
          </motion.h2>
          <motion.p variants={item} className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Meet the developers who designed and engineered this system with innovation and precision.
          </motion.p>
        </motion.div>

        <motion.div 
          className="mx-auto mt-20 grid max-w-5xl gap-8 md:grid-cols-2"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Muhammad Abdullah Card */}
          <motion.div variants={item}>
            <motion.div 
              whileHover={{ y: -8, scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="group relative flex h-full flex-col items-center justify-between overflow-hidden rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 text-center transition-colors duration-500 hover:border-cyan-500/30 hover:bg-[var(--muted)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]"
            >
              
              {/* Cyan Glow */}
              <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[300px] w-[300px] rounded-full bg-cyan-500/10 blur-[80px] pointer-events-none transition-all duration-500 group-hover:bg-cyan-500/20" />
              
              <div className="relative z-10 flex flex-col items-center w-full">
                {/* Avatar */}
                <div className="relative mb-6">
                  <div className="relative size-40 overflow-hidden rounded-full border-4 border-cyan-500/50 p-1 bg-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.3)] transition-transform duration-500 group-hover:scale-105">
                    <img 
                      src="/abdullah.png" 
                      alt="Muhammad Abdullah" 
                      className="size-full rounded-full object-cover"
                      onError={(e) => { e.currentTarget.src = "https://ui-avatars.com/api/?name=Muhammad+Abdullah&background=random&color=fff&size=200" }}
                    />
                  </div>
                  {/* Icon Badge */}
                  <div className="absolute bottom-0 right-2 flex size-10 items-center justify-center rounded-full border-[3px] border-background bg-cyan-500 text-zinc-950 shadow-lg">
                    <ShieldCheck className="size-5 fill-current" />
                  </div>
                </div>

                <h3 className="text-3xl font-black text-foreground tracking-tight group-hover:text-cyan-400 transition-colors">Muhammad Abdullah</h3>
                
                <div className="mt-4 inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-5 py-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Super Admin & Lead Developer</span>
                </div>

                <p className="mt-6 text-muted-foreground leading-relaxed font-medium">
                  Project architecture, full-stack integration, and team leadership.
                </p>
              </div>

              <div className="relative z-10 mt-10 w-full">
                <a 
                  href="https://muhammadabdullahwali.vercel.app/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group/btn flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 px-6 py-4 text-sm font-bold text-cyan-400 transition-all hover:bg-cyan-500 hover:text-zinc-950 active:scale-95 shadow-[0_0_20px_rgba(34,211,238,0.1)] hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                >
                  View Portfolio
                  <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-1" />
                </a>
              </div>
            </motion.div>
          </motion.div>

          {/* Fatima Choudhry Card */}
          <motion.div variants={item}>
            <motion.div 
              whileHover={{ y: -8, scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="group relative flex h-full flex-col items-center justify-between overflow-hidden rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 text-center transition-colors duration-500 hover:border-purple-500/30 hover:bg-[var(--muted)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]"
            >
              
              {/* Purple Glow */}
              <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[300px] w-[300px] rounded-full bg-purple-500/10 blur-[80px] pointer-events-none transition-all duration-500 group-hover:bg-purple-500/20" />
              
              <div className="relative z-10 flex flex-col items-center w-full">
                {/* Avatar */}
                <div className="relative mb-6">
                  <div className="relative size-40 overflow-hidden rounded-full border-4 border-purple-500/50 p-1 bg-purple-500/10 shadow-[0_0_30px_rgba(168,85,247,0.3)] transition-transform duration-500 group-hover:scale-105">
                    <img 
                      src="/fatima.png" 
                      alt="Fatima Choudhry" 
                      className="size-full rounded-full object-cover"
                      onError={(e) => { e.currentTarget.src = "https://ui-avatars.com/api/?name=Fatima+Choudhry&background=random&color=fff&size=200" }}
                    />
                  </div>
                  {/* Icon Badge */}
                  <div className="absolute bottom-0 right-2 flex size-10 items-center justify-center rounded-full border-[3px] border-background bg-purple-500 text-white shadow-lg">
                    <Zap className="size-5 fill-current" />
                  </div>
                </div>

                <h3 className="text-3xl font-black text-foreground tracking-tight group-hover:text-purple-400 transition-colors">Fatima Choudhry</h3>
                
                <div className="mt-4 inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-5 py-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Lead Developer</span>
                </div>

                <p className="mt-6 text-muted-foreground leading-relaxed font-medium">
                  Frontend architecture, user experience design, and seamless animations.
                </p>
              </div>

              <div className="relative z-10 mt-10 w-full">
                <a 
                  href="https://fatimachoudhry.vercel.app/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group/btn flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-500/10 border border-purple-500/20 px-6 py-4 text-sm font-bold text-purple-400 transition-all hover:bg-purple-500 hover:text-white active:scale-95 shadow-[0_0_20px_rgba(168,85,247,0.1)] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                >
                  View Portfolio
                  <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-1" />
                </a>
              </div>
            </motion.div>
          </motion.div>

        </motion.div>
      </div>
    </section>
  )
}
