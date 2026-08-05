import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { motion, type Variants } from 'framer-motion'
import { User, Palette, Shield, Mail, Bell, Loader2, Sparkles, UserCircle, Settings, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { profilesService } from '@/services/profiles.service'
import { TwoFactorDialog } from '@/components/settings/two-factor-dialog'

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'circOut' } }
}

export function SettingsPage() {
  const { profile, refreshProfile, user } = useAuth()
  const { setTheme, resolved } = useTheme()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [organization, setOrganization] = useState(profile?.organization ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [saving, setSaving] = useState(false)
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    setName(profile?.full_name ?? '')
    setPhone(profile?.phone ?? '')
    setOrganization(profile?.organization ?? '')
    setEmail(user?.email ?? '')
  }, [profile, user])

  useEffect(() => {
    const checkMfaStatus = async () => {
      const { data } = await supabase.auth.mfa.listFactors()
      if (data && data.all.length > 0) {
        setMfaEnabled(data.all.some(f => f.status === 'verified'))
      } else {
        setMfaEnabled(false)
      }
    }
    void checkMfaStatus()
  }, [twoFactorOpen])

  const handleDisableMfa = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors()
      if (data && data.all.length > 0) {
        const verified = data.all.filter(f => f.status === 'verified')
        for (const f of verified) {
          await supabase.auth.mfa.unenroll({ factorId: f.id })
        }
        setMfaEnabled(false)
        toast.success('Two-Factor Authentication has been disabled.')
      }
    } catch (err) {
      toast.error('Failed to disable 2FA.')
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      await profilesService.updateSelf({
        full_name: name,
        phone: phone.trim() || null,
        organization: organization.trim() || null,
      })
      await refreshProfile()
      toast.success('Settings saved successfully.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 sm:space-y-12 pb-32 pt-6 sm:pt-12 px-4 sm:px-6">
      <motion.div 
        variants={item}
        initial="hidden"
        animate="show"
        className="space-y-3 border-b border-[var(--border)] pb-6 sm:pb-8"
      >
        <div className="flex items-center gap-2">
          <Settings className="size-4 text-[var(--primary)]" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Account</p>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[var(--foreground)] tracking-tight">Settings</h1>
        <p className="max-w-2xl text-[var(--muted-foreground)] font-medium text-sm sm:text-base">
          Manage your profile information, appearance preferences, and account security.
        </p>
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-8 lg:grid-cols-3">
        {/* Left / Main Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Personal Information */}
          <motion.div variants={item}>
            <Card className="saas-card bg-[var(--card)] border-[var(--border)] overflow-hidden relative group">
              <div className="absolute -right-8 -top-8 opacity-[0.02] group-hover:opacity-[0.04] group-hover:scale-110 transition-all duration-700 pointer-events-none z-0">
                <UserCircle className="size-64 text-[var(--primary)]" />
              </div>
              <CardHeader className="pb-6 border-b border-[var(--border)] relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="size-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center border border-[var(--primary)]/20">
                    <User className="size-5 text-[var(--primary)]" />
                  </div>
                  <CardTitle className="text-xl font-bold text-[var(--foreground)]">Personal Information</CardTitle>
                </div>
                <CardDescription className="text-[var(--muted-foreground)] font-medium text-sm">
                  Update your personal details here. Your email address is linked to your account and cannot be changed.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 space-y-8 relative z-10">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-3">
                    <Label htmlFor="fullName" className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Full Name</Label>
                    <Input id="fullName" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl bg-[var(--muted)]/30 border-[var(--border)] font-bold text-[var(--foreground)] focus-visible:ring-[var(--primary)]" />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Email Address</Label>
                    <Input value={email} disabled className="h-12 rounded-xl bg-[var(--muted)]/50 border-[var(--border)] font-bold text-[var(--muted-foreground)] cursor-not-allowed opacity-60" />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="phone" className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Phone Number</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className="h-12 rounded-xl bg-[var(--muted)]/30 border-[var(--border)] font-bold text-[var(--foreground)] focus-visible:ring-[var(--primary)]" />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="organization" className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Organization</Label>
                    <Input id="organization" value={organization} onChange={(e) => setOrganization(e.target.value)} autoComplete="organization" className="h-12 rounded-xl bg-[var(--muted)]/30 border-[var(--border)] font-bold text-[var(--foreground)] focus-visible:ring-[var(--primary)]" />
                  </div>
                </div>
                <Button 
                  type="button" 
                  disabled={saving}
                  className="h-12 rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 px-8 font-bold uppercase tracking-widest text-[11px] shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-all gap-2"
                  onClick={() => void saveProfile()}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Appearance */}
          <motion.div variants={item}>
            <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
              <CardHeader className="pb-6 border-b border-[var(--border)]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="size-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                    <Palette className="size-5 text-violet-500" />
                  </div>
                  <CardTitle className="text-xl font-bold text-[var(--foreground)]">Appearance</CardTitle>
                </div>
                <CardDescription className="text-[var(--muted-foreground)] font-medium text-sm">
                  Switch between light and dark themes to customize your experience.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center justify-between p-5 rounded-2xl border border-[var(--border)] bg-[var(--background)]">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-[var(--foreground)]">Dark Mode</p>
                    <p className="text-xs text-[var(--muted-foreground)] font-medium">Use dark colors for a better experience at night.</p>
                  </div>
                  <Switch checked={resolved === 'dark'} onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')} className="data-[state=checked]:bg-[var(--primary)]" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right / Sidebar Column */}
        <div className="space-y-8">
          {/* Account Security */}
          <motion.div variants={item}>
            <Card className="saas-card bg-[var(--card)] border-[var(--border)]">
              <CardHeader className="pb-6 border-b border-[var(--border)]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="size-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                    <Shield className="size-5 text-rose-500" />
                  </div>
                  <CardTitle className="text-xl font-bold text-[var(--foreground)]">Security</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-8">
                   <div className="flex flex-col gap-4 mb-4">
                      <div className="space-y-1">
                         <p className="text-sm font-bold text-[var(--foreground)]">Two-Factor Authentication (2FA)</p>
                         <p className="text-xs text-[var(--muted-foreground)] font-medium">Add an extra layer of security by requiring a verification code from Google Authenticator when you log in.</p>
                      </div>
                      {mfaEnabled === true ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 w-fit mb-2">
                            <CheckCircle2 className="size-4 text-emerald-500" />
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">2FA is Enabled</span>
                          </div>
                          <Button variant="destructive" onClick={handleDisableMfa} className="w-fit h-10 px-6 rounded-lg font-bold text-xs">
                            Disable 2FA
                          </Button>
                        </div>
                      ) : mfaEnabled === false ? (
                        <Button onClick={() => setTwoFactorOpen(true)} className="w-fit h-10 px-6 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 font-bold text-xs">
                          Enable 2FA
                        </Button>
                      ) : (
                        <Button disabled className="w-fit h-10 px-6 rounded-lg bg-[var(--muted)] font-bold text-xs">
                          Checking status...
                        </Button>
                      )}
                   </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Account Status */}
          <motion.div variants={item}>
            <Card className="saas-card bg-transparent border-dashed border-[var(--border)]">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                  <Bell className="size-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Account Status</span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-widest">
                    Your Role: <span className="text-[var(--foreground)] font-bold">{profile?.role?.replace('_', ' ').toUpperCase()}</span>
                  </p>
                  {profile?.creator_application_status && profile.creator_application_status !== 'none' ? (
                    <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-widest">
                      Status: <span className="text-[var(--primary)] font-bold">{profile.creator_application_status.toUpperCase()}</span>
                    </p>
                  ) : null}
                </div>
                <p className="text-[10px] text-[var(--muted-foreground)] leading-relaxed">
                  Please contact support if you need to change your role or access level.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
      <TwoFactorDialog open={twoFactorOpen} onOpenChange={setTwoFactorOpen} onSuccess={() => setMfaEnabled(true)} />
    </div>
  )
}
