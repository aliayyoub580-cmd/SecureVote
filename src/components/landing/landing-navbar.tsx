import { motion, AnimatePresence } from 'framer-motion'
import { Menu, Moon, Sun, X, Search, ArrowUpRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { APP_NAME, ROUTES } from '@/constants/routes'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type LandingNavbarProps = {
  search: string
  onSearchChange: (v: string) => void
}

const nav = [
  { label: 'Elections', href: '#live' },
  { label: 'Features', href: '#features' },
  { label: 'Statistics', href: '#stats' },
  { label: 'Process', href: '#solutions' },
  { label: 'Social Media', to: ROUTES.communityFeed },
]

export function LandingNavbar({ search, onSearchChange }: LandingNavbarProps) {
  const { resolved, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const toggleTheme = () => setTheme(resolved === 'dark' ? 'light' : 'dark')

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-4",
        scrolled ? "py-3" : "py-6"
      )}
    >
      <div 
        className={cn(
          "mx-auto flex max-w-7xl items-center gap-4 rounded-2xl border transition-all duration-300",
          scrolled 
            ? "bg-background/80 border-border backdrop-blur-xl shadow-lg px-4 py-2" 
            : "bg-transparent border-transparent px-2 py-0"
        )}
      >
        <Link to={ROUTES.home} className="flex shrink-0 items-center gap-3 font-black tracking-tighter px-3 transition-transform hover:scale-105 active:scale-95">
          <div className="flex size-10 items-center justify-center rounded-xl bg-transparent overflow-hidden">
            <img src="/logo.png" alt="SecureVote" className="size-full object-contain" />
          </div>
          <span className={cn(
            "text-xl text-foreground transition-opacity",
            scrolled ? "opacity-100" : "opacity-0 sm:opacity-100"
          )}>{APP_NAME}</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {nav.map((item) => {
            if (item.to) {
              return (
                <motion.div key={item.label} whileHover={{ y: -1 }} whileTap={{ y: 0 }}>
                  <Link
                    to={item.to}
                    className="relative block px-5 py-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground group"
                  >
                    <span className="relative z-10">{item.label}</span>
                    <div className="absolute inset-0 rounded-xl bg-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </motion.div>
              )
            }
            return (
              <motion.a
                key={item.href}
                href={item.href}
                whileHover={{ y: -1 }}
                whileTap={{ y: 0 }}
                className="relative px-5 py-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground group"
              >
                <span className="relative z-10">{item.label}</span>
                <div className="absolute inset-0 rounded-xl bg-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.a>
            )
          })}
        </nav>

        {/* Desktop Actions */}
        <div className="flex items-center gap-3 pr-2">
          <div className="hidden md:block lg:flex-none">
            <div className="relative group/search">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground transition-colors group-focus-within/search:text-primary" />
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search elections..."
                className="h-10 w-44 rounded-xl border-border bg-muted/50 pl-10 pr-4 text-sm font-bold text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20 focus-visible:w-60 transition-all duration-300"
              />
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex size-10 items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {resolved === 'dark' ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
          </motion.button>
          
          <div className="hidden sm:flex items-center gap-2">
            <Button asChild variant="ghost" className="rounded-xl h-10 text-muted-foreground hover:text-foreground font-bold">
              <Link to={ROUTES.login}>Sign In</Link>
            </Button>
            <Button asChild className="rounded-xl h-10 premium-gradient px-6 font-bold shadow-md hover:scale-105 active:scale-95 transition-all">
              <Link to={ROUTES.register}>
                Join Now
              </Link>
            </Button>
          </div>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-xl size-10 lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute left-4 right-4 top-full mt-4 overflow-hidden rounded-[2.5rem] border border-border bg-popover/95 p-8 shadow-2xl backdrop-blur-3xl lg:hidden"
          >
            <div className="flex flex-col gap-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Find elections..."
                  className="h-14 rounded-2xl border-border bg-muted/50 pl-12 text-lg font-bold"
                />
              </div>
              <div className="grid grid-cols-1 gap-3">
                {nav.map((item) => {
                  if (item.to) {
                    return (
                      <motion.div key={item.label} whileTap={{ scale: 0.98 }}>
                        <Link
                          to={item.to}
                          className="flex items-center justify-between rounded-2xl bg-muted/50 px-6 py-5 text-lg font-black text-foreground hover:bg-muted transition-all group"
                          onClick={() => setOpen(false)}
                        >
                          {item.label}
                          <ArrowUpRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </Link>
                      </motion.div>
                    )
                  }
                  return (
                    <motion.a
                      key={item.href}
                      href={item.href}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-between rounded-2xl bg-muted/50 px-6 py-5 text-lg font-black text-foreground hover:bg-muted transition-all group"
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                      <ArrowUpRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </motion.a>
                  )
                })}
              </div>
              <div className="flex flex-col gap-3 pt-4 border-t border-border">
                <Button asChild variant="outline" className="w-full rounded-2xl border-border bg-muted/50 h-14 text-lg font-bold" onClick={() => setOpen(false)}>
                  <Link to={ROUTES.login}>Sign In</Link>
                </Button>
                <Button asChild className="w-full rounded-2xl premium-gradient h-14 text-lg font-black shadow-lg" onClick={() => setOpen(false)}>
                  <Link to={ROUTES.register}>Join Now</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
