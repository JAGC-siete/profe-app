if (typeof window === 'undefined') {
  try {
    require('dotenv').config()
  } catch {
    // dotenv opcional en runtime Railway
  }
}

function getEnvVar(key: string, fallback = ''): string {
  return process.env[key] || fallback
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  NEXT_PUBLIC_SITE_URL: getEnvVar(
    'NEXT_PUBLIC_SITE_URL',
    'https://profe-app.humanosisu.net'
  ),
  SKIP_ENV_VALIDATION: getEnvVar('SKIP_ENV_VALIDATION', 'false'),
  TZ: getEnvVar('TZ', 'America/Tegucigalpa'),
  DEFAULT_TIMEZONE: getEnvVar('DEFAULT_TIMEZONE', 'America/Tegucigalpa'),
  PORT: getEnvVar('PORT', '8080'),
  HOSTNAME: getEnvVar('HOSTNAME', '0.0.0.0'),
  RESEND_API_KEY: getEnvVar('RESEND_API_KEY'),
  RAILWAY_ENVIRONMENT: getEnvVar('RAILWAY_ENVIRONMENT'),
}

export function validateEnv() {
  if (env.SKIP_ENV_VALIDATION === 'true') return
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ] as const
  const missing = required.filter((k) => !env[k])
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(', ')}`)
  }
}
