import '@testing-library/jest-dom/vitest';

if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.showModal || function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = HTMLDialogElement.prototype.close || function () {
    this.removeAttribute('open');
  };
}

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
