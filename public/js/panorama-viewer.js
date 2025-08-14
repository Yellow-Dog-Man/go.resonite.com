import { Viewer } from "@photo-sphere-viewer/core";

const DEFAULT_ZOOM_LEVEL = 55;
const DEFAULT_FISHEYE = 0.15;
const KEYPRESS_MOVEMENT_INCREMENT = 0.0125;
const KEYPRESS_MOVEMENT_INTERVAL_TIME = 7.5;

const _viewerElementArrowKeyPressedMap = new WeakMap();
const _viewerElementTimerMap = new WeakMap();

const viewerContainers = Array.from(
  document.querySelectorAll(".panorama-viewer"),
);
for (const viwerContainer of viewerContainers) {
  const canvasContainer = viwerContainer.querySelector(
    ".panorama-viewer__canvas",
  );
  const { panorama } = viwerContainer.dataset;

  if (!panorama) {
    continue;
  }

  const viewer = new Viewer({
    container: canvasContainer,
    panorama,
    fisheye: DEFAULT_FISHEYE,
    navbar: null,
    mousewheel: false,
    keyboard: "always",
    defaultZoomLvl: DEFAULT_ZOOM_LEVEL,
    keyboardActions: null,
  });

  viewer.addEventListener("ready", onViewerReady, {
    once: true,
  });
}

/**
 * Sets up keyboard functionality and adds accessibility attributes when
 * the panorama canvas is ready.
 *
 * @param {Event} e The panorama viewer event information
 */
function onViewerReady(e) {
  /** @type HTMLElement */
  const canvasViewer = e.currentTarget.parent;
  const parentElement = canvasViewer.parentElement;

  _viewerElementArrowKeyPressedMap.set(canvasViewer, new ArrowKeyPressedMap());

  canvasViewer.addEventListener("keydown", onKeyDownInViewer);
  canvasViewer.addEventListener("keyup", onKeyUpInViewer);
  canvasViewer.addEventListener("blur", (e) =>
    clearViewerEventTimer(e.currentTarget),
  );

  canvasViewer.tabIndex = 0;

  if (parentElement.classList.contains("panorama-viewer")) {
    parentElement.classList.add("panorama-viewer--ready");
  }

  // Add required accessibility attributes.
  const canvas = canvasViewer.querySelector("canvas");
  canvas.role = "img";
  canvas.ariaLabel = canvasViewer.parentElement.dataset.imageAlt;
}

/**
 * The function to fire when a keyboard button is pressed down while focused
 * on the viewer. This is mainly for the movement of the viewer when arrow keys
 * are pressed.
 *
 * @param {KeyboardEvent} e The keyboard event information
 */
function onKeyDownInViewer(e) {
  const { key, currentTarget } = e;

  if (key === "Tab") {
    _viewerElementArrowKeyPressedMap.set(
      currentTarget,
      new ArrowKeyPressedMap(),
    );
    clearViewerEventTimer(currentTarget);
    return;
  }

  e.preventDefault();

  const arrowKeyPressedMap =
    _viewerElementArrowKeyPressedMap.get(currentTarget);
  if (arrowKeyPressedMap == null) {
    return;
  }

  arrowKeyPressedMap.updatePressed(key, true);

  if (!_viewerElementTimerMap.has(currentTarget)) {
    _viewerElementTimerMap.set(
      currentTarget,
      setInterval(() => {
        const { photoSphereViewer } = currentTarget;
        const { yaw: currentYaw, pitch: currentPitch } =
          photoSphereViewer.getPosition();
        const movementResult = arrowKeyPressedMap.getMoveResult();
        photoSphereViewer.rotate({
          pitch: currentPitch + movementResult.pitch,
          yaw: currentYaw + movementResult.yaw,
        });
      }, KEYPRESS_MOVEMENT_INTERVAL_TIME),
    );
  }
}

/**
 * The function to fire when a keyboard button is released while focused
 * on the viewer. This is mainly for the movement of the viewer when arrow keys
 * are pressed.
 *
 * @param {KeyboardEvent} e The keyboard event information
 */
function onKeyUpInViewer(e) {
  const { key, currentTarget } = e;
  const arrowKeyPressedMap =
    _viewerElementArrowKeyPressedMap.get(currentTarget);
  arrowKeyPressedMap?.updatePressed(key, false);

  if (arrowKeyPressedMap?.isAnyKeyPressed) {
    return;
  }

  clearViewerEventTimer(currentTarget);
}

/**
 * Clears the interval timer for the viewer that will stop the viewer from moving
 * via the arrow keys.
 *
 * @param {EventTarget} currentTarget The HTML element that triggered the event.
 */
function clearViewerEventTimer(currentTarget) {
  const intervalId = _viewerElementTimerMap.get(currentTarget);
  clearInterval(intervalId);
  _viewerElementTimerMap.delete(currentTarget);
}

class ArrowKeyPressedMap {
  /**
   * `true` if the up arrow key is pressed; otherwise, `false`.
   */
  #isUpArrowPressed = false;

  /**
   * `true` if the down arrow key is pressed; otherwise, `false`.
   */
  #isDownArrowPressed = false;

  /**
   * `true` if the left arrow key is pressed; otherwise, `false`.
   */
  #isLeftArrowPressed = false;

  /**
   * `true` if the right arrow key is pressed; otherwise, `false`.
   */
  #isRightArrowPressed = false;

  /**
   * `true` if any of the arrow keys are pressed; otherwise, `false`.
   */
  get isAnyKeyPressed() {
    return (
      this.#isDownArrowPressed ||
      this.#isLeftArrowPressed ||
      this.#isRightArrowPressed ||
      this.#isUpArrowPressed
    );
  }

  /**
   * Registers a key as either being pressed down or released.
   *
   * @param {"ArrowUp"|"ArrowDown"|"ArrowRight"|"ArrowLeft"} key The arrow key being pressed or relased.
   * @param {boolean} isDown `true` if the key is being pressed; otherwise, `false`.
   */
  updatePressed(key, isDown) {
    switch (key) {
      case "ArrowUp":
        this.#isUpArrowPressed = isDown;
        break;
      case "ArrowDown":
        this.#isDownArrowPressed = isDown;
        break;
      case "ArrowRight":
        this.#isRightArrowPressed = isDown;
        break;
      case "ArrowLeft":
        this.#isLeftArrowPressed = isDown;
        break;
    }
  }

  /**
   * Returns the movement data for the pitch and yaw that should be added or subtracted
   * from the current pitch and yaw.
   *
   * @returns The pitch and yaw values to add or subtract from the current pitch and yaw.
   */
  getMoveResult() {
    let pitch = 0;
    let yaw = 0;

    if (this.#isUpArrowPressed) {
      pitch += KEYPRESS_MOVEMENT_INCREMENT;
    }
    if (this.#isDownArrowPressed) {
      pitch -= KEYPRESS_MOVEMENT_INCREMENT;
    }
    if (this.#isRightArrowPressed) {
      yaw += KEYPRESS_MOVEMENT_INCREMENT;
    }
    if (this.#isLeftArrowPressed) {
      yaw -= KEYPRESS_MOVEMENT_INCREMENT;
    }

    return {
      pitch,
      yaw,
    };
  }
}
