import React from 'react'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { DM_Sans, Syne } from 'next/font/google'
import { AuthProvider } from '../lib/auth'
import AppShell from '../components/AppShell'
import { cn } from '../lib/utils'
import '../styles/globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
})

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const isLogin = router.pathname === '/app/login'
  const isCampo = router.pathname === '/app/entrenamientos/[id]/campo'
  const isAppRoute =
    router.pathname.startsWith('/app') && !isLogin

  return (
    <div className={cn(dmSans.variable, syne.variable, 'font-sans')}>
      {isCampo ? (
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      ) : isAppRoute ? (
        <AuthProvider>
          <AppShell>
            <Component {...pageProps} />
          </AppShell>
        </AuthProvider>
      ) : isLogin ? (
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      ) : (
        <Component {...pageProps} />
      )}
    </div>
  )
}
