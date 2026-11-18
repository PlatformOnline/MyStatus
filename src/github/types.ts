export interface UserStatus {
  /** Shortcode such as ":palm_tree:" */
  emoji: string | null;
  /** HTML rendering of the emoji, contains the unicode character for standard emoji. */
  emojiHTML: string | null;
  message: string | null;
  indicatesLimitedAvailability: boolean;
  expiresAt: string | null;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
  bio: string | null;
  status: UserStatus | null;
}

export interface Viewer extends GitHubUser {
  followers: { totalCount: number };
  following: { totalCount: number };
}

export type Relation = 'followers' | 'following';

export interface SetStatusInput {
  emoji?: string;
  message?: string;
  limitedAvailability?: boolean;
  expiresAt?: string;
}
