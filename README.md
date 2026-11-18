# MyStatus

See what your GitHub followers and the people you follow are up to, right from the VS Code sidebar, and set your own GitHub status without leaving the editor.

## Features

### Followers & Following at a glance
A **MyStatus** view container in the Activity Bar with three views:

- **Profile**: your avatar, current status, busy state, when it clears, and your follower/following counts.
- **Followers** and **Following**: everyone with their avatar, full name (or username), and status, e.g. `🌴 On vacation`.
  - Users marked **Busy** get a **B** badge and a highlighted name.
  - Hover anyone to see their name, bio, status, and when it clears.
  - Right-click to **Open Profile on GitHub** or **Copy Username**.
  - The view title shows the count, or `loaded / total` when a list is capped.

### Set your status in a few keystrokes
Click **Set Status** (✏️ in the Profile view, or click your status in the status bar):

1. Pick a **recent** status (applies immediately), a **suggestion** (Focusing, In a meeting, Out sick, …), or write a **custom** one.
2. Choose an emoji from a **searchable list** of all GitHub emoji. Search by name or keyword, e.g. `coffee`, `vacation`, `:rocket:`.
3. Type a message (up to 80 characters).
4. Mark yourself **Available** or **Busy**.
5. Choose when it clears: never, 30 minutes, 1 hour, 4 hours, today, or this week.

You get a notification when it's set, and a **Retry** button if something goes wrong. **Clear Status** removes it.

### Recent statuses
Every status you set is remembered, per GitHub account, and offered at the top of **Set Status**. Click to re-apply, ✏️ to tweak it first, ✕ to forget it. History syncs across machines with Settings Sync.

### Status bar
Your current status sits in the status bar. Click it to change it. While you're busy it can be highlighted.

## Getting started

1. Open the **MyStatus** view in the Activity Bar.
2. Click **Sign in with GitHub** and approve the request.
3. That's it. Your followers and following load automatically and refresh in the background.

## Commands

| Command | Description |
|---|---|
| `MyStatus: Sign in with GitHub` | Sign in using VS Code's built-in GitHub account support |
| `MyStatus: Sign Out` | Stop using the GitHub session in MyStatus |
| `MyStatus: Set Status` | Set your GitHub status |
| `MyStatus: Clear Status` | Remove your GitHub status |
| `MyStatus: Refresh` | Reload your profile, followers and following |
| `MyStatus: Clear Status History` | Forget all recent statuses for the signed-in account |

## Settings

| Setting | Default | Description |
|---|---|---|
| `myStatus.refreshInterval` | `5` | Auto-refresh interval in minutes. `0` disables it. |
| `myStatus.maxUsers` | `5000` | Maximum users loaded per list (100–5000). Each 100 users is one API request. |
| `myStatus.sortBy` | `status` | `status`: busy first, then users with a status. `name`: alphabetical. |
| `myStatus.hideUsersWithoutStatus` | `false` | Only list users who have a status set. |
| `myStatus.showStatusBarItem` | `true` | Show your status in the status bar. |
| `myStatus.highlightBusyInStatusBar` | `true` | Highlight the status bar item while you're busy. |
| `myStatus.historySize` | `10` | How many recent statuses to remember (0–50). `0` disables history. |

## Permissions & privacy

- **Sign-in** uses VS Code's built-in GitHub authentication. MyStatus never sees your password, and the token is stored by VS Code, not by this extension.
- **Scope:** MyStatus requests the GitHub `user` scope, because changing your status (`changeUserStatus`) requires it. MyStatus only reads your profile, followers and following, and writes your status. It does not change anything else.
- **Network:** MyStatus only talks to `api.github.com`.
- **Your status is public** on GitHub. MyStatus only sends what you type or pick. It never reads your workspace, files, or repositories.
- **Local data:** your recent statuses are kept in VS Code's storage on your machine, and synced only if you use Settings Sync.
- **No telemetry** is collected.

**Sign Out** makes MyStatus stop using the session. To revoke access completely, use the **Accounts** menu in VS Code, or remove "Visual Studio Code" under *GitHub → Settings → Applications*.

## Notes

- Some users only show their status to members of a specific organization. Their status appears empty for everyone else, including you.
- Expired statuses are removed by GitHub automatically.
- GitHub allows 5,000 API points per hour. A refresh costs about 1 point per 100 users, so normal use stays far below that.

## Requirements

VS Code 1.95 or newer and a GitHub account.

## License

[MIT](LICENSE)
