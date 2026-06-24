import type { CSSProperties } from 'react';

// BridgeLoop "Pętla" mark — four card colours circling a loop (docs/design/README.md).
// Built from CSS + Unicode glyphs, scaled from the 54px reference.
export function LoopMark({ size = 54 }: { size?: number }) {
  const ringInset = size * 0.111;
  const glyph = size * 0.24;
  const dot = size * 0.111;
  const suit = (extra: CSSProperties): CSSProperties => ({
    position: 'absolute', fontSize: glyph, lineHeight: 1, ...extra,
  });
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} aria-hidden="true">
      <div style={{ position: 'absolute', inset: ringInset, borderRadius: '50%', border: '2px solid rgba(52,211,153,.5)' }} />
      <div style={suit({ top: 0, left: '50%', transform: 'translateX(-50%)', color: '#cfe9df' })}>♠</div>
      <div style={suit({ right: 0, top: '50%', transform: 'translateY(-50%)', color: '#e0524d' })}>♦</div>
      <div style={suit({ bottom: 0, left: '50%', transform: 'translateX(-50%)', color: '#cfe9df' })}>♣</div>
      <div style={suit({ left: 0, top: '50%', transform: 'translateY(-50%)', color: '#e0524d' })}>♥</div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: dot, height: dot, borderRadius: '50%', background: '#fbbf24' }} />
      </div>
    </div>
  );
}
