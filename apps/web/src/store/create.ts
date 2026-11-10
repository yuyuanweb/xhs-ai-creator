import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { articleApi, deckApi } from '../api/endpoints';
import { errorText } from '../ui/feedback';

export type CreateMode = 'file' | 'paste';

export const MARKDOWN_EXT = /\.(md|markdown|txt)$/i;
export const MIN_LENGTH = 50;

interface CreateState {
  dialog: CreateMode | null;
  busy: boolean;
  error: string;
  open: (mode: CreateMode) => void;
  close: () => void;
  fail: (error: string) => void;
}

/** 新建入口散在侧边栏、首页和整页拖放上，状态放一处，忙碌遮罩和报错才不会各显示各的 */
export const useCreate = create<CreateState>((set, get) => ({
  dialog: null,
  busy: false,
  error: '',
  open: (dialog) => set({ dialog, error: '' }),
  close: () => {
    if (!get().busy) set({ dialog: null, error: '' });
  },
  fail: (error) => set({ error }),
}));

export async function readMarkdownFile(file: File): Promise<{ text: string; title?: string }> {
  if (!MARKDOWN_EXT.test(file.name)) throw new Error('请选择 .md、.markdown 或 .txt 文件');
  const text = (await file.text()).replace(/^\uFEFF/, '');
  if (text.trim().length < MIN_LENGTH) throw new Error('文件内容太短，看起来不是一篇长图文');
  const title = file.name.replace(MARKDOWN_EXT, '').trim();
  return { text, title: title || undefined };
}

/** 建文章、建稿子、进编辑台并自动开写初稿 */
export function useCreateArticle() {
  const navigate = useNavigate();

  const fromText = useCallback(
    async (markdown: string, title?: string) => {
      if (useCreate.getState().busy) return;
      useCreate.setState({ busy: true, error: '' });
      try {
        const article = await articleApi.create(markdown, title);
        const deck = await deckApi.create(article.id);
        useCreate.setState({ busy: false, dialog: null });
        navigate(`/decks/${deck.id}`);
      } catch (err) {
        useCreate.setState({ busy: false, error: errorText(err, '创建失败，请重试') });
      }
    },
    [navigate],
  );

  const fromFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        const { text, title } = await readMarkdownFile(file);
        await fromText(text, title);
      } catch (err) {
        useCreate.setState({ dialog: useCreate.getState().dialog ?? 'file', error: errorText(err) });
      }
    },
    [fromText],
  );

  return { fromText, fromFile };
}
