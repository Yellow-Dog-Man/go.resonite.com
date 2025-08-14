import DOMPurify from "isomorphic-dompurify";
import { NO_THUMBNAIL_URL } from "./constants.js";

const COLOR_REGEX = /<color[=\s]\s*(?<colorValue>("?).+?\2)\s*>/gi;

const COLOR_HEX_REGEX = /^(?<hexValue>#[\da-f]{8}|#[\da-f]{6}|#[\da-f]{3,4})$/i;
const COLOR_PALETTE_REGEX =
  /^("?)(?<paletteName>hero|mid|sub|dark)\.(?<colorName>yellow|green|red|purple|cyan|orange)\1$|^("?)(?<paletteName>neutrals)\.(?<colorName>dark|mid|light)\4$/i;
const COLOR_NAME_REGEX =
  /^("?)(?<colorName>white|gray|black|red|green|blue|yellow|cyan|magenta|orange|purple|lime|pink|brown|clear)\1$/i;

function sanitizeHTML(input) {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ["span"],
    ALLOWED_ATTR: ["style"],
  });
}

/**
 * Removes all tags from the given text
 *
 * @param {string} input The text to strip tags from.
 * @returns The processed text that was sanitized.
 */
function stripTags(input) {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

/**
 * Converts the world or session name to its HTML equivalent.
 *
 * **Note**: Currently, only a simple regex replacement for color is used. In the future, a lexer will be used to
 * properly parse FrooxEngine tags.
 *
 * @param {string} name The name of the world or session to sanitize.
 * @returns The processed world or session name that was sanitized.
 */
export function preProcessName(name) {
  const htmlName = name
    ?.replace(COLOR_REGEX, (matchedString, ...groups) => {
      const { colorValue } = groups.at(-1);

      /** @type RegExpExecArray */
      let valueMatch;
      /** @type string */
      let validColorValue;

      if ((valueMatch = COLOR_HEX_REGEX.exec(colorValue))) {
        validColorValue = valueMatch.groups.hexValue.toLowerCase();
      } else if ((valueMatch = COLOR_PALETTE_REGEX.exec(colorValue))) {
        const { paletteName, colorName } = valueMatch.groups;

        validColorValue = `var(--color-${paletteName.toLowerCase()}-${colorName.toLowerCase()})`;
      } else if ((valueMatch = COLOR_NAME_REGEX.exec(colorValue))) {
        const colorName = valueMatch.groups.colorName.toLowerCase();

        validColorValue = colorName !== "clear" ? colorName : "transparent";
      }

      return valueMatch == null
        ? matchedString
        : `<span style="color: ${validColorValue}">`;
    })
    .replaceAll("</color>", "</span>");

  return sanitizeHTML(htmlName);
}

/**
 * Preprocesses the session information returned from SkyFrost to a format suitable for viewing.
 *
 * @param {SessionInfo} json The session object from SkyFrost to transform.
 * @returns The transformed session object for viewing.
 */
function preProcessSession(json) {
  if (!json.thumbnailUrl) {
    json.thumbnailUrl = NO_THUMBNAIL_URL;
  }

  json.description =
    `Host: ${json.hostUsername}.\n` +
    `Users ${json.totalJoinedUsers}/${json.maxUsers}:${json.sessionUsers.map((user) => user.username).join(", ")}.\n` +
    `Version: ${json.appVersion}`;

  addGoUrls(json, `/session/${json.sessionId}`);

  return json;
}

/**
 * Preprocesses the session list and returns an array of the top X sessions to display on the webpage.
 *
 * @param {SessionsList} json object of the full session API endpoint
 * @param {SessionCount} int number of sessions to return for the page
 * @returns The transformed sessions object for viewing.
 */
function preProcessSessionList(json, count) {
  const sessions = json
    .sort((a, b) => b.totalJoinedUsers - a.totalJoinedUsers)
    .slice(0, count);

  json.sessions = sessions.map((session) => {
    // We convert the name here since the JSON format for
    // this is different from the other responses
    session.name = preProcessName(session.name);
    return preProcessSession(session);
  });

  return json;
}

/**
 * Preprocesses the world information return from SkyFrost to a format suitable for viewing.
 *
 * @param {WorldInfo} json The world object from SkyFrost to transform.
 * @returns The preprocessed world information for viewing.
 */
function preProcessWorld(json) {
  if (json.description) {
    // Sanitize the Open Graph meta description from tags
    json.ogDescription = stripTags(json.description);

    json.description = preProcessName(json.description);
  }

  if (json.thumbnailUri) {
    json.thumbnailUri = json.thumbnailUri
      .replace("resdb:///", "https://assets.resonite.com/")
      .replace(".webp", "");
  } else {
    json.thumbnailUri = NO_THUMBNAIL_URL;
  }
  // Handle thumbnailUri and thumbnailUrl quirk by also assigning thumbnailUrl for worlds.
  json.thumbnailUrl = json.thumbnailUri;
  // TODO: there should be a standardized variable name for thumbnail urls.

  json.isFeatured = !!json.submissions?.[0]?.featured;
  // Convert to UTC to have a standard timezone
  // This also helps people document worlds on the wiki
  json.firstPublishTime = new Date(json.firstPublishTime).toUTCString();
  json.lastModificationTime = new Date(json.lastModificationTime).toUTCString();
  json.creationTime = new Date(json.creationTime).toUTCString();
  json.isPublished = json.submissions != null && json.submissions.length > 0;

  addGoUrls(json, `/world/${json.ownerId}/${json.id}`);

  return json;
}

/**
 * Preprocesses an array of world information to a format suitable for viewing.
 *
 * @param {WorldSearchResult} json The response returned that contains an array of found worlds.
 * @return {WorldSearchResult} The same preprocessed world passed in.
 */
function preProcessWorldList(json) {
  for (const world of json.records) {
    world.name = preProcessName(world.name);
    preProcessWorld(world);
  }

  return json;
}

/**
 * Adds go.resonite.com URLs to the world or session JSON.
 *
 * @param {BaseWorldSessionInfo} json The world or session object from SkyFrost to transform.
 * @param {string} goUrl The base url for the world or session
 */
function addGoUrls(json, goUrl) {
  json.goUri = goUrl;
  json.go360ImageUrl = `${goUrl}/360-image`;
  json.goThumbnailUrl = `${goUrl}/thumbnail`;
}

/**
 * Adds meta-data suitable for any response.
 * @param {BaseWorldSessionInfo} json
 * @return {WorldSearchResult} The same preprocessed world passed in.
 * TODO: pug/express probably has a better way to handle this
 */
function addMetadata(json) {
  json.noThumbnailUrl = NO_THUMBNAIL_URL;

  return json;
}

/**
 * Preprocesses the world or session information returned from SkyFrost
 * to make it suitable for Web viewing.
 *
 * @param {BaseWorldSessionInfo} json The world or session object from SkyFrost to transform.
 * @param {HandleType} type The type of information this is whether it is a world or session.
 * @return {BaseWorldSessionInfo} The same preprocessed world or session object for viewing.
 */
export function preProcess(json, type) {
  if (type !== "sessionList" && json.name) {
    json.title = stripTags(json.name); // No tags in title

    // Handle name for inclusion in the actual page.
    json.name = preProcessName(json.name);
  }

  json = addMetadata(json);

  switch (type) {
    case "session":
      json = preProcessSession(json);
      break;
    case "world":
      json = preProcessWorld(json);
      break;
    case "sessionList":
      json = preProcessSessionList(json, 15);
      break;
    case "worldList":
      json = preProcessWorldList(json);
      break;
  }

  return json;
}
