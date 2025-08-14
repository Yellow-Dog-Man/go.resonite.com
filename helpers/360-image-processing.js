import sharp from "sharp";
import { glMatrix, vec3, mat4 } from "gl-matrix";

// Helps with Performance for modern JS engines
glMatrix.setMatrixArrayType(Array);

const OUTPUT_WIDTH = 750;
const OUTPUT_HEIGHT = 750;
const OUTPUT_EXTRACT_HEIGHT = Math.round(OUTPUT_HEIGHT / 2);
const OUTPUT_EXTRACT_TOP = Math.round(OUTPUT_EXTRACT_HEIGHT / 2);
const CHANNELS = 4;

const FOV = 90;
const YAW = 180;
const PITCH = 0;
const NEAR_NUM = 0.05;
const FAR_NUM = 10;

const degToRad = (deg) => (deg * Math.PI) / 180;

/**
 * Extracts a FOV shot from an equirectangular thumbnail image.
 *
 * @param {import('sharp').Sharp} imagePipe The image pipe of the image to perform image operations on.
 * @returns
 */
export async function getFovShotFromEquirectangularImage(imagePipe) {
  const { width: inputWidth, height: inputHeight } = await imagePipe.metadata();
  const inputBuffer = await imagePipe.ensureAlpha().raw().toBuffer();
  const inputData = new Uint8Array(inputBuffer);

  const outputData = new Uint8Array(OUTPUT_WIDTH * OUTPUT_HEIGHT * 4);

  const projectionMtx = mat4.create();
  mat4.perspective(
    projectionMtx,
    degToRad(FOV),
    OUTPUT_WIDTH / OUTPUT_HEIGHT,
    NEAR_NUM,
    FAR_NUM,
  );

  const viewMtx = mat4.create();
  mat4.rotateX(viewMtx, viewMtx, degToRad(PITCH));
  mat4.rotateX(viewMtx, viewMtx, degToRad(YAW));

  for (let y = 0; y < OUTPUT_HEIGHT; y++) {
    for (let x = 0; x < OUTPUT_WIDTH; x++) {
      const normalizedX = (x / OUTPUT_WIDTH) * 2 - 1;
      const normalizedY = (y / OUTPUT_HEIGHT) * 2 - 1;

      // Initial vector in POV
      const direction = vec3.fromValues(normalizedX, normalizedY, -1);
      vec3.transformMat4(direction, direction, projectionMtx);
      vec3.transformMat4(direction, direction, viewMtx);
      vec3.normalize(direction, direction);

      // Spherical coordinates
      const [dirX, dirY, dirZ] = direction;
      const longitude = Math.atan2(dirX, -dirZ);
      const latitude = Math.asin(dirY);

      // UV mapping for equirectangular images
      const u = 0.5 + longitude / (2 * Math.PI);
      const v = 0.5 - latitude / Math.PI;

      // Map UV to pixel coordinates and copy data to output buffer
      const srcX = Math.floor(u * inputWidth);
      const srcY = Math.floor(v * inputHeight);

      const srcIndex = (srcY * inputWidth + srcX) * CHANNELS;
      const distIndex = (y * OUTPUT_WIDTH + x) * CHANNELS;

      outputData[distIndex] = inputData[srcIndex];
      outputData[distIndex + 1] = inputData[srcIndex + 1];
      outputData[distIndex + 2] = inputData[srcIndex + 2];
      outputData[distIndex + 3] = inputData[srcIndex + 3];
    }
  }

  const outputBuffer = await sharp(outputData, {
    raw: {
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      channels: CHANNELS,
    },
  })
    .extract({
      width: OUTPUT_WIDTH,
      height: OUTPUT_EXTRACT_HEIGHT,
      top: OUTPUT_EXTRACT_TOP,
      left: 0,
    })
    .webp()
    .toBuffer();

  return outputBuffer;
}

/**
 * Fetch an image based on the given URL. These are usually images from assets.resonite.com.
 *
 * @param {string|URL} url The url of the asset.
 * @param {string?} eTagFromRequest The eTag value that was given from a previous request for the asset.
 * @returns {Promise<FetchImageResponse>} The response of the image fetch.
 */
export async function fetchImage(url, eTagFromRequest = null) {
  const response = await fetch(url);
  const eTagFromResponse = response.headers.get("etag");

  const isNewerImage =
    eTagFromRequest == null || eTagFromRequest !== eTagFromResponse;

  const imagePipe =
    response.ok && isNewerImage ? sharp(await response.arrayBuffer()) : null;

  return {
    imagePipe,
    httpStatusCode: response.status,
    isOk: response.ok,
    isNewerImage,
    contentType: response.headers.get("content-type"),
    eTag: eTagFromResponse,
  };
}
