'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { inputClass } from './PaiPageHeader';

export type PaiSelectOption = { value: string; label: string; disabled?: boolean };

export default function PaiSelect({ value, onChange, options, placeholder, ariaLabel, disabled = false, className = '' }: {
  value: string;
  onChange: (value: string) => void;
  options: PaiSelectOption[];
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));
  const selected = options.find((option) => option.value === value);
  const label = selected?.label ?? placeholder;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function choose(option: PaiSelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  }

  function moveActive(direction: 1 | -1) {
    if (!options.length) return;
    let next = activeIndex;
    do {
      next = (next + direction + options.length) % options.length;
    } while (options[next]?.disabled && next !== activeIndex);
    setActiveIndex(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) setOpen(true);
      else if (options[activeIndex]) choose(options[activeIndex]);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : Math.max(0, options.length - 1));
    }
  }

  return <div className="relative min-w-0">
    <button ref={trigger} type="button" disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={id}
      onClick={() => { setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value))); setOpen((current) => !current); }}
      onKeyDown={handleKeyDown} className={`${inputClass} flex items-center justify-between gap-3 text-left transition hover:border-brand-strong focus-visible:ring-4 focus-visible:ring-brand-soft ${className}`}>
      <span className={`min-w-0 truncate ${selected ? 'text-brand-ink' : 'text-brand-muted'}`}>{label}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-brand-muted transition ${open ? 'rotate-180 text-brand-strong' : ''}`} aria-hidden="true" />
    </button>
    {open && <div ref={menu} id={id} role="listbox" aria-label={ariaLabel} className="absolute left-0 top-full z-30 mt-2 max-h-64 w-full min-w-[14rem] overflow-y-auto rounded-2xl border border-brand-border bg-white p-1.5 shadow-xl ring-1 ring-slate-950/5">
      {options.length ? options.map((option, index) => <button key={option.value} type="button" role="option" aria-selected={value === option.value} disabled={option.disabled} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)}
        className={`flex min-h-10 w-full items-center rounded-xl px-3 py-2 text-left text-sm transition ${value === option.value ? 'bg-brand-soft font-semibold text-brand-strong' : index === activeIndex ? 'bg-brand-surface text-brand-ink' : 'text-brand-ink hover:bg-brand-surface'} disabled:cursor-not-allowed disabled:text-brand-muted/50`}>{option.label}</button>) : <p className="px-3 py-2 text-sm text-brand-muted">ไม่มีตัวเลือก</p>}
    </div>}
  </div>;
}
