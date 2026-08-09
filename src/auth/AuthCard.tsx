import type { ReactNode } from 'react';
import { LoopMark } from '../components/LoopMark';

export const inputCls =
  'w-full bg-brand-soft border border-brand-line rounded-[9px] px-[13px] py-[11px] text-[13px] text-brand-text placeholder:text-[#6b788c] focus:outline-none focus:border-brand-accent transition-colors';

/** Karta z logo — wspólna dla logowania i dla ekranu ustawiania nowego hasła. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-[100dvh] overflow-y-auto flex items-center justify-center p-4 bg-brand-bg"
      style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
    >
      <div className="w-full max-w-[320px] bg-brand-panel border border-brand-line rounded-[18px] px-6 py-7 shadow-[0_24px_60px_rgba(0,0,0,.5)]">
        {/* Logo + wordmark */}
        <div className="flex justify-center mb-3.5">
          <LoopMark size={54} />
        </div>
        <div className="text-center font-display font-bold text-[22px] leading-none tracking-[-0.02em]">
          <span className="text-brand-text">Bridge</span><span className="text-brand-accent-soft">Loop</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="text-[12px] text-[#ff6b6b] bg-[#e0524d]/10 border border-[#e0524d]/40 rounded-[9px] px-3 py-2">
      {children}
    </div>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="text-[12px] text-brand-accent-soft bg-brand-accent/10 border border-brand-accent/40 rounded-[9px] px-3 py-2">
      {children}
    </div>
  );
}
