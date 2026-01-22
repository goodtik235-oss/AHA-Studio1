import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Retrieve the API key from various potential sources:
  // 1. process.env (Vercel System Env / Node context)
  // 2. env object (loaded from .env files)
  // We check for both API_KEY and VITE_API_KEY for flexibility.
  const apiKey = process.env.API_KEY || process.env.VITE_API_KEY || env.API_KEY || env.VITE_API_KEY;

  return {
    plugins: [react()],
    define: {
      // This "bakes" the API key into the client-side code at build time.
      // This fulfills the requirement to use process.env.API_KEY in the code
      // while allowing Vercel to inject it during the build.
      'process.env.API_KEY': JSON.stringify(apiKey)
    },
    build: {
      outDir: 'dist',
    }
  };
});