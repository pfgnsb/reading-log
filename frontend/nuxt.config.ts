export default defineNuxtConfig({
  srcDir: "app",
  ssr: false,
  compatibilityDate: "2026-10-27",
  devtools: { enabled: false },
  css: ["~/assets/main.css"],
  app: {
    head: {
      title: "読書記録",
      htmlAttrs: { lang: "ja" },
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" }
      ]
    }
  },
  vite: {
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8787",
          changeOrigin: true
        }
      }
    }
  }
})
