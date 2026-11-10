import type { Plugin, ServerOptions } from 'vite';

/** 内网穿透的域名，比如 frp 映射出来的 studio.example.com。不配就只在本机访问 */
export const TUNNEL_HOST = process.env.TUNNEL_HOST?.trim() || '';

/** 让 dev server 听 IPv4，并放行已配好的穿透域名 */
export function tunnelListen(): Pick<ServerOptions, 'host' | 'allowedHosts'> {
  return {
    host: true,
    allowedHosts: TUNNEL_HOST ? [TUNNEL_HOST] : [],
  };
}

/**
 * HMR 跟当前页面走：本机仍是 ws://localhost:18473，
 * 经 https 穿透域名进来则用 wss 443，避免写死端口后两边互斥。
 */
export function pageScopedHmr(): Plugin {
  return {
    name: 'page-scoped-hmr',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/vite/dist/client/client.mjs')) return;
      return code.replace(
        'const hmrPort = __HMR_PORT__;',
        'const hmrPort = importMetaUrl.port || (importMetaUrl.protocol === "https:" ? "443" : "80");',
      );
    },
  };
}
