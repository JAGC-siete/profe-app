import Link from 'next/link'
import { useRouter } from 'next/router'
import { LogOut, ClipboardList, Plus, Library, Users, Baby } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pitch-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    if (typeof window !== 'undefined' && router.pathname !== '/app/login') {
      router.replace('/app/login')
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-pitch-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pitch-950 text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 20% -10%, rgba(16,185,129,0.35), transparent), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(5,150,105,0.2), transparent)',
        }}
      />
      <header className="relative z-10 border-b border-white/10 bg-pitch-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/app/entrenamientos" className="group flex items-center gap-2">
            <span className="font-display text-xl font-bold tracking-tight text-brand-300 group-hover:text-brand-200">
              Profe
            </span>
            <span className="hidden text-sm text-white/50 sm:inline">entrenamientos</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/app/entrenamientos"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white',
                router.pathname.startsWith('/app/entrenamientos') &&
                  router.pathname !== '/app/entrenamientos/nuevo' &&
                  router.pathname !== '/app/entrenamientos/drills' &&
                  router.pathname !== '/app/entrenamientos/profes' &&
                  router.pathname !== '/app/entrenamientos/ninos' &&
                  'bg-white/10 text-white'
              )}
            >
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Sesiones</span>
            </Link>
            <Link
              href="/app/entrenamientos/drills"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white',
                router.pathname === '/app/entrenamientos/drills' && 'bg-white/10 text-white'
              )}
            >
              <Library className="h-4 w-4" />
              <span className="hidden sm:inline">Drills</span>
            </Link>
            <Link
              href="/app/entrenamientos/profes"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white',
                router.pathname === '/app/entrenamientos/profes' && 'bg-white/10 text-white'
              )}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Profes</span>
            </Link>
            <Link
              href="/app/entrenamientos/ninos"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white',
                router.pathname === '/app/entrenamientos/ninos' && 'bg-white/10 text-white'
              )}
            >
              <Baby className="h-4 w-4" />
              <span className="hidden sm:inline">Niños</span>
            </Link>
            <Link href="/app/entrenamientos/nuevo" aria-current={router.pathname === '/app/entrenamientos/nuevo' ? 'page' : undefined}>
              <Button
                size="sm"
                className="gap-1.5"
                variant={router.pathname === '/app/entrenamientos/nuevo' ? 'secondary' : 'default'}
              >
                <Plus className="h-4 w-4" />
                Nueva
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => signOut()} title="Salir">
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
