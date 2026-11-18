import * as vscode from 'vscode';
import type { GitHubUser, Relation } from '../github/types';
import { formatExpiry, statusText } from '../util/format';

export const USER_SCHEME = 'mystatus-user';

/** URI used only to hang a FileDecoration (busy badge) on a tree item. */
export function userUri(relation: Relation | 'me', login: string): vscode.Uri {
  return vscode.Uri.from({ scheme: USER_SCHEME, authority: relation, path: `/${login}` });
}

/** Full name when the user has set one on GitHub, otherwise the username. */
export function displayName(user: Pick<GitHubUser, 'name' | 'login'>): string {
  return user.name?.trim() || user.login;
}

export class UserItem extends vscode.TreeItem {
  constructor(
    readonly user: GitHubUser,
    relation: Relation | 'me',
  ) {
    super(displayName(user), vscode.TreeItemCollapsibleState.None);
    this.id = `${relation}:${user.login}`;
    this.description = statusText(user.status) || undefined;
    this.iconPath = vscode.Uri.parse(user.avatarUrl);
    this.resourceUri = userUri(relation, user.login);
    this.contextValue = 'mystatus.user';
    this.tooltip = userTooltip(user);
    this.accessibilityInformation = {
      label: [displayName(user), statusText(user.status), user.status?.indicatesLimitedAvailability ? 'busy' : '']
        .filter(Boolean)
        .join(', '),
    };
  }
}

export function userTooltip(user: GitHubUser): vscode.MarkdownString {
  // Hovers strip CSS (style="padding…" is removed by VS Code's sanitizer), so spacing
  // is built from empty table cells sized with the allowed width/height attributes.
  const PAD_X = 10;
  const PAD_Y = 6;

  const header =
    `<table><tr>` +
    `<td><img src="${html(user.avatarUrl)}" width="48" height="48"/></td>` +
    `<td width="12"></td>` +
    `<td><b>${html(user.name ?? user.login)}</b>` +
    (user.name ? `<br/>${html(user.login)}` : '') +
    (user.bio ? `<br/><br/>${html(user.bio)}` : '') +
    `</td></tr></table>`;

  const lines: string[] = [];
  const s = user.status;
  if (s) {
    const text = statusText(s);
    if (text) {
      lines.push(html(text));
    }
    if (s.indicatesLimitedAvailability) {
      lines.push('⛔ <b>Busy</b> — may be slow to respond');
    }
    const exp = formatExpiry(s.expiresAt);
    if (exp) {
      lines.push(`🕒 Clears ${html(exp)}`);
    }
  }
  const body = header + (lines.length ? `<hr/>${lines.join('<br/>')}` : '');

  const md = new vscode.MarkdownString(
    `<table>` +
      `<tr><td colspan="3" height="${PAD_Y}"></td></tr>` +
      `<tr><td width="${PAD_X}"></td><td>${body}</td><td width="${PAD_X}"></td></tr>` +
      `<tr><td colspan="3" height="${PAD_Y}"></td></tr>` +
      `</table>`,
  );
  md.supportHtml = true;
  return md;
}

function html(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
