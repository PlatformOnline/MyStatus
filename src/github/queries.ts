const USER_FIELDS = /* GraphQL */ `
  fragment UserFields on User {
    login
    name
    avatarUrl(size: 64)
    url
    bio
    status {
      emoji
      emojiHTML
      message
      indicatesLimitedAvailability
      expiresAt
    }
  }
`;

export const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    viewer {
      ...UserFields
      followers { totalCount }
      following { totalCount }
    }
  }
  ${USER_FIELDS}
`;

export const FOLLOWERS_QUERY = /* GraphQL */ `
  query Followers($first: Int!, $after: String) {
    viewer {
      connection: followers(first: $first, after: $after) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes { ...UserFields }
      }
    }
  }
  ${USER_FIELDS}
`;

export const FOLLOWING_QUERY = /* GraphQL */ `
  query Following($first: Int!, $after: String) {
    viewer {
      connection: following(first: $first, after: $after) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes { ...UserFields }
      }
    }
  }
  ${USER_FIELDS}
`;

export const CHANGE_STATUS_MUTATION = /* GraphQL */ `
  mutation ChangeStatus($input: ChangeUserStatusInput!) {
    changeUserStatus(input: $input) {
      status {
        emoji
        emojiHTML
        message
        indicatesLimitedAvailability
        expiresAt
      }
    }
  }
`;
