import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface StudioConfig {
  apiUrl: string;
  username: string;
  password: string;
}

/** 后端的 .env 和本服务在同一个仓库里。地址和账号默认照它来，mcp.json 里就不用再写一遍密码 */
const SERVER_ENV = fileURLToPath(new URL('../../server/.env', import.meta.url));

/** RCS_* 环境变量优先，用来连别的机器上的工作台，或者管理员改过密码的情况 */
export function loadConfig(): StudioConfig {
  const file = readDotEnv(SERVER_ENV);
  const env = process.env;
  return {
    apiUrl: (env.RCS_API_URL ?? `http://localhost:${file.PORT ?? '18472'}/api`).replace(/\/+$/, ''),
    username: env.RCS_USERNAME ?? file.ADMIN_USERNAME ?? '',
    password: env.RCS_PASSWORD ?? file.ADMIN_PASSWORD ?? '',
  };
}

function readDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    out[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}
