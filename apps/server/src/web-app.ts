import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { Express } from 'express';
import express from 'express';

function isBackendPath(path: string) {
  return path === '/api' || path.startsWith('/api/') || path === '/static' || path.startsWith('/static/');
}

/** 优先用 WEB_DIST，否则找同仓 apps/web/dist */
export function resolveWebDist(explicit?: string): string | null {
  const candidates = [explicit, process.env.WEB_DIST, join(__dirname, '..', '..', 'web', 'dist')].filter(
    (v): v is string => Boolean(v),
  );
  for (const dir of candidates) {
    const abs = resolve(dir);
    if (existsSync(join(abs, 'index.html'))) return abs;
  }
  return null;
}

/** 把打包后的 SPA 挂到 Express 最前面，/api、/static 仍交给 Nest */
export function mountWebApp(server: Express, webDist: string) {
  const index = join(webDist, 'index.html');
  server.use(express.static(webDist, { index: false, fallthrough: true }));
  server.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (isBackendPath(req.path)) return next();
    if (extname(req.path)) return next();
    res.sendFile(index);
  });
}
