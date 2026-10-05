import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  LayoutDashboard,
  Layers,
  Users,
  Baby,
  ClipboardList,
  Library,
  UserCog,
  ArrowLeft,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

const NAV = [
  { href: '/app/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/app/admin/categorias', label: 'Categorías', icon: Layers },
  { href: '/app/admin/profes', label: 'Entrenadores', icon: Users },
  { href: '/app/admin/ninos', label: 'Niños', icon: Baby },
  { href: '/app/admin/sesiones', label: 'Sesiones', icon: ClipboardList },
  { href: '/app/admin/drills', label: 'Drills', icon: Library },
  { href: '/app/admin/usuarios', label: 'Usuarios', icon: UserCog },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, signOut } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      void router.replace('/app/login')
      return
    }
    if (!isAdmin) {
      void router.replace('/app/entrenamientos')
    }
  }, [loading, user, isAdmin, router])

  if (loading || !user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pitch-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      </div>
    )
  }

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.exact
          ? router.pathname === item.href
          : router.pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white',
              active && 'bg-white/10 text-white'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen bg-pitch-950 text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 20% -10%, rgba(16,185,129,0.35), transparent), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(5,150,105,0.2), transparent)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl">
        <aside className="hidden w-56 shrink-0 border-r border-white/10 bg-pitch-900/60 p-4 backdrop-blur-md md:block">
          <Link href="/app/admin" className="mb-6 block">
            <span className="font-display text-xl font-bold text-brand-300">Profe</span>
            <span className="mt-0.5 block text-xs text-white/45">Admin academia</span>
          </Link>
          <NavLinks />
          <div className="mt-8 space-y-1 border-t border-white/10 pt-4">
            <Link
              href="/app/entrenamientos"
              className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a app
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/10 bg-pitch-900/80 px-4 py-3 backdrop-blur-md md:hidden">
            <div>
              <p className="font-display text-lg font-bold text-brand-300">Profe Admin</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </header>

          {open && (
            <div className="border-b border-white/10 bg-pitch-900/95 p-4 md:hidden">
              <NavLinks onNavigate={() => setOpen(false)} />
              <div className="mt-4 space-y-1 border-t border-white/10 pt-3">
                <Link
                  href="/app/entrenamientos"
                  onClick={() => setOpen(false)}
                  className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver a app
                </Link>
              </div>
            </div>
          )}

          <main className="flex-1 px-4 py-8 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  )
}
