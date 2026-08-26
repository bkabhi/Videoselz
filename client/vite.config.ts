import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:4400';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        // Vite 7 uses Dart Sass's modern compiler API unconditionally; the
        // `api` option that selected it on Vite 5/6 no longer exists.
        //
        // Tokens and mixins are injected into every module so no component
        // has to remember to `@use` them, and so a stray hex value in a
        // component stands out as the exception it is.
        additionalData: `@use "@/styles/_tokens.scss" as *;\n@use "@/styles/_mixins.scss" as *;\n`,
      },
    },
    modules: {
      // Readable class names in dev tooling; hashed in production.
      generateScopedName:
        process.env.NODE_ENV === 'production'
          ? '[hash:base64:6]'
          : '[name]__[local]--[hash:base64:4]',
    },
  },

  server: {
    port: 5173,
    // The dev server proxies /api to Express, so the browser only ever talks
    // to one origin. That removes CORS from the local development path
    // entirely — the server still sets CORS headers for direct API clients.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
    // Required to read ../shared from outside the Vite root.
    fs: { allow: ['..'] },
  },

  // `vite preview` serves the production bundle but does NOT inherit
  // `server.proxy`, so without this `npm run preview` would 404 on every
  // /api call and look broken. Same target, so the built app can be checked
  // against the real API.
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
