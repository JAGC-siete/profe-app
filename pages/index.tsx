import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/app/entrenamientos')
  }, [router])

  return (
    <>
      <Head>
        <title>Profe</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      </div>
    </>
  )
}
