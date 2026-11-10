import type {
  Deck,
  DeckSettings,
  DraftProposal,
  SourceArticle,
  SourceImage,
  CardBlock,
  ContentType,
  CoverSpec,
  PageOverlay,
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
  remove: (id: string) => api.del<{ ok: boolean }>(`/articles/${id}`),
};

export interface DeckPatch {
  contentType?: ContentType;
  blocks?: CardBlock[];
  cover?: CoverSpec;
  settings?: DeckSettings;
  disabledBlockIds?: string[];
  overlays?: PageOverlay[];
  status?: Deck['status'];
}


export const deckApi = {
  create: (articleId: string) => api.post<Deck>('/decks', { articleId }),
  listByArticle: (articleId: string) => api.get<Deck[]>(`/decks?articleId=${articleId}`),
  get: (id: string) => api.get<Deck>(`/decks/${id}`),
  update: (id: string, patch: DeckPatch) => api.patch<Deck>(`/decks/${id}`, patch),
  remove: (id: string) => api.del<{ ok: boolean }>(`/decks/${id}`),
};

export const agentApi = {
  draft: (deckId: string, model?: string, signal?: AbortSignal) =>
    api.post<DraftProposal>(`/agent/decks/${deckId}/draft`, { model }, { signal }),
};

export const libraryApi = {
  list: () => api.get<LibraryItem[]>('/library'),
};

export const promptApi = {
  list: () => api.get<PromptRow[]>('/prompts'),
  update: (key: string, content: string) => api.put<PromptRow>(`/prompts/${key}`, { content }),
  reset: (key: string) => api.post<PromptRow>(`/prompts/${key}/reset`),
};
