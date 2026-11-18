import * as vscode from 'vscode';
import type { SetStatusInput } from '../github/types';
import type { ExpiryId, HistoryEntry, StatusHistory } from '../history';
import type { Store } from '../store';
import { formatExpiry, statusEmoji, statusText } from '../util/format';
import { pickEmoji } from './emojiPicker';

const MAX_MESSAGE = 80;

interface Preset {
  emoji: string;
  glyph: string;
  message: string;
  busy?: boolean;
  expiry?: ExpiryId;
}

const PRESETS: Preset[] = [
  { glyph: '🎯', emoji: ':dart:', message: 'Focusing', busy: true, expiry: '4h' },
  { glyph: '🗓️', emoji: ':spiral_calendar:', message: 'In a meeting', busy: true, expiry: '1h' },
  { glyph: '🏡', emoji: ':house_with_garden:', message: 'Working from home', expiry: 'today' },
  { glyph: '🤒', emoji: ':face_with_thermometer:', message: 'Out sick', busy: true, expiry: 'today' },
  { glyph: '🌴', emoji: ':palm_tree:', message: 'On vacation', busy: true, expiry: 'never' },
  { glyph: '💻', emoji: ':computer:', message: 'Coding', expiry: 'never' },
];

const EXPIRIES: { id: ExpiryId; label: string; short: string }[] = [
  { id: 'never', label: "Don't clear", short: '' },
  { id: '30m', label: 'In 30 minutes', short: 'clears in 30 min' },
  { id: '1h', label: 'In 1 hour', short: 'clears in 1 hour' },
  { id: '4h', label: 'In 4 hours', short: 'clears in 4 hours' },
  { id: 'today', label: 'Today (end of day)', short: 'clears today' },
  { id: 'week', label: 'This week (end of Sunday)', short: 'clears this week' },
];

export function expiryDate(id: ExpiryId, now = new Date()): string | undefined {
  const d = new Date(now);
  switch (id) {
    case 'never':
      return undefined;
    case '30m':
      d.setMinutes(d.getMinutes() + 30);
      break;
    case '1h':
      d.setHours(d.getHours() + 1);
      break;
    case '4h':
      d.setHours(d.getHours() + 4);
      break;
    case 'today':
      d.setHours(23, 59, 59, 0);
      break;
    case 'week':
      d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
      d.setHours(23, 59, 59, 0);
      break;
  }
  return d.toISOString();
}

/** Starting values for the step-by-step editor. */
interface Draft {
  emoji?: string;
  emojiLabel: string;
  message: string;
  busy: boolean;
  expiry: ExpiryId;
}

type FirstStep = { kind: 'apply'; entry: HistoryEntry } | { kind: 'edit'; draft: Draft };

const EDIT_BUTTON: vscode.QuickInputButton = { iconPath: new vscode.ThemeIcon('edit'), tooltip: 'Edit before applying' };
const REMOVE_BUTTON: vscode.QuickInputButton = { iconPath: new vscode.ThemeIcon('close'), tooltip: 'Remove from history' };

export async function setStatusCommand(store: Store, history: StatusHistory): Promise<void> {
  const login = store.viewer?.login;
  const first = await pickFirstStep(store, history);
  if (!first) {
    return;
  }

  if (first.kind === 'apply') {
    const e = first.entry;
    await applyStatus(store, history, {
      input: { emoji: e.emoji, message: e.message, limitedAvailability: e.busy, expiresAt: expiryDate(e.expiry) },
      expiry: e.expiry,
    });
    return;
  }

  const draft = first.draft;

  // 2a. Emoji — the draft's emoji is pre-selected, Enter keeps it.
  const chosen = await pickEmoji({
    title: 'Set GitHub Status (2/4) – Emoji',
    current: draft.emoji,
    currentLabel: draft.emojiLabel,
  });
  if (chosen === undefined) {
    return;
  }
  const emoji = chosen || undefined;

  // 2b. Message.
  const message = await vscode.window.showInputBox({
    title: 'Set GitHub Status (2/4) – Message',
    prompt: `What's happening? (max ${MAX_MESSAGE} characters)`,
    value: draft.message,
    validateInput: (v) => (v.length > MAX_MESSAGE ? `${v.length}/${MAX_MESSAGE} characters` : undefined),
  });
  if (message === undefined) {
    return;
  }

  // 3. Busy?
  const busyPicks: (vscode.QuickPickItem & { busy: boolean })[] = [
    { label: '$(check) Available', busy: false },
    { label: '$(circle-slash) Busy', detail: 'Shows others that you may be slow to respond', busy: true },
  ];
  if (draft.busy) {
    busyPicks.reverse();
  }
  const busy = await vscode.window.showQuickPick(busyPicks, { title: 'Set GitHub Status (3/4) – Availability' });
  if (!busy) {
    return;
  }

  // 4. Expiry.
  const expiryPicks = [...EXPIRIES].sort((a, b) => Number(b.id === draft.expiry) - Number(a.id === draft.expiry));
  const expiry = await vscode.window.showQuickPick(expiryPicks, { title: 'Set GitHub Status (4/4) – Clear status' });
  if (!expiry) {
    return;
  }

  if (login !== store.viewer?.login) {
    return; // account switched while the picker was open
  }
  await applyStatus(store, history, {
    input: {
      emoji,
      message: message.trim() || undefined,
      limitedAvailability: busy.busy,
      expiresAt: expiryDate(expiry.id),
    },
    expiry: expiry.id,
  });
}

/** Step 1: recent statuses, templates, or a custom status. */
function pickFirstStep(store: Store, history: StatusHistory): Promise<FirstStep | undefined> {
  const current = store.viewer?.status;
  const login = store.viewer?.login;

  type Item = vscode.QuickPickItem & { run?: () => FirstStep; entry?: HistoryEntry };

  const customDraft: Draft = {
    emoji: current?.emoji ?? undefined,
    emojiLabel: 'Current emoji',
    message: current?.message ?? '',
    busy: current?.indicatesLimitedAvailability ?? false,
    expiry: 'never',
  };

  const build = (): Item[] => {
    const recent = login ? history.list(login) : [];
    return [
      {
        label: '$(edit) Custom status…',
        description: current?.message ? `current: ${statusEmoji(current)} ${current.message}` : undefined,
        run: () => ({ kind: 'edit', draft: customDraft }),
      },
      ...(recent.length ? [{ label: 'Recent', kind: vscode.QuickPickItemKind.Separator } as Item] : []),
      ...recent.map(
        (e): Item => ({
          label: `${e.glyph ?? e.emoji ?? ''}  ${e.message ?? ''}`.trim(),
          description: describe(e.busy, e.expiry),
          buttons: [EDIT_BUTTON, REMOVE_BUTTON],
          entry: e,
          run: () => ({ kind: 'apply', entry: e }),
        }),
      ),
      { label: 'Suggestions', kind: vscode.QuickPickItemKind.Separator },
      ...PRESETS.map(
        (p): Item => ({
          label: `${p.glyph}  ${p.message}`,
          description: describe(!!p.busy, p.expiry ?? 'never'),
          run: () => ({
            kind: 'edit',
            draft: {
              emoji: p.emoji,
              emojiLabel: `Template emoji (${p.message})`,
              message: p.message,
              busy: !!p.busy,
              expiry: p.expiry ?? 'never',
            },
          }),
        }),
      ),
    ];
  };

  const qp = vscode.window.createQuickPick<Item>();
  qp.title = 'Set GitHub Status (1/4)';
  qp.placeholder = 'Pick a recent status (applies immediately), a suggestion, or write your own';
  qp.matchOnDescription = true;
  qp.items = build();

  return new Promise((resolve) => {
    let done = false;
    const finish = (v: FirstStep | undefined) => {
      if (!done) {
        done = true;
        resolve(v);
        qp.dispose();
      }
    };
    qp.onDidAccept(() => finish(qp.selectedItems[0]?.run?.()));
    qp.onDidTriggerItemButton(async ({ button, item }) => {
      const e = item.entry;
      if (!e || !login) {
        return;
      }
      if (button === REMOVE_BUTTON) {
        await history.remove(login, e);
        qp.items = build();
      } else if (button === EDIT_BUTTON) {
        finish({
          kind: 'edit',
          draft: {
            emoji: e.emoji,
            emojiLabel: 'From history',
            message: e.message ?? '',
            busy: e.busy,
            expiry: e.expiry,
          },
        });
      }
    });
    qp.onDidHide(() => finish(undefined));
    qp.show();
  });
}

function describe(busy: boolean, expiry: ExpiryId): string | undefined {
  const parts = [busy ? 'busy' : '', EXPIRIES.find((x) => x.id === expiry)?.short ?? ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

export async function clearStatusCommand(store: Store, history: StatusHistory): Promise<void> {
  await applyStatus(store, history, { input: {}, expiry: 'never' });
}

/** Sends the status to GitHub, records it in history and reports the outcome; offers Retry on failure. */
async function applyStatus(
  store: Store,
  history: StatusHistory,
  req: { input: SetStatusInput; expiry: ExpiryId },
): Promise<void> {
  const { input } = req;
  const clearing = !input.emoji && !input.message;
  try {
    await vscode.window.withProgress(
      { location: { viewId: 'mystatus.me' }, title: clearing ? 'Clearing status…' : 'Updating status…' },
      () => store.setStatus(input),
    );
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    const choice = await vscode.window.showErrorMessage(
      `${clearing ? 'Could not clear' : 'Could not update'} your GitHub status: ${reason}`,
      'Retry',
    );
    if (choice === 'Retry') {
      // Recompute relative expiry so a late retry doesn't send a time in the past.
      await applyStatus(store, history, { ...req, input: { ...input, expiresAt: expiryDate(req.expiry) } });
    }
    return;
  }

  if (clearing) {
    void vscode.window.showInformationMessage('GitHub status cleared.');
    return;
  }

  const s = store.viewer?.status;
  if (store.viewer) {
    await history.add(store.viewer.login, {
      emoji: input.emoji,
      glyph: statusEmoji(s) || undefined,
      message: input.message,
      busy: !!input.limitedAvailability,
      expiry: req.expiry,
    });
  }

  const parts = [statusText(s) || 'Status'];
  if (s?.indicatesLimitedAvailability) {
    parts.push('busy');
  }
  const exp = formatExpiry(s?.expiresAt);
  if (exp) {
    parts.push(`clears ${exp}`);
  }
  void vscode.window.showInformationMessage(`GitHub status set: ${parts.join(' · ')}`);
}
