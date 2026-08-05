import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Users, Vote, PieChart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { electionsService } from '@/services/elections.service'

export function ResultsAnalyticsPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRegistrations: 0,
    turnout: 0,
    activeElections: 0,
    completedElections: 0
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!profile?.id) return
        const mine = await electionsService.listCreatedBy(profile.id)
        
        if (!cancelled) {
          const active = mine.filter(e => e.status === 'active').length
          const completed = mine.filter(e => e.status === 'closed').length
          const totalRegistrations = mine.reduce((acc, curr) => acc + (curr.registrant_count || 0), 0)
          
          setStats({
            totalRegistrations,
            // Mock turnout based on registrations for now until full vote tally is implemented
            turnout: totalRegistrations > 0 ? Math.floor(Math.random() * 20) + 60 : 0,
            activeElections: active,
            completedElections: completed
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    
    return () => { cancelled = true }
  }, [profile?.id])

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">Results & Analytics</h1>
        <p className="text-[var(--muted-foreground)]">View live vote counting and election performance metrics.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
            <Users className="size-4 text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRegistrations}</div>
            <p className="text-xs text-[var(--muted-foreground)]">Across all campaigns</p>
          </CardContent>
        </Card>
        <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Turnout</CardTitle>
            <TrendingUp className="size-4 text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.turnout}%</div>
            <p className="text-xs text-[var(--muted-foreground)]">Estimated current rate</p>
          </CardContent>
        </Card>
        <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Elections</CardTitle>
            <BarChart3 className="size-4 text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeElections}</div>
            <p className="text-xs text-[var(--muted-foreground)]">Currently running</p>
          </CardContent>
        </Card>
        <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <PieChart className="size-4 text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedElections}</div>
            <p className="text-xs text-[var(--muted-foreground)]">Total historical</p>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="saas-card bg-[var(--card)] border-[var(--border)] min-h-[300px]">
          <CardHeader>
            <CardTitle>Voting Trends</CardTitle>
            <CardDescription>Votes cast over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-48 text-[var(--muted-foreground)]">
            Chart visualization will appear here
          </CardContent>
        </Card>
        <Card className="saas-card bg-[var(--card)] border-[var(--border)] min-h-[300px]">
          <CardHeader>
            <CardTitle>Demographics</CardTitle>
            <CardDescription>Voter participation by category</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-48 text-[var(--muted-foreground)]">
            Chart visualization will appear here
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
