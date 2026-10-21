import type { FormEvent, KeyboardEvent } from 'react';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Square, X } from 'lucide-react';
import { TextArea } from '../../components/ui/FormField';
import { useModalDialog } from '../../hooks/useModalDialog';

const OdieMarkdown = lazy(() => import('./OdieMarkdown'));

export type OdieChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

type OdieCareerDialogProps = {
  open: boolean;
  chat: OdieChatMessage[];
  message: string;
  busy: boolean;
  online: boolean;
  onClose: () => void;
  onMessageChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
};

function AssistantMessage({ children }: { children: string }) {
  return (
    <article className="flex min-w-0 items-start gap-3" data-message-role="assistant">
      <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-academy-navy ring-1 ring-academy-gold/40">
        <img alt="" aria-hidden="true" className="h-8 w-8 object-contain" src="/images/dashboard/odie-pathway-mascot.png" />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-academy-aegean dark:text-academy-gold">Odie</p>
        <div className="max-w-none break-words text-[0.9375rem] leading-7 text-slate-700 dark:text-slate-200">
          <Suspense fallback={<p>Formatting Odie’s answer…</p>}>
            <OdieMarkdown>{children}</OdieMarkdown>
          </Suspense>
        </div>
      </div>
    </article>
  );
}

function UserMessage({ children }: { children: string }) {
  return (
    <article className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-academy-navy px-4 py-3 text-sm leading-6 text-white" data-message-role="user">
      {children}
    </article>
  );
}

export function OdieCareerDialog({ open, chat, message, busy, online, onClose, onMessageChange, onSubmit, onStop }: OdieCareerDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const followLatestMessageRef = useRef(true);
  const previousMessageCountRef = useRef(chat.length);
  useModalDialog({ dialogRef, onClose, open });

  useEffect(() => {
    if (!open) return;
    const transcript = transcriptRef.current;
    if (!transcript) return;
    if (chat.length > previousMessageCountRef.current) followLatestMessageRef.current = true;
    previousMessageCountRef.current = chat.length;
    if (!followLatestMessageRef.current) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    transcript.scrollTo({ top: transcript.scrollHeight, behavior: reducedMotion || busy ? 'auto' : 'smooth' });
  }, [busy, chat, open]);

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <aside
        aria-label="Odie career assistant"
        aria-modal="true"
        className="flex h-[100dvh] w-full flex-col overflow-hidden border-l border-slate-200 bg-[#fffdf8] shadow-[-20px_0_60px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-slate-950 sm:max-w-[40rem] sm:rounded-l-[1.5rem]"
        id="odie-career-assistant"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10 sm:px-6 sm:py-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-academy-navy ring-1 ring-academy-gold/50">
            <img alt="" aria-hidden="true" className="h-10 w-10 object-contain" src="/images/dashboard/odie-pathway-mascot.png" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold leading-tight text-academy-navy dark:text-white">Ask Odie</h2>
            <p className="mt-0.5 truncate text-xs text-academy-muted">Your Careers guide · Nothing is sent automatically.</p>
          </div>
          <button aria-label="Close Odie" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-academy-gold dark:text-slate-300 dark:hover:bg-white/10" type="button" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div
          aria-live="polite"
          aria-relevant="additions text"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-7"
          data-testid="odie-career-transcript"
          onScroll={(event) => {
            const transcript = event.currentTarget;
            followLatestMessageRef.current = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 96;
          }}
          ref={transcriptRef}
        >
          <div className="mx-auto max-w-2xl space-y-6">
            {chat.map((item, index) => item.role === 'assistant'
              ? <AssistantMessage key={`${item.role}-${index}`}>{item.text || (busy && index === chat.length - 1 ? 'Odie is thinking…' : '')}</AssistantMessage>
              : <UserMessage key={`${item.role}-${index}`}>{item.text}</UserMessage>)}
          </div>
        </div>

        <form className="shrink-0 border-t border-slate-200 bg-[#fffdf8] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-white/10 dark:bg-slate-950 sm:px-6 sm:pb-5" onSubmit={onSubmit}>
          <div className="mx-auto max-w-2xl">
            {!online ? <p className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-200" role="status">Odie is unavailable while you are offline. Your draft remains editable.</p> : null}
            <label className="sr-only" htmlFor="odie-career-message">Message</label>
            <div className="rounded-2xl border border-slate-300 bg-white p-2 shadow-sm transition focus-within:border-academy-aegean focus-within:ring-2 focus-within:ring-academy-aegean/15 dark:border-white/15 dark:bg-slate-900 dark:focus-within:border-academy-gold dark:focus-within:ring-academy-gold/15">
              <TextArea
                className="max-h-40 min-h-20 w-full resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 text-academy-navy outline-none placeholder:text-slate-400 focus:ring-0 dark:text-white"
                data-modal-initial-focus
                id="odie-career-message"
                onChange={(event) => onMessageChange(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask about this career, your subjects, or a study route…"
                value={message}
              />
              <div className="flex items-center justify-between gap-3 px-1 pb-1">
                <p className="hidden text-xs text-slate-400 sm:block">Enter to send · Shift+Enter for a new line</p>
                <div className="ml-auto flex items-center gap-2">
                  {busy ? (
                    <button className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-300 px-4 text-sm font-semibold text-academy-navy hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-academy-gold dark:border-white/15 dark:text-white dark:hover:bg-white/10" type="button" onClick={onStop}>
                      <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />Stop
                    </button>
                  ) : null}
                  <button aria-label={busy ? 'Odie is responding' : 'Send to Odie'} className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-full bg-academy-gold px-4 text-sm font-bold text-academy-navy transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-academy-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45" type="submit" disabled={busy || !message.trim() || !online}>
                    <Send className="h-4 w-4" aria-hidden="true" /><span className="hidden xs:inline">Send</span>
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-2 text-center text-[0.6875rem] leading-4 text-slate-400">Check current programme requirements on the institution’s official website.</p>
          </div>
        </form>
      </aside>
    </div>,
    document.body,
  );
}
