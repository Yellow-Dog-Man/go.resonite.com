import express from 'express';
import createError from 'http-errors';

import { preProcess } from '../helpers/preprocessing.js';
import { addMMC } from '../helpers/mmc.js';

import fs from 'node:fs';
import { createSearchRequestInit } from '../helpers/search.js';
import { getFovShotFromEquirectangularImage } from '../helpers/360-image-processing.js';
import { NO_THUMBNAIL_URL } from '../helpers/constants.js';

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {
    title: 'go.resonite.com Home'
  });
});

router.get('/credits', (req,res,next) => renderCredits(req,res,next));

router.get('/session/:sessionId', (req,res, next) => handle("session", req, res, next));
router.get(`/session/:sessionId/thumbnail`, (req, res, next) => handleThumbnail("session", req, res, next))
router.get('/session/:sessionId/json', (req,res, next) => handleJson("session", req, res, next));

router.get('/sessions', (req, res, next) => handle("sessionList", req, res, next));
router.get('/sessions/json', (req, res, next) => handleJson("sessionList", req, res, next));

router.get('/world', (req, res, next) => handle('worldList', req, res, next, createSearchRequestInit({ ...req.query, ...req.params })));
router.get('/world/json', (req, res, next) => handleJson('worldList', req, res, next, createSearchRequestInit({ ...req.query, ...req.params })));

// Register world/ and record/
for (const word of ["world", "record"]) {
  router.get(`/${word}/:ownerId/:recordId`, (req,res, next) => handle("world", req, res, next));
  router.get(`/${word}/:ownerId/:recordId/thumbnail`, (req, res, next) => handleThumbnail("world", req, res, next))
  router.get(`/${word}/:ownerId/:recordId/json`, (req,res, next) => handleJson("world", req, res, next));
}

var baseUrl = "https://api.resonite.com";

/**
 * Gets the url for either the world or session api endpoint.
 *
 * @param {HandleType} type The type of information this is whether it is a world or session.
 * @param {import('express').Request} req The web request information.
 * @returns The world or session api endpoint.
 */
function getUrl(type, req) {
  switch (type) {
    case "world":
      return `${baseUrl}/users/${req.params.ownerId}/records/${req.params.recordId}/`;
    case "worldList":
      return `${baseUrl}/records/pagedSearch`
    case "session":
      return `${baseUrl}/sessions/` + req.params.sessionId;
    case "sessionList":
      return `${baseUrl}/sessions`
    default:
      throw new Error(`Unknown url type: ${type}`);
  }
}

/**
 * Creates an error for the Web response of a failed call to the api.
 *
 * @param {Response} res The response of the api request.
 * @param {HandleType} type The type of information this is whether it is a world or session.
 * @param {string} [id=""] The world or session id.
 * @returns
 */
async function createResoniteApiError(res, type, id = "") {
  if (res.status === 404) {
    return createError(res.status, `We couldn't find this ${type}.\n
    Please check that your link is valid and the ${type} is still publicly viewable.`, {
      handleType: type,
      [`${type}Id`]: id
    });
  } else if (res.status === 403) {
    return createError(res.status, "This world is not published; therefore, it is not publicly viewable.");
  }

  var text = await res.text();
  return createError(res.status, `Resonite API returned an error: ${text}`);
}

/**
 * Handles a request for world or session information.
 *
 * @param {HandleType} type The type of information this is whether it is a world or session.
 * @param {import('express').Request} req The web request information.
 * @param {import('express').Response} res The web response object.
 * @param {import('express').NextFunction} next The function to call to proceed to the next handler.
 * @param {RequestInit?} [reqInit=undefined] The optional request body to send to the API.
 * @returns
 */
async function handle(type, req, res, next, reqInit = undefined) {
  if (type === "session" && 'force' in req.query && req.get('Sec-Fetch-User')) {
    return res.redirect(`ressession:///${req.params.sessionId}`);
  }

  try {
    var apiResponse = await fetch(getUrl(type, req), reqInit);
    if (!apiResponse.ok) {
      const { sessionId, recordId } = req.params
      var error = await createResoniteApiError(apiResponse, type, sessionId ?? recordId);
      return next(error);
    }

    var json = await apiResponse.json();

    if (type ==="world" && json.recordType !== "world") {
      return next(createError(400, "go.resonite.com only works for Session and world link."));
    }

    if (type !== 'world' && type !== 'session'){
      json.title = getOpenGraphTitle(type);
    }

    json = preProcess(json, type);
    json = addMetadata(type, json, req, reqInit);

    if (type =="world") {
      json = addMMC(json);
    }

    res.status(200).render(type, json);
  } catch (error) {
    return handleThrownError(error, next)
  }
}

/**
 * Adds metadata to the json response that is used for the pug renderer.
 * 
 * @param {HandleType} pageType The type of information this is whether it is a world or session.
 * @param {BaseWorldSessionInfo} json The JSON result from the Resonite API based on the given handle type.
 * @param {import('express').Request} req The web request information.
 * @param {RequestInit} [reqInit=undefined] The optional request body used to send to the API if defined.
 * @return BaseWorldSessionInfo
 */
function addMetadata(pageType, json, req, reqInit = undefined) {
  const urlPath = req.getUrl();
  return Object.assign(json, {
    bodyClass: pageType,
    pageType,
    query: req.query,
    params: req.params,
    urlPath,
    ogThumbnailUrl: json.thumbnailUrl !== NO_THUMBNAIL_URL ? `${urlPath}/thumbnail` : NO_THUMBNAIL_URL,
    apiInitBody: JSON.parse(reqInit?.body ?? null)
  });
}

/**
 * Handles a json request for world or session information.
 *
 * @param {HandleType} type The type of information this is whether it is a world or session.
 * @param {import('express').Request} req The web request information.
 * @param {import('express').Response} res The web response object.
 * @param {import('express').NextFunction} next The function to call to proceed to the next handler.
 * @param {RequestInit?} [reqInit=undefined] The optional request body to send to the API.
 * @returns
 */
async function handleJson(type, req, res, next, reqInit = undefined) {
  try {
    var apiResponse = await fetch(getUrl(type, req), reqInit);
    if (!apiResponse.ok) {
      var error = await createResoniteApiError(apiResponse, type);
      return next(error);
    }

    var json = await apiResponse.json();

    if (type ==="world" && json.recordType !== "world") {
      res.status(400);
      return next();
    }

    json = preProcess(json, type);
    var title = getOpenGraphTitle(type);

    res.json({
      title: title,
      author_name: title,
      author_url: req.getUrl().replace("/json",""),
      provider_name: "Resonite",
      provider_url: "https://resonite.com",
    });
  } catch (error) {
    return handleThrownError(error, next)
  }
}

/**
 * Handles the thumbnail image used of the world or session for OpenGraph.
 * 
 * @param {HandleType} type The type of information this is whether it is a world or session.
 * @param {import('express').Request} req The web request information.
 * @param {import('express').Response} res The web response object.
 * @param {import('express').NextFunction} next The function to call to proceed to the next handler.
 * @returns A non-360 image of the world or session.
 */
async function handleThumbnail(type, req, res, next) {
  try {

    // The following six lines and the try/catch are utilized commonly when handling routes that require data from
    // api.resonite.com. This is a good candidate for middleware for a router that needs to fetch this info.
    var apiResponse = await fetch(getUrl(type, req));
    if (!apiResponse.ok) {
      var error = await createResoniteApiError(apiResponse, type);
      return next(error);
    }
    var json = preProcess(await apiResponse.json(), type);

    if (json.thumbnailUrl === NO_THUMBNAIL_URL) {
      return res.redirect(NO_THUMBNAIL_URL);
    }

    res.set("Content-Type", "image/webp");
    res.status(200).send(await getFovShotFromEquirectangularImage(json.thumbnailUrl));

  } catch (error) {
    return handleThrownError(error, next)
  }
}

/**
 * Handles errors thrown when executing the route logic.
 * 
 * @param {Error} error The error that was thrown.
 * @param {import('express').NextFunction} next The function to call to proceed to the next handler.
 * @returns 
 */
async function handleThrownError(error, next) {
  console.log(error);
  return next(createError(503, "An error has occurred; please try again soon."));
}

/**
 * Generates a title for OpenGraph based on the requested type.
 *
 * @param {HandleType} type The type of information this is whether it is a world or session.
 * @returns An OpenGraph suitable title for a world or session.
 */
function getOpenGraphTitle(type) {
  var app = "Resonite";
  switch(type) {
    case "session":
      return `${app} Session`;
    case "world":
      return `${app} World`;
    case "sessionList":
      return `${app} Sessions list`;
    case "worldList":
      return `${app} World List`;
    default:
      return `${app} World`;
  }
}

var contributorsJson = null;
function renderCredits(req, res, next) {
  if (contributorsJson !== null)
    return res.render('credits', contributorsJson);

  const contributorsFile = fs.readFileSync('./.all-contributorsrc');
  contributorsJson = JSON.parse(contributorsFile);

  return res.render('credits', contributorsJson);
}



export default router;
