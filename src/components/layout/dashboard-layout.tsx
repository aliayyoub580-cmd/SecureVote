import { AnimatePresence, motion } from 'framer-motion'
import { Menu, Vote } from 'lucide-react'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { useMediaQuery } from '@/hooks/use-media-query'
import { Button } from '@/components/ui/button'
import { AppSidebar } from './app-sidebar'
import { AppTopbar } from './app-topbar'

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const location = useLocation()

  return (
    <div className="flex h-dvh bg-[var(--background)] text-[var(--foreground)] overflow-hidden relative selection:bg-primary/30 selection:text-white">
      {/* Subtle Background System */}
      <div className="ambient-layer" />

      {/* Desktop Sidebar */}
      {isDesktop && (
        <aside 
          className="relative h-full transition-all duration-300 ease-in-out border-r border-[var(--border)]"
          style={{ width: collapsed ? '80px' : '260px' }}
        >
          <AppSidebar 
            collapsed={collapsed} 
            onToggle={() => setCollapsed(!collapsed)} 
          />
        </aside>
      )}

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {!isDesktop && mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] lg:hidden"
            >
              <AppSidebar 
                collapsed={false} 
                onNavigate={() => setMobileOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-hidden relative z-10">
        <header className="shrink-0 h-16 border-b border-[var(--border)] bg-[var(--bg-surface)] flex items-center px-4 lg:px-6 gap-3">
           {!isDesktop && (
              <div className="flex items-center gap-3 shrink-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setMobileOpen(true)}
                  className="size-9 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] shrink-0"
                >
                  <Menu className="size-4" />
                </Button>
                <div className="flex items-center gap-2">
                   <div className="size-6 rounded flex items-center justify-center overflow-hidden shrink-0">
                     <img src="/logo.png" alt="SecureVote" className="size-full object-contain" />
                   </div>
                   <span className="text-sm font-bold tracking-tight text-[var(--foreground)]">SecureVote</span>
                </div>
              </div>
           )}
           {/* Topbar fills remaining space — on mobile shows only actions (welcome hidden via lg:flex) */}
           <div className="flex-1 min-w-0">
             <AppTopbar />
           </div>
        </header>

        <div className="flex-1 overflow-y-auto scroll-smooth">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
