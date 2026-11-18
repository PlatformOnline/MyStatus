import * as vscode from 'vscode';

export type ExpiryId = 'never' | '30m' | '1h' | '4h' | 'today' | 'week';

/** A previously used status. Expiry is stored as a duration choice, not a date, so it can be reused. */
export interface HistoryEntry {
  /** Shortcode sent to GitHub, e.g. ":dart:". */
  emoji?: string;
  /** Unicode rendering for display, e.g. "🎯". */
  glyph?: string;
  message?: string;
  busy: boolean;
  expiry: ExpiryId;
  usedAt: number;
}

const KEY = 'mystatus.history';

/**
 * Recently used statuses, kept per GitHub account in global state and synced
 * across machines with Settings Sync.
 */
export class StatusHistory {
  constructor(private readonly state: vscode.Memento & { setKeysForSync(keys: readonly string[]): void }) {
    state.setKeysForSync([KEY]);
  }

  private get limit(): number {
    return Math.max(0, vscode.workspace.getConfiguration('myStatus').get<number>('historySize', 10));
  }

  private all(): Record<string, HistoryEntry[]> {
    return this.state.get<Record<string, HistoryEntry[]>>(KEY, {});
  }

  list(login: string): HistoryEntry[] {
    return (this.all()[login] ?? []).slice(0, this.limit);
  }

  async add(login: string, entry: Omit<HistoryEntry, 'usedAt'>): Promise<void> {
    if (this.limit === 0 || (!entry.emoji && !entry.message)) {
      return;
    }
    const rest = (this.all()[login] ?? []).filter((e) => !sameStatus(e, entry));
    await this.save(login, [{ ...entry, usedAt: Date.now() }, ...rest].slice(0, this.limit));
  }

  async remove(login: string, entry: HistoryEntry): Promise<void> {
    await this.save(
      login,
      (this.all()[login] ?? []).filter((e) => !sameStatus(e, entry)),
    );
  }

  async clear(login: string): Promise<void> {
    await this.save(login, []);
  }

  private async save(login: string, entries: HistoryEntry[]): Promise<void> {
    const all = { ...this.all() };
    if (entries.length) {
      all[login] = entries;
    } else {
      delete all[login];
    }
    await this.state.update(KEY, all);
  }
}

/** Same emoji and message count as one entry; the latest busy/expiry choice wins. */
function sameStatus(a: Pick<HistoryEntry, 'emoji' | 'message'>, b: Pick<HistoryEntry, 'emoji' | 'message'>): boolean {
  return (a.emoji ?? '') === (b.emoji ?? '') && (a.message ?? '') === (b.message ?? '');
}
