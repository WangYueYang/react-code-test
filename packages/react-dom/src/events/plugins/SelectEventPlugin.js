/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {AnyNativeEvent} from '../PluginModuleType';
import type {DOMEventName} from '../DOMEventNames';
import type {DispatchQueue} from '../DOMPluginEventSystem';
import type {EventSystemFlags} from '../EventSystemFlags';

import {canUseDOM} from 'shared/ExecutionEnvironment';
import {SyntheticEvent} from '../../events/SyntheticEvent';
import isTextInputElement from '../isTextInputElement';
import shallowEqual from 'shared/shallowEqual';
import {enableEagerRootListeners} from 'shared/ReactFeatureFlags';

import {registerTwoPhaseEvent} from '../EventRegistry';
import getActiveElement from '../../client/getActiveElement';
import {
  getNodeFromInstance,
  getEventListenerSet,
} from '../../client/ReactDOMComponentTree';
import {hasSelectionCapabilities} from '../../client/ReactInputSelection';
import {DOCUMENT_NODE} from '../../shared/HTMLNodeType';
import {accumulateTwoPhaseListeners} from '../DOMPluginEventSystem';

const skipSelectionChangeEvent =
  canUseDOM && 'documentMode' in document && document.documentMode <= 11;

function registerEvents() {
  registerTwoPhaseEvent('onSelect', [
    'focusout',
    'contextmenu',
    'dragend',
    'focusin',
    'keydown',
    'keyup',
    'mousedown',
    'mouseup',
    'selectionchange',
  ]);
}

let activeElement = null;
let activeElementInst = null;
let lastSelection = null;
let mouseDown = false;

/**
 * Get an object which is a unique representation of the current selection.
 *
 * The return value will not be consistent across nodes or browsers, but
 * two identical selections on the same node will return identical objects.
 */
function getSelection(node: any) {
  if ('selectionStart' in node && hasSelectionCapabilities(node)) {
    return {
      start: node.selectionStart,
      end: node.selectionEnd,
    };
  } else {
    const win =
      (node.ownerDocument && node.ownerDocument.defaultView) || window;
    const selection = win.getSelection();
    return {
      anchorNode: selection.anchorNode,
      anchorOffset: selection.anchorOffset,
      focusNode: selection.focusNode,
      focusOffset: selection.focusOffset,
    };
  }
}

/**
 * Get document associated with the event target.
 */
function getEventTargetDocument(eventTarget: any) {
  return eventTarget.window === eventTarget
    ? eventTarget.document
    : eventTarget.nodeType === DOCUMENT_NODE
    ? eventTarget
    : eventTarget.ownerDocument;
}

/**
 * Poll selection to see whether it's changed.
 *
 * @param {object} nativeEvent
 * @param {object} nativeEventTarget
 * @return {?SyntheticEvent}
 */
function constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget) {
  // Ensure we have the right element, and that the user is not dragging a
  // selection (this matches native `select` event behavior). In HTML5, select
  // fires only on input and textarea thus if there's no focused element we
  // won't dispatch.
  const doc = getEventTargetDocument(nativeEventTarget);

  if (
    mouseDown ||
    activeElement == null ||
    activeElement !== getActiveElement(doc)
  ) {
    return;
  }

  // Only fire when selection has actually changed.
  const currentSelection = getSelection(activeElement);
  if (!lastSelection || !shallowEqual(lastSelection, currentSelection)) {
    lastSelection = currentSelection;

    const listeners = accumulateTwoPhaseListeners(
      activeElementInst,
      'onSelect',
    );
    if (listeners.length > 0) {
      const event = new SyntheticEvent(
        'onSelect',
        'select',
        null,
        nativeEvent,
        nativeEventTarget,
      );
      dispatchQueue.push({event, listeners});
      event.target = activeElement;
    }
  }
}

/**
 * This plugin creates an `onSelect` event that normalizes select events
 * across form elements.
 *
 * Supported elements are:
 * - input (see `isTextInputElement`)
 * - textarea
 * - contentEditable
 *
 * This differs from native browser implementations in the following ways:
 * - Fires on contentEditable fields as well as inputs.
 * - Fires for collapsed selection.
 * - Fires after user input.
 */
function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: null | EventTarget,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
) {
  if (!enableEagerRootListeners) {
    const eventListenerSet = getEventListenerSet(targetContainer);
    // Track whether all listeners exists for this plugin. If none exist, we do
    // not extract events. See #3639.
    if (
      // If we are handling selectionchange, then we don't need to
      // check for the other dependencies, as selectionchange is only
      // event attached from the onChange plugin and we don't expose an
      // onSelectionChange event from React.
      domEventName !== 'selectionchange' &&
      !eventListenerSet.has('onSelect') &&
      !eventListenerSet.has('onSelectCapture')
    ) {
      return;
    }
  }

  const targetNode = targetInst ? getNodeFromInstance(targetInst) : window;

  switch (domEventName) {
    // Track the input node that has focus.
    case 'focusin':
      if (
        isTextInputElement((targetNode: any)) ||
        targetNode.contentEditable === 'true'
      ) {
        activeElement = targetNode;
        activeElementInst = targetInst;
        lastSelection = null;
      }
      break;
    case 'focusout':
      activeElement = null;
      activeElementInst = null;
      lastSelection = null;
      break;
    // Don't fire the event while the user is dragging. This matches the
    // semantics of the native select event.
    case 'mousedown':
      mouseDown = true;
      break;
    case 'contextmenu':
    case 'mouseup':
    case 'dragend':
      mouseDown = false;
      constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
      break;
    // Chrome and IE fire non-standard event when selection is changed (and
    // sometimes when it hasn't). IE's event fires out of order with respect
    // to key and input events on deletion, so we discard it.
    //
    // Firefox doesn't support selectionchange, so check selection status
    // after each key entry. The selection changes after keydown and before
    // keyup, but we check on keydown as well in the case of holding down a
    // key, when multiple keydown events are fired but only one keyup is.
    // This is also our approach for IE handling, for the reason above.
    case 'selectionchange':
      if (skipSelectionChangeEvent) {
        break;
      }
    // falls through
    case 'keydown':
    case 'keyup':
      constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
  }
}

export {registerEvents, extractEvents};
