import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "https://api.webflow.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, _req, _res) => {
            proxyReq.removeHeader("x-forwarded-host")
            proxyReq.removeHeader("x-forwarded-proto")
            proxyReq.removeHeader("x-forwarded-for")
          })
        },
      },
      "/tinify": {
        target: "https://api.tinify.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tinify/, ""),
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, _req, _res) => {
            proxyReq.removeHeader("x-forwarded-host")
            proxyReq.removeHeader("x-forwarded-proto")
            proxyReq.removeHeader("x-forwarded-for")
          })
        },
      },
    },
  },
})
