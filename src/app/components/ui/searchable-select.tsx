import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';
import { cn } from './utils';

export type SearchableOption = { value: string; label: string };

type Props = {
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Allow choosing a typed value that is not in options */
  allowCustom?: boolean;
  customLabel?: (query: string) => string;
};

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results found.',
  disabled,
  className,
  id,
  allowCustom = false,
  customLabel = (q) => `Use “${q}”`,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => {
    const fromOpts = options.find((o) => o.value === value);
    if (fromOpts) return fromOpts;
    if (value) return { value, label: value };
    return undefined;
  }, [options, value]);

  const showCustom =
    allowCustom &&
    query.trim().length > 0 &&
    !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase() || o.value.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal h-9', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate">{selected?.label || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {allowCustom && query.trim() ? (
                <button
                  type="button"
                  className="w-full px-2 py-3 text-sm text-left hover:bg-accent"
                  onClick={() => {
                    onChange(query.trim());
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {customLabel(query.trim())}
                </button>
              ) : (
                emptyText
              )}
            </CommandEmpty>
            <CommandGroup>
              {showCustom && (
                <CommandItem
                  value={`__custom__${query.trim()}`}
                  onSelect={() => {
                    onChange(query.trim());
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {customLabel(query.trim())}
                </CommandItem>
              )}
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
