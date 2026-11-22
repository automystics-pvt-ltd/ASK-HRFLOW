import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { searchApi, ApiError } from '../lib/api';
import { cn } from './ui/utils';

type Hit = {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  navigateTo: string;
  meta?: Record<string, string>;
};

export function GlobalSearchBar({
  onNavigate,
  compact,
}: {
  onNavigate: (tab: string, meta?: Record<string, string>) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Record<string, Hit[]>>({});
  const [results, setResults] = useState<Hit[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      setGroups({});
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    timer.current = window.setTimeout(() => {
      searchApi
        .query(q)
        .then((res) => {
          setResults(res.results ?? []);
          setGroups(res.groups ?? {});
          setOpen(true);
        })
        .catch((e) => {
          setError(e instanceof ApiError ? e.message : 'Search failed');
          setResults([]);
          setGroups({});
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, 220);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [query]);

  const pick = (hit: Hit) => {
    if (hit.meta?.employeeId) sessionStorage.setItem('global-search', hit.title);
    if (hit.meta?.department) sessionStorage.setItem('global-search', hit.meta.department);
    onNavigate(hit.navigateTo, hit.meta);
    setQuery('');
    setOpen(false);
  };

  const categories = Object.keys(groups);

  return (
    <div ref={wrapRef} className={cn('relative w-full', compact ? '' : 'max-w-md')}>
      <div className="flex items-center gap-2 bg-accent/50 rounded-lg px-3 py-2">
        {loading ? (
          <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />
        ) : (
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <input
          type="search"
          aria-label="Global search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter' && results[0]) {
              e.preventDefault();
              pick(results[0]);
            }
          }}
          placeholder="Search employees, leave, docs…"
          className="bg-transparent border-none outline-none text-sm flex-1 min-w-0"
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {open && query.trim() ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 rounded-xl border border-border bg-card shadow-[0_16px_40px_-16px_rgba(6,26,82,0.35)] max-h-[min(24rem,70vh)] overflow-y-auto">
          {error ? (
            <p className="px-3 py-4 text-sm text-destructive">{error}</p>
          ) : loading && !results.length ? (
            <p className="px-3 py-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </p>
          ) : !results.length ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No results for “{query.trim()}”.</p>
          ) : (
            <div className="py-2">
              {categories.map((cat) => (
                <div key={cat} className="px-1">
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {cat}
                  </p>
                  <ul>
                    {(groups[cat] ?? []).map((hit) => (
                      <li key={hit.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors"
                          onClick={() => pick(hit)}
                        >
                          <span className="block text-sm font-medium truncate">{hit.title}</span>
                          {hit.subtitle ? (
                            <span className="block text-xs text-muted-foreground truncate">{hit.subtitle}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
