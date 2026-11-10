import { findTheme, type CardBlock, type DeckSettings, type LayoutPage, type PageOverlay, type SourceImage } from '@rcs/shared';
import { BlockView } from './BlockView';
import { ThemeDecor } from './decor/ThemeDecor';
import type { LiveEdit } from './live-edit';
import { OverlayLayer, type OverlayLive } from './OverlayLayer';
import { PageFoot, PageHead } from './PageChrome';
import { themeVars } from './theme-vars';

export interface ContentCardProps {
  page: LayoutPage;
  blocks: Map<string, CardBlock>;
  images: Map<string, SourceImage>;
  settings: DeckSettings;
  pageNo: number;
  total: number;
  live?: LiveEdit;
  overlays?: PageOverlay[];
  overlayLive?: OverlayLive;
}

export function ContentCard({ page, blocks, images, settings, pageNo, total, live, overlays, overlayLive }: ContentCardProps) {
  const theme = findTheme(settings.themeId);

  return (
    <div
      className={`card${settings.marker ? '' : ' no-marker'}${live ? ' is-live' : ''}`}
      data-mode={theme.mode}
      style={themeVars(theme, settings)}
      onClick={() => {
        live?.onSelect?.(null);
        overlayLive?.onSelect?.(null);
      }}
    >
      <ThemeDecor mode={theme.mode} enabled={settings.decor} target={{ pageNo }} />
      <PageHead
        mode={theme.mode}
        settings={settings}
        section={page.section || '开篇'}
        chapter={page.chapter}
        continued={page.continued && pageNo > 2}
        live={live}
      />

      {/* 内容一律顶对齐。用上下留白把内容夹到页面中段只是把空白挪个位置，不算排版 */}
      <div className="c-body">
        {page.blockIds.map((id) => {
          const b = blocks.get(id);
          if (!b) return null;
          return (
            <div key={id} className="b-hit" data-block-id={id}>
              <BlockView
                block={b}
                images={images}
                scale={page.imageScales?.[id] ?? 1}
                live={
                  live
                    ? {
                        selected: live.selectedId === id,
                        disabled: live.disabled,
                        onSelect: () => live.onSelect?.(id),
                        onText: (text) => live.onText?.(id, text),
                        onItems: (items) => live.onItems?.(id, items),
                        onCode: (code) => live.onCode?.(id, code),
                        onPatch: (patch) => live.onPatch?.(id, patch),
                      }
                    : undefined
                }
              />
            </div>
          );
        })}
      </div>

      <PageFoot settings={settings} pageNo={pageNo} total={total} live={live} />
      <OverlayLayer overlays={overlays ?? []} images={images} live={overlayLive} />
    </div>
  );
}
