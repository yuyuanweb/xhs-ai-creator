import type {
  AgentMessage,
  AgentStepResponse,
  Deck,
  DeckSettings,
  DeckSync,
  LayoutUpload,
  DraftProposal,
  SourceArticle,
  SourceImage,
  CardBlock,
  ContentType,
  CoverSpec,
  AiSnapshot,
  PageOverlay,
  RewritePageInput,
  RewritePagesResult,
} from '@rcs/shared';
import { api } from './client';

export interface ArticleSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/** 首页作品卡片：文章 + 最近编辑那份稿子的封面数据 */
export interface LibraryItem {
  articleId: string;
  title: string;
  chars: number;
  imageCount: number;
  createdAt: string;
  updatedAt: string;
  deck: {
    id: string;
    status: Deck['status'];
    blockCount: number;
    cover: CoverSpec;
    settings: DeckSettings;
    overlays: PageOverlay[];
  } | null;
  coverImages: SourceImage[];
  /** 编辑台打开过才有；服务重启后为空 */
  layout: { cards: number; thin: number; overflow: number } | null;
}

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export interface PromptRow {
  key: string;
  title: string;
  content: string;
  updatedAt: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; user: AuthUser }>('/auth/login', { username, password }),
  me: () => api.get<AuthUser>('/auth/me'),
};

export const articleApi = {
  create: (markdown: string, title?: string) =>
    api.post<SourceArticle>('/articles', { markdown, title }),
  list: () => api.get<ArticleSummary[]>('/articles'),
  get: (id: string) => api.get<SourceArticle>(`/articles/${id}`),
  retryImages: (id: string) => api.post<SourceArticle>(`/articles/${id}/retry-images`),
  uploadImage: (id: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return api.post<SourceArticle>(`/articles/${id}/images`, body);
  },
  remove: (id: string) => api.del<{ ok: boolean }>(`/articles/${id}`),
};

export interface DeckPatch {
  contentType?: ContentType;
  blocks?: CardBlock[];
  cover?: CoverSpec;
  settings?: DeckSettings;
  disabledBlockIds?: string[];
  overlays?: PageOverlay[];
  aiSnapshot?: AiSnapshot | null;
  status?: Deck['status'];
}


export const deckApi = {
  create: (articleId: string) => api.post<Deck>('/decks', { articleId }),
  listByArticle: (articleId: string) => api.get<Deck[]>(`/decks?articleId=${articleId}`),
  get: (id: string) => api.get<Deck>(`/decks/${id}`),
  update: (id: string, patch: DeckPatch) => api.patch<Deck>(`/decks/${id}`, patch),
  remove: (id: string) => api.del<{ ok: boolean }>(`/decks/${id}`),
  uploadLayout: (id: string, upload: LayoutUpload) => api.put<{ ok: boolean }>(`/decks/${id}/layout`, upload),
  sync: (id: string) => api.get<DeckSync>(`/decks/${id}/sync`),
};

export const agentApi = {
  draft: (deckId: string, model?: string, signal?: AbortSignal) =>
    api.post<DraftProposal>(`/agent/decks/${deckId}/draft`, { model }, { signal }),
  step: (deckId: string, messages: AgentMessage[], model?: string, signal?: AbortSignal) =>
    api.post<AgentStepResponse>(`/agent/decks/${deckId}/step`, { messages, model }, { signal }),
  rewritePages: (deckId: string, pages: RewritePageInput[], model?: string, signal?: AbortSignal) =>
    api.post<RewritePagesResult>(`/agent/decks/${deckId}/rewrite-pages`, { pages, model }, { signal }),
  rewriteBlock: (deckId: string, blockId: string, model?: string, signal?: AbortSignal) =>
    api.post<CardBlock>(`/agent/decks/${deckId}/rewrite-block`, { blockId, model }, { signal }),
};

export const libraryApi = {
  list: () => api.get<LibraryItem[]>('/library'),
};

export const promptApi = {
  list: () => api.get<PromptRow[]>('/prompts'),
  update: (key: string, content: string) => api.put<PromptRow>(`/prompts/${key}`, { content }),
  reset: (key: string) => api.post<PromptRow>(`/prompts/${key}/reset`),
};
