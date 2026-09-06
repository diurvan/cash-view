# cashview

PWA de control financiero personal conectada a Google Sheets. Lleva tus ingresos y gastos en un Excel en Google Drive, y esta app te permite verlos, registrarlos y analizarlos (consolidados, gráficos, historial).

## Stack

- **Next.js 16** (App Router, React 19)
- **Tailwind CSS v4**
- **Google Sheets API v4** + **Google OAuth 2.0**
- Sesiones HTTP-only firmadas con `jose` (JWT)

## Requisitos

- Node.js 20+
- Una cuenta de Google
- Un Google Sheets con tus ingresos/gastos (privado)

## Configuración

### 1. Crear el proyecto en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com) e inicia sesión con la cuenta que usará la app (ej: `IVAN.TAPIA@DIURVANCONSULTORES.COM`).
2. Crea un proyecto nuevo:
   - Provider **Nombre**: `cashview`
   - Clic en **CREAR**.
3. **Habilita las APIs**:
   - Ve a **APIs y servicios → Biblioteca**.
   - Busca y habilita **Google Sheets API**.
   - Busca y habilita **Google Drive API**.
4. **Crea la pantalla de consentimiento OAuth**:
   - Ve a **APIs y servicios → Pantalla de consentimiento de OAuth**.
   - Tipo de usuario: **Externo** (aunque la uses solo tú).
   - Datos de la app: nombre `cashview`, email de soporte/contacto.
   - **Scopes**: agrega `https://www.googleapis.com/auth/spreadsheets` (lee y escribe hojas de cálculo) y `https://www.googleapis.com/auth/drive.readonly` (lista tus hojas para el visor de documentos).
   - **Test users**: agrega tu correo y el de quien vayas a compartir la app mientras está en modo prueba.
5. **Crea credenciales OAuth 2.0**:
   - Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**.
   - Tipo de aplicación: **Aplicación web**.
   - Nombre: `cashview-web`.
   - **URIs de redireccionamiento autorizados**:
     - Local: `http://localhost:3000/api/auth/callback`
     - Producción: `https://TU-DOMINIO.vercel.app/api/auth/callback` (cuando tengas el dominio).
   - Clic en **CREAR**.
   - Copia el **ID de cliente** y el **Secreto** mostrados en el modal.

### 2. Configurar variables de entorno

Copia `.env.example` a `.env.local` y rellena:

```bash
GOOGLE_CLIENT_ID=<id de cliente>
GOOGLE_CLIENT_SECRET=<secreto de cliente>
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=<cadena aleatoria larga, ej: openssl rand -hex 32>
```

> En producción, configura estas variables en el proyecto de Vercel: **Settings → Environment Variables**, usando la URL real de producción en `NEXT_PUBLIC_APP_URL`.

### 3. Compartir el Google Sheets con el usuario

Google Sheets debe estar compartido con la cuenta que autorice la app, o el usuario debe ser dueño de la hoja. La app accede con la sesión del propio usuario (sus propios permisos), así que cada usuario puedes usar **su propio spreadsheet** o compartir el tuyo con él.

### 4. Ejecutar

```bash
npm install
cp .env.example .env.local   # rellena los valores
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Estructura

```
src/
├── app/
│   ├── api/
│   │   └── auth/          # login, callback, me, logout (OAuth Google)
│   ├── dashboard/         # panel principal (autenticado)
│   ├── login/             # pantalla de acceso
│   ├── layout.tsx
│   └── page.tsx           # redirige según sesión
├── components/
│   ├── logo.tsx           # logo, céntralizado en lib/brand.ts
│   └── login-form.tsx     # botón "Continúa con Google"
└── lib/
    ├── brand.ts           # colores/nombre de la marca (cambiables en 1 lugar)
    ├── google.ts          # utils OAuth/Google Sheets
    └── session.ts         # cookies JWT http-only
```

## Deploy en Vercel

1. Sube el repo a GitHub.
2. Importa el proyecto en [vercel.com](https://vercel.com).
3. Añade las variables de entorno (mismas que en local, con la URL real).
4. Añade la URL real de producción como URI de redireccionamiento autorizado en Google Cloud.
5. Publica la app en la **pantalla de consentimiento de OAuth** si quieres usarla fuera de los test users.