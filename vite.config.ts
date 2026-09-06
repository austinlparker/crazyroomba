import { defineConfig, type ProxyOptions } from "vite";
const apiProxy: ProxyOptions = {
  target: "http://127.0.0.1:8787",
  changeOrigin: true,
  configure(proxy) {
    proxy.on("proxyReq", (outgoing, incoming) => {
      // Development only: preserve same-origin validation across the two local ports.
      if (
        incoming.headers.origin === `http://${incoming.headers.host}` &&
        /^(127\.0\.0\.1|localhost):\d+$/.test(incoming.headers.host || "")
      ) {
        outgoing.setHeader("Origin", "http://127.0.0.1:8787");
      }
    });
  },
};
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  build: {
    manifest: true,
    target: "es2022",
    rollupOptions: { output: { manualChunks: { three: ["three"] } } },
  },
  server: {
    host: "127.0.0.1",
    watch: { usePolling: true },
    proxy: { "/api": apiProxy, "/client-metadata.json": apiProxy },
  },
});
