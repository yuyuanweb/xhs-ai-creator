import type {
  BlockPatch,
  Deck,
  DraftBrief,
  DraftImportResult,
  ExternalLayout,
  ExternalReviseResult,
  SourceArticle,
} from '@rcs/shared';
import type { StudioConfig } from './config.js';

export interface ArticleSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Envelope<T> {
  code: number;
  data: T;
  message: string;
}

/** 工作台后端的 HTTP 客户端。首次调用时登录，令牌过期自动重登一次 */
export class StudioApi {
  private token?: string;

  constructor(private readonly config: StudioConfig) {}

  listArticles = () => this.request<ArticleSummary[]>('GET', '/articles');
  createArticle = (markdown: string, title?: string) => this.request<SourceArticle>('POST', '/articles', { markdown, title });
  listDecks = (articleId: string) => this.request<Deck[]>('GET', `/decks?articleId=${encodeURIComponent(articleId)}`);
  createDeck = (articleId: string) => this.request<Deck>('POST', '/decks', { articleId });
  getDeck = (deckId: string) => this.request<Deck>('GET', `/decks/${deckId}`);
  brief = (deckId: string) => this.request<DraftBrief>('GET', `/agent/decks/${deckId}/brief`);
  importDraft = (deckId: string, draft: unknown) => this.request<DraftImportResult>('POST', `/agent/decks/${deckId}/import`, { draft });
  supplement = (deckId: string, blocks: unknown[]) =>
    this.request<DraftImportResult>('POST', `/agent/decks/${deckId}/supplement`, { blocks });
  layout = (deckId: string) => this.request<ExternalLayout>('GET', `/agent/decks/${deckId}/layout`);
  revise = (deckId: string, patches: BlockPatch[]) =>
    this.request<ExternalReviseResult>('POST', `/agent/decks/${deckId}/revise`, { patches });

  private async login(): Promise<string> {
    if (this.token) return this.token;
    const { username, password } = this.config;
    if (!username || !password) {
      throw new Error('没有工作台账号：在 apps/server/.env 里配置 ADMIN_USERNAME / ADMIN_PASSWORD，或给 MCP 设置 RCS_USERNAME / RCS_PASSWORD');
    }
    const { token } = await this.send<{ token: string }>('POST', '/auth/login', { username, password });
    this.token = token;
    return token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    try {
      return await this.send<T>(method, path, body, await this.login());
    } catch (err) {
      if (!(err instanceof UnauthorizedError)) throw err;
      this.token = undefined;
      return this.send<T>(method, path, body, await this.login());
    }
  }

  private async send<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.config.apiUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (err) {
      throw new Error(`连不上工作台后端 ${this.config.apiUrl}，先在仓库根目录执行 pnpm dev 把服务跑起来（${(err as Error).message}）`);
    }

    const payload = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (res.status === 401 && token) throw new UnauthorizedError();
    if (!res.ok || !payload || payload.code !== 0) {
      throw new Error(`工作台返回 ${res.status}：${payload?.message ?? '无法解析的响应'}`);
    }
    return payload.data;
  }
}

class UnauthorizedError extends Error {}
