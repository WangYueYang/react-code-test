/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {NormalizedWheelDelta} from './utils/normalizeWheel';
import type {Point} from './geometry';

import {useEffect} from 'react';
import {normalizeWheel} from './utils/normalizeWheel';

export type MouseDownInteraction = {|
  type: 'mousedown',
  payload: {|
    event: MouseEvent,
    location: Point,
  |},
|};
export type MouseMoveInteraction = {|
  type: 'mousemove',
  payload: {|
    event: MouseEvent,
    location: Point,
  |},
|};
export type MouseUpInteraction = {|
  type: 'mouseup',
  payload: {|
    event: MouseEvent,
    location: Point,
  |},
|};
export type WheelPlainInteraction = {|
  type: 'wheel-plain',
  payload: {|
    event: WheelEvent,
    location: Point,
    delta: NormalizedWheelDelta,
  |},
|};
export type WheelWithShiftInteraction = {|
  type: 'wheel-shift',
  payload: {|
    event: WheelEvent,
    location: Point,
    delta: NormalizedWheelDelta,
  |},
|};
export type WheelWithControlInteraction = {|
  type: 'wheel-control',
  payload: {|
    event: WheelEvent,
    location: Point,
    delta: NormalizedWheelDelta,
  |},
|};
export type WheelWithMetaInteraction = {|
  type: 'wheel-meta',
  payload: {|
    event: WheelEvent,
    location: Point,
    delta: NormalizedWheelDelta,
  |},
|};

export type Interaction =
  | MouseDownInteraction
  | MouseMoveInteraction
  | MouseUpInteraction
  | WheelPlainInteraction
  | WheelWithShiftInteraction
  | WheelWithControlInteraction
  | WheelWithMetaInteraction;

let canvasBoundingRectCache = null;
function cacheFirstGetCanvasBoundingRect(
  canvas: HTMLCanvasElement,
): ClientRect {
  if (
    canvasBoundingRectCache &&
    canvas.width === canvasBoundingRectCache.width &&
    canvas.height === canvasBoundingRectCache.height
  ) {
    return canvasBoundingRectCache.rect;
  }
  canvasBoundingRectCache = {
    width: canvas.width,
    height: canvas.height,
    rect: canvas.getBoundingClientRect(),
  };
  return canvasBoundingRectCache.rect;
}

export function useCanvasInteraction(
  canvasRef: {|current: HTMLCanvasElement | null|},
  interactor: (interaction: Interaction) => void,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    function localToCanvasCoordinates(localCoordinates: Point): Point {
      const canvasRect = cacheFirstGetCanvasBoundingRect(canvas);
      return {
        x: localCoordinates.x - canvasRect.left,
        y: localCoordinates.y - canvasRect.top,
      };
    }

    const onCanvasMouseDown: MouseEventHandler = event => {
      interactor({
        type: 'mousedown',
        payload: {
          event,
          location: localToCanvasCoordinates({x: event.x, y: event.y}),
        },
      });
    };

    const onDocumentMouseMove: MouseEventHandler = event => {
      interactor({
        type: 'mousemove',
        payload: {
          event,
          location: localToCanvasCoordinates({x: event.x, y: event.y}),
        },
      });
    };

    const onDocumentMouseUp: MouseEventHandler = event => {
      interactor({
        type: 'mouseup',
        payload: {
          event,
          location: localToCanvasCoordinates({x: event.x, y: event.y}),
        },
      });
    };

    const onCanvasWheel: WheelEventHandler = event => {
      event.preventDefault();
      event.stopPropagation();

      const location = localToCanvasCoordinates({x: event.x, y: event.y});
      const delta = normalizeWheel(event);

      if (event.shiftKey) {
        interactor({
          type: 'wheel-shift',
          payload: {event, location, delta},
        });
      } else if (event.ctrlKey) {
        interactor({
          type: 'wheel-control',
          payload: {event, location, delta},
        });
      } else if (event.metaKey) {
        interactor({
          type: 'wheel-meta',
          payload: {event, location, delta},
        });
      } else {
        interactor({
          type: 'wheel-plain',
          payload: {event, location, delta},
        });
      }

      return false;
    };

    document.addEventListener('mousemove', onDocumentMouseMove);
    document.addEventListener('mouseup', onDocumentMouseUp);

    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('wheel', onCanvasWheel);

    return () => {
      document.removeEventListener('mousemove', onDocumentMouseMove);
      document.removeEventListener('mouseup', onDocumentMouseUp);

      canvas.removeEventListener('mousedown', onCanvasMouseDown);
      canvas.removeEventListener('wheel', onCanvasWheel);
    };
  }, [canvasRef, interactor]);
}
