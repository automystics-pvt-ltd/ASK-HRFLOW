import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Maximize2, Minimize2, Minus, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useAccess } from '../lib/access';
import { aiApi, ApiError } from '../lib/api';
import { useBranding } from '../lib/branding';
import { cn } from './ui/utils';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: string[];
};

const STORAGE_KEY = 'ask-hrflow-ai-chat-v1';

function welcomeMessage(role: string): ChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content:
      role === 'employee'
        ? "Hi — I'm ASK AI. I can help with your leave, attendance, holidays, payslips, and how to use HRFlow. What would you like to know?"
        : "Hi — I'm ASK AI. I can help with leave, attendance, holidays, team info in your scope, payroll guidance, and navigation. Ask away.",
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    suggestions:
      role === 'employee'
        ? ['My leave balance', 'Upcoming holidays', 'My attendance', 'How do I request leave?']
        : ['Pending approvals', 'Upcoming holidays', 'Team leave overview', 'How do I run payroll?'],
  };
}

function loadMessages(userId: string, role: string): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) return [welcomeMessage(role)];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) && parsed.length ? parsed : [welcomeMessage(role)];
  } catch {
    return [welcomeMessage(role)];
  }
}

function saveMessages(userId: string, messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(messages.slice(-80)));
  } catch {
    /* ignore quota */
  }
}

type PanelState = 'closed' | 'open' | 'minimized' | 'expanded';

export function FloatingAIChat({ currentModule }: { currentModule: string }) {
  const { user, role, can } = useAccess();
  const { theme, company } = useBranding();
  const allowed = can('ai-assistant', 'read');
  const [panel, setPanel] = useState<PanelState>('closed');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    setMessages(loadMessages(user.id, role));
  }, [user?.id, role]);

  useEffect(() => {
    if (!user?.id || !messages.length) return;
    saveMessages(user.id, messages);
  }, [messages, user?.id]);

  useEffect(() => {
    if (panel === 'open' || panel === 'expanded') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      window.setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [panel, messages, loading]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || loading || !user) return;
      setError(null);
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);
      try {
        const res = await aiApi.chat(content, { module: currentModule });
        const aiMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          suggestions: res.suggestions,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? e.message
            : 'Could not reach ASK AI. Check your connection and try again.';
        setError(msg);
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: `Sorry — ${msg}`,
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, user, currentModule],
  );

  const clearChat = () => {
    if (!user) return;
    const next = [welcomeMessage(role)];
    setMessages(next);
    saveMessages(user.id, next);
    setError(null);
  };

  if (!user || !allowed) return null;

  const primary = theme.primary || '#1d6bff';
  const accent = theme.accent || '#3cd0f5';
  const brandName = company.name || 'ASK HRFlow';

  return (
    <div
      className={cn(
        'fixed z-[60] flex flex-col items-end gap-3',
        /* Clear mobile bottom nav (~3.5rem) + safe area */
        'right-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-6',
      )}
    >
      {(panel === 'open' || panel === 'expanded' || panel === 'minimized') && (
        <div
          className={cn(
            'flex flex-col overflow-hidden border border-border bg-card shadow-[0_16px_48px_-16px_rgba(6,26,82,0.45)] rounded-2xl',
            panel === 'minimized' && 'w-[min(20rem,calc(100vw-2rem))]',
            panel === 'open' && 'w-[min(24rem,calc(100vw-2rem))] h-[min(32rem,calc(100svh-10rem))]',
            panel === 'expanded' &&
              'w-[min(42rem,calc(100vw-2rem))] h-[min(42rem,calc(100svh-8rem))]',
          )}
          role="dialog"
          aria-label="ASK AI assistant"
        >
          <header
            className="flex items-center gap-3 px-3 py-2.5 text-white shrink-0 cursor-pointer"
            style={{
              backgroundImage: `linear-gradient(120deg, ${primary} 0%, ${accent} 100%)`,
            }}
            onClick={() => {
              if (panel === 'minimized') setPanel('open');
            }}
          >
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">ASK AI</p>
              <p className="text-[11px] text-white/80 truncate">
                {loading ? 'Thinking…' : error ? 'Connection issue' : `${brandName} · ${role}`}
              </p>
            </div>
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              {panel !== 'minimized' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/15"
                  aria-label="Clear conversation"
                  onClick={clearChat}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
              {panel !== 'minimized' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/15"
                  aria-label={panel === 'expanded' ? 'Restore size' : 'Expand'}
                  onClick={() => setPanel((p) => (p === 'expanded' ? 'open' : 'expanded'))}
                >
                  {panel === 'expanded' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              )}
              {panel !== 'minimized' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/15"
                  aria-label="Minimize"
                  onClick={() => setPanel('minimized')}
                >
                  <Minus className="w-4 h-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/15"
                aria-label="Close chat"
                onClick={() => setPanel('closed')}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {panel !== 'minimized' && (
            <>
              <ScrollArea className="flex-1 min-h-0 px-3 py-3">
                <div className="space-y-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}
                    >
                      {m.role === 'assistant' && (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white"
                          style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}
                        >
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div className="max-w-[85%] space-y-1.5">
                        <div
                          className={cn(
                            'rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed',
                            m.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-accent/70 text-foreground rounded-bl-md',
                          )}
                        >
                          {m.content}
                        </div>
                        <p className="text-[10px] text-muted-foreground px-1">{m.timestamp}</p>
                        {m.role === 'assistant' && m.suggestions?.length ? (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {m.suggestions.map((s) => (
                              <button
                                key={s}
                                type="button"
                                disabled={loading}
                                onClick={() => void send(s)}
                                className="text-[11px] px-2 py-1 rounded-full border border-border bg-background hover:bg-accent transition-colors disabled:opacity-50"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-2 items-center text-muted-foreground text-xs px-1">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}
                      >
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <span className="inline-flex gap-1 items-center bg-accent/70 rounded-full px-3 py-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                          style={{ animationDelay: '0.12s' }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                          style={{ animationDelay: '0.24s' }}
                        />
                      </span>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              <form
                className="border-t border-border p-3 flex gap-2 shrink-0 bg-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about leave, holidays, attendance…"
                  disabled={loading}
                  className="flex-1"
                  maxLength={2000}
                  aria-label="Message ASK AI"
                />
                <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Send">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      )}

      {panel === 'closed' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                'group relative h-14 w-14 rounded-full text-white shadow-[0_12px_32px_-8px_rgba(6,26,82,0.55)]',
                'flex items-center justify-center transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
                'ask-ai-fab',
              )}
              style={{
                backgroundImage: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`,
              }}
              aria-label="Open ASK AI"
              onClick={() => setPanel('open')}
            >
              <Sparkles className="w-6 h-6 relative z-10" />
              <span
                className="absolute -top-9 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold tracking-wide uppercase px-2 py-1 rounded-md bg-foreground text-background shadow-md whitespace-nowrap pointer-events-none"
              >
                ASK AI
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">ASK AI</TooltipContent>
        </Tooltip>
      )}

      <style>{`
        .ask-ai-fab {
          animation: ask-ai-pulse 2.8s ease-in-out infinite;
        }
        @keyframes ask-ai-pulse {
          0%, 100% { box-shadow: 0 12px 32px -8px rgba(6,26,82,0.55), 0 0 0 0 rgba(60,208,245,0.4); }
          50% { box-shadow: 0 12px 32px -8px rgba(6,26,82,0.55), 0 0 0 12px rgba(60,208,245,0); }
        }
      `}</style>
    </div>
  );
}
