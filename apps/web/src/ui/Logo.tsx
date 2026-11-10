export const PRODUCT_NAME = '小红书图文工作台';

/** 品牌标：红底上两张错开的卡片，一张长文拆成一叠图 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <rect x="11.5" y="6.5" width="13" height="16" rx="2.6" fill="#fff" opacity="0.42" transform="rotate(9 18 14.5)" />
      <rect x="7.5" y="9" width="13" height="16.5" rx="2.6" fill="#fff" />
      <rect x="10" y="12.2" width="8" height="1.9" rx="0.95" fill="var(--brand)" />
      <rect x="10" y="16" width="6" height="1.5" rx="0.75" fill="#1a1a1f" opacity="0.28" />
      <rect x="10" y="19" width="7" height="1.5" rx="0.75" fill="#1a1a1f" opacity="0.28" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo">
      <LogoMark />
      {compact ? null : <span className="logo-name">{PRODUCT_NAME}</span>}
    </span>
  );
}
