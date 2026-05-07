import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
  ],
  optimizeDeps: {
    exclude: ['@zama-fhe/relayer-sdk', 'tfhe', 'node-tfhe']
  },
  worker: {
    // Treat worker files as ES modules so they can import the SDK
    format: 'es',
    plugins: () => [
      nodePolyfills(),
    ],
  },
})
