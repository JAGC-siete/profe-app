# Profe App

SaaS multi-tenant (por `company_id`) para planificar hojas de entrenamiento. Stack alineado con el arquetipo Pages Router + Supabase + Railway del proyecto SaaS existente.

**Producción:** [https://profe-app.humanosisu.net](https://profe-app.humanosisu.net)  
**Repo:** [github.com/JAGC-siete/profe-app](https://github.com/JAGC-siete/profe-app)

## Stack

- **Pages Router** bajo `pages/app/entrenamientos/`
- **Auth / multitenencia:** `requireCompanyAccess` (`lib/auth/api-auth-fixed.ts`)
- **Supabase** + RLS por `company_id`
- **Zod** para validación de hoja
- **Timezone Honduras:** `lib/timezone.ts`
- **Email:** Resend vía `lib/resend-from.ts`
- **Deploy:** Railway standalone (`PORT=8080`, `TZ=America/Tegucigalpa`), health en `/api/health`

## Setup local

```bash
cp env.example .env.local
# completar NEXT_PUBLIC_SUPABASE_* y SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

Aplicar migración:

```bash
npx supabase db push
# o ejecutar supabase/migrations/20261002130000_profe_core_and_training.sql
```

Crear un tenant de prueba: fila en `companies`, usuario en Auth, fila en `user_profiles` con ese `company_id` y `role = 'coach'`.

## Rutas

| Ruta | Uso |
|------|-----|
| `/app/login` | Login |
| `/app/entrenamientos` | Lista / filtro por categoría |
| `/app/entrenamientos/nuevo` | Formulario Zod + upload diagrama |
| `/app/entrenamientos/[id]` | Vista hoja + print/PDF + share Resend |
| `/api/health` | Healthcheck Railway |
