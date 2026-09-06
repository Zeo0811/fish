import express from 'express';
import compression from 'compression';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root = path.dirname(fileURLToPath(import.meta.url));
export function buildIsComplete(directory) {
  try {
    const index=fs.readFileSync(path.join(directory,'index.html'),'utf8');
    const entries=[...index.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)[^"]*"/g)].map(m=>m[1]);
    if(!index.includes('River Studio')||entries.length<2)return false;
    for(const name of [...entries,'/simple/index.html','/simple/navigation.css','/simple/vendor/three.r128.min.js']){
      if(!fs.statSync(path.join(directory,name)).isFile())return false;
    }
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'assets/credits.json'),'utf8'));
    if(!Object.keys(manifest.files).length)return false;
    return Object.entries(manifest.files).every(([name,meta])=>fs.statSync(path.join(directory,'assets',name)).size===meta.bytes);
  } catch {return false;}
}
export function createApp(directory = path.join(root, 'dist')) {
  const app = express();
  app.disable('x-powered-by');
  app.use(compression());
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.get('/healthz', (req, res) => {
    const ready = buildIsComplete(directory);
    res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'missing-build', app: 'river-studio', revision:process.env.RAILWAY_GIT_COMMIT_SHA||null });
  });
  app.use(express.static(directory, {
    dotfiles: 'deny',
    setHeaders(res, filename) {
      res.setHeader('Cache-Control', filename.endsWith('.html') ? 'no-cache' : 'public, max-age=86400');
    }
  }));
  app.use((req, res) => res.status(404).type('text/plain').send('Not found'));
  return app;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const server = createApp().listen(port, '0.0.0.0', () => console.log(`River Studio listening on 0.0.0.0:${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
}
