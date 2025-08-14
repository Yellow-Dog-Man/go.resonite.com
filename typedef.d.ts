type HandleType = "world" | "worldList" | "session" | "sessionList";

type RecordApiSearchSortField =
  | "CreationDate"
  | "LastUpdateDate"
  | "FirstPublishTime";

type RecordApiSearchSortDirection = "Ascending" | "Descending";

type RecordApiSearchParameters = {
  recordType: string;
  count: number;
  offset: number;
  private: boolean;
  requiredTags: string[];
  optionalTags: string[];
  excludedTags: string[];
  sortBy: RecordApiSearchSortField;
  sortDirection: RecordApiSearchSortDirection;
};

type WorldSearchRequestParameters =
  | import("express-serve-static-core").ParamsDictionary
  | {
      /** The search string that determines what worlds to return in the results. */
      term?: string;
      /** The current page number that determines which part of the world results to return. The number `0` is the first page. */
      pageIndex: number;
      /** `true` if only featured worlds should be returned from the results; otherwise, `false`. */
      featuredOnly: boolean;
    };

type WorldSearchResult = {
  hasMoreResults: boolean;
  records: WorldInfo[];
};

/**
 * A data model that contains information of the Resonite user.
 */
type User = {
  /**The username of the user. */
  username: string;
};

/**
 * Common data properties found in a world or session returned by the Resonite API.
 */
type BaseWorldSessionInfo = {
  /** The plain text name of the world or session */
  title: string;
  /** The rich text name of the world or session. */
  name: string;
  /** The description of the world or session. */
  description: string;
  /** The url of the world or session for go.resonite.com. */
  goUri: string;
  /** The url of the equirectangular (360) image for the world or session on go.resonite.com */
  go360ImageUrl: string;
  /** The url of the thumbnail image for the world or session on go.resonite.com */
  goThumbnailUrl: string;
};

/**
 * The world information returned by the Resonite API.
 */
type WorldInfo =
  | BaseWorldSessionInfo
  | {
      /** id The record id of the world. */
      id: string;
      /** The name of the owner who owns the world. */
      ownerName: string;
      /** The id of the owner who owns the world. */
      ownerId: string;
      /** The thumbnail image of the world as a URL. */
      thumbnailUri: string;
      /** Additional tags that help define the world. */
      tags: string[];
      /** The date and time the world was first created on. */
      creationTime: string | Date;
      /** The url of the world for go.resonite.com. */
      goUri: string;
      /** The date and time the world was first published on. */
      firstPublishTime: string | Date;
      /** The date and tiem the world was last modified on. */
      lastModificationTime: string | Date;
    };

/**
 * The session information returned by the Resonite API.
 */
type SessionInfo =
  | BaseWorldSessionInfo
  | {
      /** The username of the host that is hosting the session. */
      hostUsername: string;
      /** The number of users that are present in the session. */
      totalJoinedUsers: number;
      /** The max number of users that can be in the session. */
      maxUsers: number;
      /** The current FrooxEngine version that this session is running on. */
      appVersion: string;
      /** The users in the current session. */
      sessionUsers: User[];
      /** The thumbnail image of the session as a URL. */
      thumbnailUrl: string;
    };

/**
 * Configuration data used to examine a world and determine if it is an MMC entry.
 */
type MmcConfig = {
  /** The year that the MMC event was hosted in. */
  year: number;
  /** The identifying competition tag for the MMC event. */
  competitionTag: string;
  /** An additional identifying competition tag for the MMC event. */
  competitionOtherTag?: string;
  /** The official start date of the competition. This is usually the kickoff date. */
  startDate: Date;
  /** The official end date of the competition. This is usually the awards ceremony date. */
  endDate: Date;
  /** The relative URL path of the Wiki page for the MMC event. */
  wikiPath: string;
  /** The list of categories that an entry can be tagged with. */
  categories: MmcCategory[];
};

/**
 * MMC category data that contains either a friendly name of the category or
 * a map of additional `MmcCategory` objects (i.e., subcategories).
 */
type MmcCategory = {
  /** The friendly name of the category. */
  title: string;
  /** The parent category of this category. If `null`, then this  */
  parent: MmcCategory;
  /** The tags that are required for the category.*/
  requiredTags: string[];
  /** A unique key to help distinguish the category from others. */
  tagKey: string;
};

/**
 * The search result model when searching for a particular MMC configuration.
 */
type MmcConfigSearchResult = {
  /** The MMC configuration found. */
  mmcConfig: MmcConfig;
  /** `true` if the competition tag found in the world's tags is valid (i.e., the casing matches); otherwise, `false`. */
  isValidCompetitionTag: boolean;
  /** `true` if the competition is currently active; otherwise, `false` */
  isCompetitionActive: boolean;
};

/**
 * The fetch result of an image asset.
 */
type FetchImageResponse = {
  /** The image pipe of the image to perform image operations on. */
  imagePipe: import("sharp").Sharp?;
  /** The HTTP status returned when trying to retrieve the image. */
  httpStatusCode: number;
  /** `true` if the https status code of the response is within 2xx; otherwise, `false`. */
  isOk: boolean;
  /** `true` if the given eTag does not match the eTag from the response or if an eTag was never given; otherwise, `false`. */
  isNewerImage: boolean;
  /** The content type of the image. */
  contentType: string;
  /** The eTag value of the image. */
  eTag: string;
};
