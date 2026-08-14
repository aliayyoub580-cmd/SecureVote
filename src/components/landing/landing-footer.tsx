import { Link } from 'react-router-dom'
import { Sparkles, ShieldCheck, Mail, Twitter, Github } from 'lucide-react'

import { APP_NAME, ROUTES } from '@/constants/routes'

const cols = [
  {
    title: 'Platform',
    links: [
      { label: 'Statistics', href: '#stats' },
      { label: 'Elections', href: '#elections' },
      { label: 'Features', href: '#features' },
      { label: 'How it Works', href: '#solutions' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign In', href: ROUTES.login },
      { label: 'Create Account', href: ROUTES.register },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '#' },
      { label: 'Terms of Service', href: '#' },
      { label: 'Security Standards', href: '#' },
    ],
  },
]

export function LandingFooter() {
  return (
    <footer className="relative border-t border-border bg-background pt-20 pb-12 overflow-hidden transition-colors duration-500">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5 border-b border-border pb-16">
          <div className="lg:col-span-2 space-y-8">
            <Link to={ROUTES.home} className="flex items-center gap-3 font-black tracking-tighter">
              <div className="flex size-10 items-center justify-center rounded-xl bg-transparent overflow-hidden">
                <img src="/logo.png" alt="SecureVote" className="size-full object-contain" />
              </div>
              <span className="text-2xl text-foreground">{APP_NAME}</span>
            </Link>
            <p className="max-w-md text-base font-medium leading-relaxed text-muted-foreground">
              A professional and secure voting platform for organizations that value transparency and integrity. Simple to use, impossible to tamper with.
            </p>
            <div className="flex items-center gap-3">
              {[Twitter, Github, Mail].map((Icon, i) => (
                <a key={i} href="#" className="flex size-10 items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors">
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>
          
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="mb-6 text-[11px] font-bold uppercase tracking-widest text-foreground">{c.title}</h4>
              <ul className="space-y-4">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith('#') ? (
                      <a href={l.href} className="text-sm font-bold text-muted-foreground transition-colors hover:text-primary">
                        {l.label}
                      </a>
                    ) : (
                      <Link to={l.href} className="text-sm font-bold text-muted-foreground transition-colors hover:text-primary">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="mt-8 flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[var(--accent-primary)]" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              © {new Date().getFullYear()} {APP_NAME} Platform.
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            <span>Status: <span className="text-[var(--accent-primary)]">Operational</span></span>
          </div>
        </div>
      </div>
    </footer>
  )
}
