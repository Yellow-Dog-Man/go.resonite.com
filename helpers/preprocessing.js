import DOMPurify from 'isomorphic-dompurify';
import { NO_THUMBNAIL_URL } from "./constants.js";

function sanitizeHTML(input) {
    return DOMPurify.sanitize(input, {ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['style']});
}

/**
 * Converts the world or session name to its HTML equivalent.
 *
 * @param {string} name The name of the world or session to sanitize.
 * @returns The processed world or session name that was sanitized.
 */
function preProcessName(name) {
    const start = /<color="?(.+?)"?>/gi;
    const end = /<\/color>/gi;
    var styleTags = name.replace(start, "<span style=\"color: $1;\">").replace(end, "</span>");
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
    json.description = preProcessName(json.description);
  }

  if (json.thumbnailUri) {
    json.thumbnailUri = json.thumbnailUri.replace("resdb:///", "https://assets.resonite.com/").replace(".webp", "");
  } else {
    json.thumbnailUri = NO_THUMBNAIL_URL;
  }
  json.thumbnailUrl = json.thumbnailUri;

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
 * Preprocesses the world or session information returned from SkyFrost
 * to make it suitable for Web viewing.
 *
 * @param {BaseWorldSessionInfo} json The world or session object from SkyFrost to transform.
 * @param {HandleType} type The type of information this is whether it is a world or session.
 * @return {BaseWorldSessionInfo} The same preprocessed world or session object for viewing.
 */
export function preProcess(json, type) {

    if (type !== "sessionList" && json.name){
        json.title = DOMPurify.sanitize(json.name, {
          ALLOWED_TAGS: []
        }); // No tags in title

        // Handle name for inclusion in the actual page.
        json.name = preProcessName(json.name);
    }

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
