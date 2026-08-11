import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { LandingNavbar } from '@/components/landing/landing-navbar'
import { LandingFooter } from '@/components/landing/landing-footer'

export function PublicLayout() {
  const [search, setSearch] = useState('')

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--background)] text-[var(--foreground)] selection:bg-primary/20 selection:text-primary">
      <LandingNavbar search={search} onSearchChange={setSearch} />
      <main className="flex-1 pt-24 pb-12">
        <Outlet />
      </main>
      <LandingFooter />
    </div>
  )
}
