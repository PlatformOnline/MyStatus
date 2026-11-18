import type { UserStatus } from '../github/types';

/**
 * GitHub returns status emoji as a shortcode (":computer:") plus an HTML
 * rendering, e.g. `<div>💻</div>` or `<div><g-emoji alias="palm_tree">🌴</g-emoji></div>`.
 * We strip the tags to get the unicode character; custom GitHub emoji
 * (e.g. :octocat:) render as an <img>, so we fall back to the shortcode.
 */
export function statusEmoji(status: Pick<UserStatus, 'emoji' | 'emojiHTML'> | null | undefined): string {
  if (!status) {
    return '';
  }
  const text = decodeEntities((status.emojiHTML ?? '').replace(/<[^>]*>/g, '')).trim();
  return text || (status.emoji ?? '');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

/** One-line status text: "🌴 On vacation". Empty string when no status. */
export function statusText(status: UserStatus | null | undefined): string {
  if (!status) {
    return '';
  }
  return [statusEmoji(status), status.message ?? ''].filter(Boolean).join(' ');
}

export function formatExpiry(expiresAt: string | null | undefined, now = new Date()): string | undefined {
  if (!expiresAt) {
    return undefined;
  }
  const d = new Date(expiresAt);
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
