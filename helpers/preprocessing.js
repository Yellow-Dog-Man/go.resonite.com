import DOMPurify from 'isomorphic-dompurify';
import { NO_THUMBNAIL_URL } from "./constants.js";

const START_COLOR_REGEX = /<color[=\s]\s*("?)(.+?)\1\s*>/i;
// This matches supported hex values for color, supported color names, 'clear', and palette names.
const START_COLOR_STRICT_REGEX = /<color[=\s]\s*((?<resoValue>#[\da-f]{8}|#[\da-f]{6}|#[\da-f]{3,4})|(?:("?)(?<resoValue>white|gray|black|red|green|blue|yellow|cyan|magenta|orange|purple|lime|pink|brown)\3)|("?)(?<resoValue>clear)\5|("?)(?:(?<paletteName>hero|mid|sub|dark)\.(?<paletteSubType>yellow|green|red|purple|cyan|orange))\7|(?:("?)(?<paletteName>neutrals)\.(?<paletteSubType>dark|mid|light)\10))\s*>/gi;
const END_COLOR_REGEX = /<\/color>/gi;

function sanitizeHTML(input) {
    return DOMPurify.sanitize(input, {ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['style']});
}

/**
 * Removes all tags from the given text
 *
 * @param {string} input The text to strip tags from.
 * @returns The processed text that was sanitized.
 */
function stripTags(input) {
    return DOMPurify.sanitize(input, {ALLOWED_TAGS: []});
}

/**
 * Converts the world or session name to its HTML equivalent.
 *
 * @param {string} name The name of the world or session to sanitize.
 * @returns The processed world or session name that was sanitized.
 */
export function preProcessName(name) {
    let styleTags = name;

    if (styleTags.match(START_COLOR_REGEX)) {
      styleTags = name
        .replace(START_COLOR_STRICT_REGEX, (...args) => {
          /**  */
          const { resoValue, paletteName, paletteSubType } = args.at(-1);

          let colorValue = resoValue?.toLowerCase() ??
            `var(--color-${paletteName.toLowerCase()}-${paletteSubType.toLowerCase()})`;

          if (colorValue === 'clear') {
            colorValue = 'transparent';
          }

          return `<span style="color: ${colorValue}">`;
        })
        .replace(END_COLOR_REGEX, "</span>");
    }

    return sanitizeHTML(styleTags);
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

  json.description = `Host: ${json.hostUsername}.\n` +
        `Users ${json.totalJoinedUsers}/${json.maxUsers}:${json.sessionUsers.map(user => user.username).join(", ")}.\n`+
    `Version: ${json.appVersion}`;

    return json;
}

/**
 * Preprocesses the session list and returns an array of the top X sessions to display on the webpage.
 *
 * @param {SessionsList} json object of the full session API endpoint
 * @param {SessionCount} int number of sessions to return for the page
 * @returns The transformed sessions object for viewing.
 */
function preProcessSessionList(json, count){
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
    json.thumbnailUri = json.thumbnailUri.replace("resdb:///", "https://assets.resonite.com/").replace(".webp", "");
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
    world.name = preProcessName(world.name)
    world.goUri = `/world/${world.ownerId}/${world.id}`
    preProcessWorld(world)
  }

  return json;
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
