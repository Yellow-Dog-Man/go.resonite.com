type HandleType = 'world' | 'worldList' | 'session' | 'sessionList'

type RecordApiSearchSortField = 'CreationDate' | 'LastUpdateDate' | 'FirstPublishTime'

type RecordApiSearchSortDirection = 'Ascending' | 'Descending'

type RecordApiSearchParameters = {
  recordType: string
  count: number
  offset: number
  private: boolean
  requiredTags: string[]
  optionalTags: string[]
  excludedTags: string[]
  sortBy: RecordApiSearchSortField
  sortDirection: RecordApiSearchSortDirection
}

type WorldSearchRequestParameters = import('express-serve-static-core').ParamsDictionary | {
  term?: string
  pageIndex: number
}

type WorldSearchResult = {
  hasMoreResults: boolean
  records: WorldInfo[]
}

/**
 * A data model that contains information of the Resonite user.
 */
type User = {
  /**The username of the user. */
  username: string
}

/**
 * Common data properties found in a world or session returned by the Resonite API.
 */
type BaseWorldSessionInfo = {
  /** The plain text name of the world or session */
  title: string 
  /** The rich text name of the world or session. */
  name: string
  /** The description of the world or session. */
  description: string
}

/**
 * The world information returned by the Resonite API.
 */
type WorldInfo = BaseWorldSessionInfo | {
  /** id The record id of the world. */
  id: string
  /** The name of the owner who owns the world. */
  ownerName: string
  /** The id of the owner who owns the world. */
  ownerId: string
  /** The thumbnail image of the world as a URL. */
  thumbnailUri: string
  /** Additional tags that help define the world. */
  tags: string[]
  /** The date and time the world was first created on. */
  creationTime: string | Date
  /** The url of the world for go.resonite.com. */
  goUri: string
  /** The date and time the world was first published on. */
  firstPublishTime: string | Date
  /** The date and tiem the world was last modified on. */
  lastModificationTime: string | Date
}

/**
 * The session information returned by the Resonite API.
 */
type SessionInfo = BaseWorldSessionInfo | {
  /** The username of the host that is hosting the session. */
  hostUsername: string
  /** The number of users that are present in the session. */
  totalJoinedUsers: number
  /** The max number of users that can be in the session. */
  maxUsers: number
  /** The current FrooxEngine version that this session is running on. */
  appVersion: string
  /** The users in the current session. */
  sessionUsers: User[]
  /** The thumbnail image of the session as a URL. */
  thumbnailUrl: string
}