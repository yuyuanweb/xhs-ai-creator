/**
 * 界面图标。统一走 24 格线稿、1.6 描边，不引第三方图标库——
 * 只有几十个图标，装一个库换来的是一套跟这里对不齐的圆角和粗细。
 */
const PATHS = {
  back: 'M15 5l-7 7 7 7',
  prev: 'M14 6l-6 6 6 6',
  next: 'M10 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  generate: 'M12 4l1.8 4.7L18.5 10l-4.7 1.8L12 16l-1.8-4.2L5.5 10l4.7-1.3zM18 16l.9 2.1L21 19l-2.1.9L18 22l-.9-2.1L15 19l2.1-.9z',
  stop: 'M7 7h10v10H7z',
  export: 'M12 4v10m0 0l-3.5-3.5M12 14l3.5-3.5M5 17v2a1 1 0 001 1h12a1 1 0 001-1v-2',
  upload: 'M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5M5 15v4a1 1 0 001 1h12a1 1 0 001-1v-4',
  style: 'M5 7h9M18 7h1M5 12h3M12 12h7M5 17h9M18 17h1',
  page: 'M6 4h8l4 4v12H6zM14 4v4h4',
  fit: 'M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4',
  minus: 'M6 12h12',
  plus: 'M12 6v12M6 12h12',
  split: 'M4 12h16M9 7l-5 5 5 5M15 7l5 5-5 5',
  merge: 'M4 8h7l3 4-3 4H4M20 12h-6',
  hide: 'M4 4l16 16M10.6 10.7a2 2 0 002.7 2.7M7 7.4A9.6 9.6 0 003 12s3.5 6 9 6a8.6 8.6 0 004.5-1.3M11 6.1A8 8 0 0112 6c5.5 0 9 6 9 6a15 15 0 01-2 2.6',
  show: 'M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zm9 2.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4z',
  reset: 'M4 10a8 8 0 1114 5M4 5v5h5',
  warn: 'M12 5l8 14H4zM12 10v4M12 16.5v.5',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8v.5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  checkCircle: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8 12.5l2.8 2.8L16 10',
  close: 'M6 6l12 12M18 6L6 18',
  undo: 'M8 8H4V4M4.6 14A8 8 0 1012 4a8.2 8.2 0 00-6.3 3',
  redo: 'M16 8h4V4M19.4 14A8 8 0 1112 4a8.2 8.2 0 016.3 3',
  trash: 'M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13M10.5 11v5M13.5 11v5',
  comment: 'M5 6h14v9H8l-3 3V6z',
  sticker: 'M7 4h8l4 4v12H7zM15 4v4h4',
  shapes: 'M4 4h7v7H4zM17.5 4a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM7.5 13L11 20H4zM14 14h6v6h-6z',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4',
  prompt: 'M4 6h16v12H4zM8 10l2 2-2 2M12.5 14H16',
  logout: 'M15 4h3a1 1 0 011 1v14a1 1 0 01-1 1h-3M10 8l-4 4 4 4M6 12h10',
  more: 'M4.8 12a1.2 1.2 0 102.4 0 1.2 1.2 0 10-2.4 0zM10.8 12a1.2 1.2 0 102.4 0 1.2 1.2 0 10-2.4 0zM16.8 12a1.2 1.2 0 102.4 0 1.2 1.2 0 10-2.4 0z',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  image: 'M4 5h16v14H4zM4 15l4.5-4.5L13 15M13 13l2.5-2.5L20 15M15.5 8.5h.01',
  layers: 'M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4',
  key: 'M8 15a4 4 0 110-8 4 4 0 010 8zM12 11h8M17 11v3M20 11v2',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM5 20a7 7 0 0114 0',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  canvas: 'M3 6h4v12H3zM9 4h6v16H9zM17 6h4v12h-4z',
  phone: 'M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM10.5 18h3',
  heading: 'M6 5v14M18 5v14M6 12h12',
  text: 'M5 6h14M5 10h14M5 14h14M5 18h9',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  code: 'M9 7l-5 5 5 5M15 7l5 5-5 5',
  quote: 'M6 17c-1.2-1-2-2.6-2-4.6C4 9 6 7 9 6.5M15 17c-1.2-1-2-2.6-2-4.6C13 9 15 7 18 6.5M5.5 12.5H9V17H5.5zM14.5 12.5H18V17h-3.5z',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  flow: 'M3 9h5v6H3zM16 9h5v6h-5zM8 12h8M13.5 9.5L16 12l-2.5 2.5',
  chart: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
  cloud: 'M7 18a4 4 0 01-.6-7.96A5.5 5.5 0 0117 9a3.5 3.5 0 01.5 6.97V18z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
  star: 'M12 4l2.5 5 5.5.8-4 3.9.9 5.5L12 16.6 7.1 19.2l.9-5.5-4-3.9 5.5-.8z',
  chat: 'M5 6h14v10H9l-4 3z',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
