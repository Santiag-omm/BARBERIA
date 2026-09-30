# BarberShop

## Desarrollo local

```powershell
npm install
npm run dev
```

## Proteger el panel administrativo

1. Crea un proyecto en [Supabase](https://supabase.com) y habilita el proveedor **Email** en Authentication.
2. En **Authentication > Users**, crea el usuario administrador con email y contraseña.
3. Copia `.env.example` como `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` desde **Project Settings > API**.
4. En Supabase, configura la URL de producción y las redirect URLs autorizadas en **Authentication > URL Configuration**.
5. En Vercel, añade las mismas variables de entorno en **Settings > Environment Variables** y vuelve a desplegar.

La clave `anon` puede estar en el navegador; no incluyas una `service_role` en Vercel ni en archivos frontend. La seguridad de los datos debe aplicarse con políticas RLS de Supabase cuando se conecte una base de datos.# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
