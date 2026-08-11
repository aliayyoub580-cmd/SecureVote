import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { motion, type Variants } from 'framer-motion'
import { User, Palette, Shield, Mail, Bell, Loader2, Sparkles, UserCircle, Settings, ShieldCheck, AtSign, Globe, MapPin, Camera, Image } from 'lucide-react'
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
  const [username, setUsername] = useState((profile as any)?.username ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [organization, setOrganization] = useState(profile?.organization ?? '')
  const [bio, setBio] = useState((profile as any)?.bio ?? '')
  const [location, setLocation] = useState((profile as any)?.location ?? '')
  const [website, setWebsite] = useState((profile as any)?.website ?? '')
  const [avatarPath, setAvatarPath] = useState((profile as any)?.avatar_path ?? '')
  const [bannerPath, setBannerPath] = useState((profile as any)?.banner_path ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    setName(profile?.full_name ?? '')
    setUsername((profile as any)?.username ?? '')
    setPhone(profile?.phone ?? '')
    setOrganization(profile?.organization ?? '')
    setBio((profile as any)?.bio ?? '')
    setLocation((profile as any)?.location ?? '')
    setWebsite((profile as any)?.website ?? '')
    setAvatarPath((profile as any)?.avatar_path ?? '')
    setBannerPath((profile as any)?.banner_path ?? '')
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file)
      if (upErr) throw upErr
      const publicUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      setAvatarPath(publicUrl)
      toast.success('Avatar uploaded successfully.')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload avatar.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      await profilesService.updateSelf({
        full_name: name.trim() || null,
        username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || null,
        phone: phone.trim() || null,
        organization: organization.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
        avatar_path: avatarPath.trim() || null,
        banner_path: bannerPath.trim() || null,
      })
      await refreshProfile()
      toast.success('Profile settings updated successfully!')
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
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Account Settings</p>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[var(--foreground)] tracking-tight">Edit Profile & Settings</h1>
        <p className="max-w-2xl text-[var(--muted-foreground)] font-medium text-sm sm:text-base">
          Update your personal details, social feed profile, appearance preferences, and account security.
        </p>
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-8 lg:grid-cols-3">
        {/* Left / Main Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Personal & Social Profile Information */}
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
                  <CardTitle className="text-xl font-bold text-[var(--foreground)]">Profile Information</CardTitle>
                </div>
                <CardDescription className="text-[var(--muted-foreground)] font-medium text-sm">
                  Manage both your Portal account details and public Social Feed profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 space-y-8 relative z-10">
                
                {/* Avatar Preview & Upload */}
                <div className="flex items-center gap-5 p-4 rounded-2xl bg-[var(--muted)]/20 border border-[var(--border)]">
                  <div className="relative size-16 rounded-full overflow-hidden bg-[var(--muted)] border border-[var(--border)] shrink-0 flex items-center justify-center">
                    {avatarPath ? (
                      <img src={avatarPath} alt="Avatar" className="size-full object-cover" />
                    ) : (
                      <User className="size-8 text-[var(--muted-foreground)]" />
                    )}
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="size-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 flex-1">
                    <p className="text-xs font-bold text-[var(--foreground)]">Profile Avatar</p>
                    <p className="text-[11px] text-[var(--muted-foreground)]">JPG, PNG or WEBP up to 5MB.</p>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-[11px] font-bold cursor-pointer hover:opacity-90 transition-all mt-1">
                      <Camera className="size-3.5" />
                      <span>{uploadingAvatar ? 'Uploading...' : 'Upload Image'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                    </label>
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Full Name</Label>
                    <Input id="fullName" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl bg-[var(--muted)]/30 border-[var(--border)] font-bold text-[var(--foreground)] focus-visible:ring-[var(--primary)]" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] flex items-center gap-1">
                      <AtSign className="size-3 text-[var(--primary)]" /> Username
                    </Label>
                    <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. atifayyoub" className="h-12 rounded-xl bg-[var(--muted)]/30 border-[var(--border)] font-bold text-[var(--foreground)] focus-visible:ring-[var(--primary)]" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Email Address (Primary)</Label>
                    <Input value={email} disabled className="h-12 rounded-xl bg-[var(--muted)]/50 border-[var(--border)] font-bold text-[var(--muted-foreground)] cursor-not-allowed opacity-60" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Phone Number</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className="h-12 rounded-xl bg-[var(--muted)]/30 border-[var(--border)] font-bold text-[var(--foreground)] focus-visible:ring-[var(--primary)]" />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="bio" className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Bio / About</Label>
                    <Input id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Write a short summary about yourself..." className="h-12 rounded-xl bg-[var(--muted)]/30 border-[var(--border)] font-medium text-[var(--foreground)] focus-visible:ring-[var(--primary)]" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] flex items-center gap-1">
                      <MapPin className="size-3 text-[var(--primary)]" /> Location
                    </Label>
                    <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Islamabad, Pakistan" className="h-12 rounded-xl bg-[var(--muted)]/30 border-[var(--border)] font-bold text-[var(--foreground)] focus-visible:ring-[var(--primary)]" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website" className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] flex items-center gap-1">
                      <Globe className="size-3 text-[var(--primary)]" /> Website URL
                    </Label>
                    <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" className="h-12 rounded-xl bg-[var(--muted)]/30 border-[var(--border)] font-bold text-[var(--foreground)] focus-visible:ring-[var(--primary)]" />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="organization" className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Organization / Affiliation</Label>
                    <Input id="organization" value={organization} onChange={(e) => setOrganization(e.target.value)} autoComplete="organization" className="h-12 rounded-xl bg-[var(--muted)]/30 border-[var(--border)] font-bold text-[var(--foreground)] focus-visible:ring-[var(--primary)]" />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="banner" className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] flex items-center gap-1">
                      <Image className="size-3 text-[var(--primary)]" /> Cover Banner Image URL
                    </Label>
                    <Input id="banner" value={bannerPath} onChange={(e) => setBannerPath(e.target.value)} placeholder="https://images.unsplash.com/..." className="h-12 rounded-xl bg-[var(--muted)]/30 border-[var(--border)] font-medium text-[var(--foreground)] focus-visible:ring-[var(--primary)]" />
                  </div>
                </div>

                <Button 
                  type="button" 
                  disabled={saving}
                  className="h-12 rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 px-8 font-bold uppercase tracking-widest text-[11px] shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-all gap-2"
                  onClick={() => void saveProfile()}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  Save Profile Changes
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Appearance Settings */}
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
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                    Two-Factor Authentication (2FA) adds an extra layer of security to your account.
                  </p>
                  {mfaEnabled ? (
                    <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-5 text-emerald-500" />
                        <span className="text-xs font-bold text-emerald-500">2FA Enabled</span>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs font-bold text-rose-400 border-rose-500/30 hover:bg-rose-500/10" onClick={handleDisableMfa}>
                        Disable 2FA
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" className="w-full h-11 rounded-xl bg-[var(--primary)] text-white font-bold text-xs" onClick={() => setTwoFactorOpen(true)}>
                      Enable 2FA
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>

      <TwoFactorDialog open={twoFactorOpen} onOpenChange={setTwoFactorOpen} />
    </div>
  )
}
