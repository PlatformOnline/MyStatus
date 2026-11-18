import * as vscode from 'vscode';

interface EmojiItem extends vscode.QuickPickItem {
  /** Value sent to GitHub: a :shortcode:, or '' for "no emoji". */
  value?: string;
}

const SHORTCODE = /^:[\w+-]+:$/;
const PICTOGRAPHIC = /^\p{Extended_Pictographic}/u;

let cache: EmojiItem[] | undefined;

/** Loads GitHub's emoji list (gemoji) lazily and turns it into QuickPick items grouped by category. */
async function emojiItems(): Promise<EmojiItem[]> {
  if (cache) {
    return cache;
  }
  const { gemoji } = await import('gemoji');
  const items: EmojiItem[] = [];
  let category = '';
  for (const g of gemoji) {
    if (g.category !== category) {
      category = g.category;
      items.push({ label: category, kind: vscode.QuickPickItemKind.Separator });
    }
    const names = g.names.map((n) => `:${n}:`).join(' ');
    items.push({
      label: `${g.emoji}  ${g.description}`,
      description: [names, ...g.tags].join(' · '),
      value: `:${g.names[0]}:`,
    });
  }
  cache = items;
  return items;
}

/**
 * Searchable emoji list. Resolves to a :shortcode:, '' for no emoji,
 * or undefined when the user cancels.
 * Typing a shortcode that isn't in the list (e.g. GitHub's :octocat:) or a raw emoji
 * offers a "Use …" entry so custom emoji still work.
 */
export async function pickEmoji(options: {
  title: string;
  current?: string | null;
  /** Shown under the pre-selected emoji, e.g. "Current emoji". */
  currentLabel?: string;
}): Promise<string | undefined> {
  const qp = vscode.window.createQuickPick<EmojiItem>();
  qp.title = options.title;
  qp.placeholder = 'Search emoji by name or keyword (e.g. "coffee", "vacation", ":rocket:")';
  qp.matchOnDescription = true;
  qp.busy = true;
  qp.show();

  const fixed: EmojiItem[] = [{ label: '$(circle-slash) No emoji', value: '' }];
  let all: EmojiItem[] = [];
  try {
    all = await emojiItems();
  } catch (e) {
    void vscode.window.showErrorMessage(`Could not load emoji list: ${e instanceof Error ? e.message : e}`);
  }
  const currentItem = all.find((i) => i.value && i.value === options.current);
  if (currentItem) {
    fixed.unshift({ ...currentItem, detail: options.currentLabel ?? 'Current emoji' });
  }
  const base = [...fixed, ...all];
  qp.items = base;
  if (currentItem) {
    qp.activeItems = [qp.items[0]];
  }
  qp.busy = false;

  return new Promise<string | undefined>((resolve) => {
    let done = false;
    const finish = (v: string | undefined) => {
      if (!done) {
        done = true;
        resolve(v);
        qp.dispose();
      }
    };

    qp.onDidChangeValue((value) => {
      const v = value.trim();
      const known = all.some((i) => i.value === v);
      if ((SHORTCODE.test(v) || PICTOGRAPHIC.test(v)) && !known) {
        // alwaysShow keeps it visible even though it won't fuzzy-match its own label.
        qp.items = [{ label: `$(add) Use ${v}`, value: v, alwaysShow: true }, ...base];
      } else if (qp.items !== base) {
        qp.items = base;
      }
    });
    qp.onDidAccept(() => finish(qp.selectedItems[0]?.value));
    qp.onDidHide(() => finish(undefined));
  });
}
