import { defineConfig } from 'vite';
export default defineConfig({
  plugins:[{name:'bundled-simple-entry',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url==='/simple/')req.url='/simple/index.html';next();});}}],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } }
  }
});
