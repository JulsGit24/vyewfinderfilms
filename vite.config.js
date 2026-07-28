import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Redirect all non-file requests to index.html for SPA routing
    historyApiFallback: true
  }
});
