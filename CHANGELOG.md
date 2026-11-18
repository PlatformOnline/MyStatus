# Changelog

All notable changes to MyStatus are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-18

First public release.

### Added
- **MyStatus** view container with **Profile**, **Followers** and **Following** views.
- Sign in with VS Code's built-in GitHub authentication.
- Avatars, full name (or username), status emoji and message for every user. **B** badge for busy users. Rich hover with bio, status and expiry.
- **Set Status**: recent history, suggestions, searchable emoji picker, message, availability (busy) and expiry.
- **Clear Status**, with success and error notifications and **Retry**.
- Recent status history per account, synced with Settings Sync. Includes a **Clear Status History** command.
- Status bar item showing your status, with an optional busy highlight.
- Context menu: **Open Profile on GitHub**, **Copy Username**.
- Settings: `refreshInterval`, `maxUsers`, `sortBy`, `hideUsersWithoutStatus`, `showStatusBarItem`, `highlightBusyInStatusBar`, `historySize`.
