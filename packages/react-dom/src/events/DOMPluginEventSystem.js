/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {DOMEventName} from './DOMEventNames';
import {
  type EventSystemFlags,
  SHOULD_NOT_DEFER_CLICK_FOR_FB_SUPPORT_MODE,
  IS_LEGACY_FB_SUPPORT_MODE,
  SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS,
} from './EventSystemFlags';
import type {AnyNativeEvent} from './PluginModuleType';
import type {
  KnownReactSyntheticEvent,
  ReactSyntheticEvent,
} from './ReactSyntheticEventType';
import type {Fiber} from 'react-reconciler/src/ReactInternalTypes';

import {registrationNameDependencies, allNativeEvents} from './EventRegistry';
import {
  IS_CAPTURE_PHASE,
  IS_EVENT_HANDLE_NON_MANAGED_NODE,
  IS_NON_DELEGATED,
} from './EventSystemFlags';

import {
  HostRoot,
  HostPortal,
  HostComponent,
  HostText,
  ScopeComponent,
} from 'react-reconciler/src/ReactWorkTags';

import getEventTarget from './getEventTarget';
import {
  getClosestInstanceFromNode,
  getEventListenerSet,
  getEventHandlerListeners,
} from '../client/ReactDOMComponentTree';
import {COMMENT_NODE} from '../shared/HTMLNodeType';
import {batchedEventUpdates} from './ReactDOMUpdateBatching';
import getListener from './getListener';
import {passiveBrowserEventsSupported} from './checkPassiveEvents';

import {
  enableLegacyFBSupport,
  enableCreateEventHandleAPI,
  enableScopeAPI,
  enableEagerRootListeners,
} from 'shared/ReactFeatureFlags';
import {
  invokeGuardedCallbackAndCatchFirstError,
  rethrowCaughtError,
} from 'shared/ReactErrorUtils';
import {DOCUMENT_NODE} from '../shared/HTMLNodeType';
import {createEventListenerWrapperWithPriority} from './ReactDOMEventListener';
import {
  removeEventListener,
  addEventCaptureListener,
  addEventBubbleListener,
  addEventBubbleListenerWithPassiveFlag,
  addEventCaptureListenerWithPassiveFlag,
} from './EventListener';
import * as BeforeInputEventPlugin from './plugins/BeforeInputEventPlugin';
import * as ChangeEventPlugin from './plugins/ChangeEventPlugin';
import * as EnterLeaveEventPlugin from './plugins/EnterLeaveEventPlugin';
import * as SelectEventPlugin from './plugins/SelectEventPlugin';
import * as SimpleEventPlugin from './plugins/SimpleEventPlugin';

type DispatchListener = {|
  instance: null | Fiber,
  listener: Function,
  currentTarget: EventTarget,
|};

type DispatchEntry = {|
  event: ReactSyntheticEvent,
  listeners: Array<DispatchListener>,
|};

export type DispatchQueue = Array<DispatchEntry>;

// TODO: remove top-level side effect.
SimpleEventPlugin.registerEvents();
EnterLeaveEventPlugin.registerEvents();
ChangeEventPlugin.registerEvents();
SelectEventPlugin.registerEvents();
BeforeInputEventPlugin.registerEvents();

function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: null | EventTarget,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
) {
  // TODO: we should remove the concept of a "SimpleEventPlugin".
  // This is the basic functionality of the event system. All
  // the other plugins are essentially polyfills. So the plugin
  // should probably be inlined somewhere and have its logic
  // be core the to event system. This would potentially allow
  // us to ship builds of React without the polyfilled plugins below.
  SimpleEventPlugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer,
  );
  const shouldProcessPolyfillPlugins =
    (eventSystemFlags & SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS) === 0;
  // We don't process these events unless we are in the
  // event's native "bubble" phase, which means that we're
  // not in the capture phase. That's because we emulate
  // the capture phase here still. This is a trade-off,
  // because in an ideal world we would not emulate and use
  // the phases properly, like we do with the SimpleEvent
  // plugin. However, the plugins below either expect
  // emulation (EnterLeave) or use state localized to that
  // plugin (BeforeInput, Change, Select). The state in
  // these modules complicates things, as you'll essentially
  // get the case where the capture phase event might change
  // state, only for the following bubble event to come in
  // later and not trigger anything as the state now
  // invalidates the heuristics of the event plugin. We
  // could alter all these plugins to work in such ways, but
  // that might cause other unknown side-effects that we
  // can't forsee right now.
  if (shouldProcessPolyfillPlugins) {
    EnterLeaveEventPlugin.extractEvents(
      dispatchQueue,
      domEventName,
      targetInst,
      nativeEvent,
      nativeEventTarget,
      eventSystemFlags,
      targetContainer,
    );
    ChangeEventPlugin.extractEvents(
      dispatchQueue,
      domEventName,
      targetInst,
      nativeEvent,
      nativeEventTarget,
      eventSystemFlags,
      targetContainer,
    );
    SelectEventPlugin.extractEvents(
      dispatchQueue,
      domEventName,
      targetInst,
      nativeEvent,
      nativeEventTarget,
      eventSystemFlags,
      targetContainer,
    );
    BeforeInputEventPlugin.extractEvents(
      dispatchQueue,
      domEventName,
      targetInst,
      nativeEvent,
      nativeEventTarget,
      eventSystemFlags,
      targetContainer,
    );
  }
}

// List of events that need to be individually attached to media elements.
export const mediaEventTypes: Array<DOMEventName> = [
  'abort',
  'canplay',
  'canplaythrough',
  'durationchange',
  'emptied',
  'encrypted',
  'ended',
  'error',
  'loadeddata',
  'loadedmetadata',
  'loadstart',
  'pause',
  'play',
  'playing',
  'progress',
  'ratechange',
  'seeked',
  'seeking',
  'stalled',
  'suspend',
  'timeupdate',
  'volumechange',
  'waiting',
];

// We should not delegate these events to the container, but rather
// set them on the actual target element itself. This is primarily
// because these events do not consistently bubble in the DOM.
export const nonDelegatedEvents: Set<DOMEventName> = new Set([
  'cancel',
  'close',
  'invalid',
  'load',
  'scroll',
  'toggle',
  // In order to reduce bytes, we insert the above array of media events
  // into this Set. Note: the "error" event isn't an exclusive media event,
  // and can occur on other elements too. Rather than duplicate that event,
  // we just take it from the media events array.
  ...mediaEventTypes,
]);

function executeDispatch(
  event: ReactSyntheticEvent,
  listener: Function,
  currentTarget: EventTarget,
): void {
  const type = event.type || 'unknown-event';
  event.currentTarget = currentTarget;
  invokeGuardedCallbackAndCatchFirstError(type, listener, undefined, event);
  event.currentTarget = null;
}

function processDispatchQueueItemsInOrder(
  event: ReactSyntheticEvent,
  dispatchListeners: Array<DispatchListener>,
  inCapturePhase: boolean,
): void {
  let previousInstance;
  if (inCapturePhase) {
    for (let i = dispatchListeners.length - 1; i >= 0; i--) {
      const {instance, currentTarget, listener} = dispatchListeners[i];
      if (instance !== previousInstance && event.isPropagationStopped()) {
        return;
      }
      executeDispatch(event, listener, currentTarget);
      previousInstance = instance;
    }
  } else {
    for (let i = 0; i < dispatchListeners.length; i++) {
      const {instance, currentTarget, listener} = dispatchListeners[i];
      if (instance !== previousInstance && event.isPropagationStopped()) {
        return;
      }
      executeDispatch(event, listener, currentTarget);
      previousInstance = instance;
    }
  }
}

export function processDispatchQueue(
  dispatchQueue: DispatchQueue,
  eventSystemFlags: EventSystemFlags,
): void {
  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;
  for (let i = 0; i < dispatchQueue.length; i++) {
    const {event, listeners} = dispatchQueue[i];
    processDispatchQueueItemsInOrder(event, listeners, inCapturePhase);
    //  event system doesn't use pooling.
  }
  // This would be a good time to rethrow if any of the event handlers threw.
  rethrowCaughtError();
}

function dispatchEventsForPlugins(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  nativeEvent: AnyNativeEvent,
  targetInst: null | Fiber,
  targetContainer: EventTarget,
): void {
  const nativeEventTarget = getEventTarget(nativeEvent);
  const dispatchQueue: DispatchQueue = [];
  extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer,
  );
  processDispatchQueue(dispatchQueue, eventSystemFlags);
}

export function listenToNonDelegatedEvent(
  domEventName: DOMEventName,
  targetElement: Element,
): void {
  const isCapturePhaseListener = false;
  const listenerSet = getEventListenerSet(targetElement);
  const listenerSetKey = getListenerSetKey(
    domEventName,
    isCapturePhaseListener,
  );
  if (!listenerSet.has(listenerSetKey)) {
    addTrappedEventListener(
      targetElement,
      domEventName,
      IS_NON_DELEGATED,
      isCapturePhaseListener,
    );
    listenerSet.add(listenerSetKey);
  }
}

const listeningMarker =
  '_reactListening' +
  Math.random()
    .toString(36)
    .slice(2);

export function listenToAllSupportedEvents(rootContainerElement: EventTarget) {
  if (enableEagerRootListeners) {
    if ((rootContainerElement: any)[listeningMarker]) {
      // Performance optimization: don't iterate through events
      // for the same portal container or root node more than once.
      // TODO: once we remove the flag, we may be able to also
      // remove some of the bookkeeping maps used for laziness.
      return;
    }
    (rootContainerElement: any)[listeningMarker] = true;
    allNativeEvents.forEach(domEventName => {
      if (!nonDelegatedEvents.has(domEventName)) {
        listenToNativeEvent(
          domEventName,
          false,
          ((rootContainerElement: any): Element),
          null,
        );
      }
      listenToNativeEvent(
        domEventName,
        true,
        ((rootContainerElement: any): Element),
        null,
      );
    });
  }
}

export function listenToNativeEvent(
  domEventName: DOMEventName,
  isCapturePhaseListener: boolean,
  rootContainerElement: EventTarget,
  targetElement: Element | null,
  eventSystemFlags?: EventSystemFlags = 0,
): void {
  let target = rootContainerElement;

  // selectionchange needs to be attached to the document
  // otherwise it won't capture incoming events that are only
  // triggered on the document directly.
  if (
    domEventName === 'selectionchange' &&
    (rootContainerElement: any).nodeType !== DOCUMENT_NODE
  ) {
    target = (rootContainerElement: any).ownerDocument;
  }
  // If the event can be delegated (or is capture phase), we can
  // register it to the root container. Otherwise, we should
  // register the event to the target element and mark it as
  // a non-delegated event.
  if (
    targetElement !== null &&
    !isCapturePhaseListener &&
    nonDelegatedEvents.has(domEventName)
  ) {
    // For all non-delegated events, apart from scroll, we attach
    // their event listeners to the respective elements that their
    // events fire on. That means we can skip this step, as event
    // listener has already been added previously. However, we
    // special case the scroll event because the reality is that any
    // element can scroll.
    // TODO: ideally, we'd eventually apply the same logic to all
    // events from the nonDelegatedEvents list. Then we can remove
    // this special case and use the same logic for all events.
    if (domEventName !== 'scroll') {
      return;
    }
    eventSystemFlags |= IS_NON_DELEGATED;
    target = targetElement;
  }
  const listenerSet = getEventListenerSet(target);
  const listenerSetKey = getListenerSetKey(
    domEventName,
    isCapturePhaseListener,
  );
  // If the listener entry is empty or we should upgrade, then
  // we need to trap an event listener onto the target.
  if (!listenerSet.has(listenerSetKey)) {
    if (isCapturePhaseListener) {
      eventSystemFlags |= IS_CAPTURE_PHASE;
    }
    addTrappedEventListener(
      target,
      domEventName,
      eventSystemFlags,
      isCapturePhaseListener,
    );
    listenerSet.add(listenerSetKey);
  }
}

export function listenToReactEvent(
  reactEvent: string,
  rootContainerElement: Element,
  targetElement: Element | null,
): void {
  if (!enableEagerRootListeners) {
    const dependencies = registrationNameDependencies[reactEvent];
    const dependenciesLength = dependencies.length;
    // If the dependencies length is 1, that means we're not using a polyfill
    // plugin like ChangeEventPlugin, BeforeInputPlugin, EnterLeavePlugin
    // and SelectEventPlugin. We always use the native bubble event phase for
    // these plugins and emulate two phase event dispatching. SimpleEventPlugin
    // always only has a single dependency and SimpleEventPlugin events also
    // use either the native capture event phase or bubble event phase, there
    // is no emulation (except for focus/blur, but that will be removed soon).
    const isPolyfillEventPlugin = dependenciesLength !== 1;

    if (isPolyfillEventPlugin) {
      const listenerSet = getEventListenerSet(rootContainerElement);
      // When eager listeners are off, this Set has a dual purpose: it both
      // captures which native listeners we registered (e.g. "click__bubble")
      // and *React* lazy listeners (e.g. "onClick") so we don't do extra checks.
      // This second usage does not exist in the eager mode.
      if (!listenerSet.has(reactEvent)) {
        listenerSet.add(reactEvent);
        for (let i = 0; i < dependenciesLength; i++) {
          listenToNativeEvent(
            dependencies[i],
            false,
            rootContainerElement,
            targetElement,
          );
        }
      }
    } else {
      const isCapturePhaseListener =
        reactEvent.substr(-7) === 'Capture' &&
        // Edge case: onGotPointerCapture and onLostPointerCapture
        // end with "Capture" but that's part of their event names.
        // The Capture versions would end with CaptureCapture.
        // So we have to check against that.
        // This check works because none of the events we support
        // end with "Pointer".
        reactEvent.substr(-14, 7) !== 'Pointer';
      listenToNativeEvent(
        dependencies[0],
        isCapturePhaseListener,
        rootContainerElement,
        targetElement,
      );
    }
  }
}

function addTrappedEventListener(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  isCapturePhaseListener: boolean,
  isDeferredListenerForLegacyFBSupport?: boolean,
) {
  let listener = createEventListenerWrapperWithPriority(
    targetContainer,
    domEventName,
    eventSystemFlags,
  );
  // If passive option is not supported, then the event will be
  // active and not passive.
  let isPassiveListener = undefined;
  if (passiveBrowserEventsSupported) {
    // Browsers introduced an intervention, making these events
    // passive by default on document. React doesn't bind them
    // to document anymore, but changing this now would undo
    // the performance wins from the change. So we emulate
    // the existing behavior manually on the roots now.
    // https://github.com/facebook/react/issues/19651
    if (
      domEventName === 'touchstart' ||
      domEventName === 'touchmove' ||
      domEventName === 'wheel'
    ) {
      isPassiveListener = true;
    }
  }

  targetContainer =
    enableLegacyFBSupport && isDeferredListenerForLegacyFBSupport
      ? (targetContainer: any).ownerDocument
      : targetContainer;

  let unsubscribeListener;
  // When legacyFBSupport is enabled, it's for when we
  // want to add a one time event listener to a container.
  // This should only be used with enableLegacyFBSupport
  // due to requirement to provide compatibility with
  // internal FB www event tooling. This works by removing
  // the event listener as soon as it is invoked. We could
  // also attempt to use the {once: true} param on
  // addEventListener, but that requires support and some
  // browsers do not support this today, and given this is
  // to support legacy code patterns, it's likely they'll
  // need support for such browsers.
  if (enableLegacyFBSupport && isDeferredListenerForLegacyFBSupport) {
    const originalListener = listener;
    listener = function(...p) {
      removeEventListener(
        targetContainer,
        domEventName,
        unsubscribeListener,
        isCapturePhaseListener,
      );
      return originalListener.apply(this, p);
    };
  }
  // TODO: There are too many combinations here. Consolidate them.
  if (isCapturePhaseListener) {
    if (isPassiveListener !== undefined) {
      unsubscribeListener = addEventCaptureListenerWithPassiveFlag(
        targetContainer,
        domEventName,
        listener,
        isPassiveListener,
      );
    } else {
      unsubscribeListener = addEventCaptureListener(
        targetContainer,
        domEventName,
        listener,
      );
    }
  } else {
    if (isPassiveListener !== undefined) {
      unsubscribeListener = addEventBubbleListenerWithPassiveFlag(
        targetContainer,
        domEventName,
        listener,
        isPassiveListener,
      );
    } else {
      unsubscribeListener = addEventBubbleListener(
        targetContainer,
        domEventName,
        listener,
      );
    }
  }
}

function deferClickToDocumentForLegacyFBSupport(
  domEventName: DOMEventName,
  targetContainer: EventTarget,
): void {
  // We defer all click events with legacy FB support mode on.
  // This means we add a one time event listener to trigger
  // after the FB delegated listeners fire.
  const isDeferredListenerForLegacyFBSupport = true;
  addTrappedEventListener(
    targetContainer,
    domEventName,
    IS_LEGACY_FB_SUPPORT_MODE,
    false,
    isDeferredListenerForLegacyFBSupport,
  );
}

function isMatchingRootContainer(
  grandContainer: Element,
  targetContainer: EventTarget,
): boolean {
  return (
    grandContainer === targetContainer ||
    (grandContainer.nodeType === COMMENT_NODE &&
      grandContainer.parentNode === targetContainer)
  );
}

export function dispatchEventForPluginEventSystem(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  nativeEvent: AnyNativeEvent,
  targetInst: null | Fiber,
  targetContainer: EventTarget,
): void {
  let ancestorInst = targetInst;
  if (
    (eventSystemFlags & IS_EVENT_HANDLE_NON_MANAGED_NODE) === 0 &&
    (eventSystemFlags & IS_NON_DELEGATED) === 0
  ) {
    const targetContainerNode = ((targetContainer: any): Node);

    // If we are using the legacy FB support flag, we
    // defer the event to the null with a one
    // time event listener so we can defer the event.
    if (
      enableLegacyFBSupport &&
      // If our event flags match the required flags for entering
      // FB legacy mode and we are prcocessing the "click" event,
      // then we can defer the event to the "document", to allow
      // for legacy FB support, where the expected behavior was to
      // match React < 16 behavior of delegated clicks to the doc.
      domEventName === 'click' &&
      (eventSystemFlags & SHOULD_NOT_DEFER_CLICK_FOR_FB_SUPPORT_MODE) === 0
    ) {
      deferClickToDocumentForLegacyFBSupport(domEventName, targetContainer);
      return;
    }
    if (targetInst !== null) {
      // The below logic attempts to work out if we need to change
      // the target fiber to a different ancestor. We had similar logic
      // in the legacy event system, except the big difference between
      // systems is that the modern event system now has an event listener
      // attached to each React Root and React Portal Root. Together,
      // the DOM nodes representing these roots are the "rootContainer".
      // To figure out which ancestor instance we should use, we traverse
      // up the fiber tree from the target instance and attempt to find
      // root boundaries that match that of our current "rootContainer".
      // If we find that "rootContainer", we find the parent fiber
      // sub-tree for that root and make that our ancestor instance.
      let node = targetInst;

      mainLoop: while (true) {
        if (node === null) {
          return;
        }
        const nodeTag = node.tag;
        if (nodeTag === HostRoot || nodeTag === HostPortal) {
          let container = node.stateNode.containerInfo;
          if (isMatchingRootContainer(container, targetContainerNode)) {
            break;
          }
          if (nodeTag === HostPortal) {
            // The target is a portal, but it's not the rootContainer we're looking for.
            // Normally portals handle their own events all the way down to the root.
            // So we should be able to stop now. However, we don't know if this portal
            // was part of *our* root.
            let grandNode = node.return;
            while (grandNode !== null) {
              const grandTag = grandNode.tag;
              if (grandTag === HostRoot || grandTag === HostPortal) {
                const grandContainer = grandNode.stateNode.containerInfo;
                if (
                  isMatchingRootContainer(grandContainer, targetContainerNode)
                ) {
                  // This is the rootContainer we're looking for and we found it as
                  // a parent of the Portal. That means we can ignore it because the
                  // Portal will bubble through to us.
                  return;
                }
              }
              grandNode = grandNode.return;
            }
          }
          // Now we need to find it's corresponding host fiber in the other
          // tree. To do this we can use getClosestInstanceFromNode, but we
          // need to validate that the fiber is a host instance, otherwise
          // we need to traverse up through the DOM till we find the correct
          // node that is from the other tree.
          while (container !== null) {
            const parentNode = getClosestInstanceFromNode(container);
            if (parentNode === null) {
              return;
            }
            const parentTag = parentNode.tag;
            if (parentTag === HostComponent || parentTag === HostText) {
              node = ancestorInst = parentNode;
              continue mainLoop;
            }
            container = container.parentNode;
          }
        }
        node = node.return;
      }
    }
  }

  batchedEventUpdates(() =>
    dispatchEventsForPlugins(
      domEventName,
      eventSystemFlags,
      nativeEvent,
      ancestorInst,
      targetContainer,
    ),
  );
}

function createDispatchListener(
  instance: null | Fiber,
  listener: Function,
  currentTarget: EventTarget,
): DispatchListener {
  return {
    instance,
    listener,
    currentTarget,
  };
}

export function accumulateSinglePhaseListeners(
  targetFiber: Fiber | null,
  reactName: string | null,
  nativeEventType: string,
  inCapturePhase: boolean,
  accumulateTargetOnly: boolean,
): Array<DispatchListener> {
  const captureName = reactName !== null ? reactName + 'Capture' : null;
  const reactEventName = inCapturePhase ? captureName : reactName;
  const listeners: Array<DispatchListener> = [];

  let instance = targetFiber;
  let lastHostComponent = null;

  // Accumulate all instances and listeners via the target -> root path.
  while (instance !== null) {
    const {stateNode, tag} = instance;
    // Handle listeners that are on HostComponents (i.e. <div>)
    if (tag === HostComponent && stateNode !== null) {
      lastHostComponent = stateNode;

      // createEventHandle listeners
      if (enableCreateEventHandleAPI) {
        const eventHandlerListeners = getEventHandlerListeners(
          lastHostComponent,
        );
        if (eventHandlerListeners !== null) {
          eventHandlerListeners.forEach(entry => {
            if (
              entry.type === nativeEventType &&
              entry.capture === inCapturePhase
            ) {
              listeners.push(
                createDispatchListener(
                  instance,
                  entry.callback,
                  (lastHostComponent: any),
                ),
              );
            }
          });
        }
      }

      // Standard React on* listeners, i.e. onClick or onClickCapture
      if (reactEventName !== null) {
        const listener = getListener(instance, reactEventName);
        if (listener != null) {
          listeners.push(
            createDispatchListener(instance, listener, lastHostComponent),
          );
        }
      }
    } else if (
      enableCreateEventHandleAPI &&
      enableScopeAPI &&
      tag === ScopeComponent &&
      lastHostComponent !== null &&
      stateNode !== null
    ) {
      // Scopes
      const reactScopeInstance = stateNode;
      const eventHandlerListeners = getEventHandlerListeners(
        reactScopeInstance,
      );
      if (eventHandlerListeners !== null) {
        eventHandlerListeners.forEach(entry => {
          if (
            entry.type === nativeEventType &&
            entry.capture === inCapturePhase
          ) {
            listeners.push(
              createDispatchListener(
                instance,
                entry.callback,
                (lastHostComponent: any),
              ),
            );
          }
        });
      }
    }
    // If we are only accumulating events for the target, then we don't
    // continue to propagate through the React fiber tree to find other
    // listeners.
    if (accumulateTargetOnly) {
      break;
    }
    instance = instance.return;
  }
  return listeners;
}

// We should only use this function for:
// - BeforeInputEventPlugin
// - ChangeEventPlugin
// - SelectEventPlugin
// This is because we only process these plugins
// in the bubble phase, so we need to accumulate two
// phase event listeners (via emulation).
export function accumulateTwoPhaseListeners(
  targetFiber: Fiber | null,
  reactName: string,
): Array<DispatchListener> {
  const captureName = reactName + 'Capture';
  const listeners: Array<DispatchListener> = [];
  let instance = targetFiber;

  // Accumulate all instances and listeners via the target -> root path.
  while (instance !== null) {
    const {stateNode, tag} = instance;
    // Handle listeners that are on HostComponents (i.e. <div>)
    if (tag === HostComponent && stateNode !== null) {
      const currentTarget = stateNode;
      const captureListener = getListener(instance, captureName);
      if (captureListener != null) {
        listeners.unshift(
          createDispatchListener(instance, captureListener, currentTarget),
        );
      }
      const bubbleListener = getListener(instance, reactName);
      if (bubbleListener != null) {
        listeners.push(
          createDispatchListener(instance, bubbleListener, currentTarget),
        );
      }
    }
    instance = instance.return;
  }
  return listeners;
}

function getParent(inst: Fiber | null): Fiber | null {
  if (inst === null) {
    return null;
  }
  do {
    inst = inst.return;
    // TODO: If this is a HostRoot we might want to bail out.
    // That is depending on if we want nested subtrees (layers) to bubble
    // events to their parent. We could also go through parentNode on the
    // host node but that wouldn't work for React Native and doesn't let us
    // do the portal feature.
  } while (inst && inst.tag !== HostComponent);
  if (inst) {
    return inst;
  }
  return null;
}

/**
 * Return the lowest common ancestor of A and B, or null if they are in
 * different trees.
 */
function getLowestCommonAncestor(instA: Fiber, instB: Fiber): Fiber | null {
  let nodeA = instA;
  let nodeB = instB;
  let depthA = 0;
  for (let tempA = nodeA; tempA; tempA = getParent(tempA)) {
    depthA++;
  }
  let depthB = 0;
  for (let tempB = nodeB; tempB; tempB = getParent(tempB)) {
    depthB++;
  }

  // If A is deeper, crawl up.
  while (depthA - depthB > 0) {
    nodeA = getParent(nodeA);
    depthA--;
  }

  // If B is deeper, crawl up.
  while (depthB - depthA > 0) {
    nodeB = getParent(nodeB);
    depthB--;
  }

  // Walk in lockstep until we find a match.
  let depth = depthA;
  while (depth--) {
    if (nodeA === nodeB || (nodeB !== null && nodeA === nodeB.alternate)) {
      return nodeA;
    }
    nodeA = getParent(nodeA);
    nodeB = getParent(nodeB);
  }
  return null;
}

function accumulateEnterLeaveListenersForEvent(
  dispatchQueue: DispatchQueue,
  event: KnownReactSyntheticEvent,
  target: Fiber,
  common: Fiber | null,
  inCapturePhase: boolean,
): void {
  const registrationName = event._reactName;
  const listeners: Array<DispatchListener> = [];

  let instance = target;
  while (instance !== null) {
    if (instance === common) {
      break;
    }
    const {alternate, stateNode, tag} = instance;
    if (alternate !== null && alternate === common) {
      break;
    }
    if (tag === HostComponent && stateNode !== null) {
      const currentTarget = stateNode;
      if (inCapturePhase) {
        const captureListener = getListener(instance, registrationName);
        if (captureListener != null) {
          listeners.unshift(
            createDispatchListener(instance, captureListener, currentTarget),
          );
        }
      } else if (!inCapturePhase) {
        const bubbleListener = getListener(instance, registrationName);
        if (bubbleListener != null) {
          listeners.push(
            createDispatchListener(instance, bubbleListener, currentTarget),
          );
        }
      }
    }
    instance = instance.return;
  }
  if (listeners.length !== 0) {
    dispatchQueue.push({event, listeners});
  }
}

// We should only use this function for:
// - EnterLeaveEventPlugin
// This is because we only process this plugin
// in the bubble phase, so we need to accumulate two
// phase event listeners.
export function accumulateEnterLeaveTwoPhaseListeners(
  dispatchQueue: DispatchQueue,
  leaveEvent: KnownReactSyntheticEvent,
  enterEvent: null | KnownReactSyntheticEvent,
  from: Fiber | null,
  to: Fiber | null,
): void {
  const common = from && to ? getLowestCommonAncestor(from, to) : null;

  if (from !== null) {
    accumulateEnterLeaveListenersForEvent(
      dispatchQueue,
      leaveEvent,
      from,
      common,
      false,
    );
  }
  if (to !== null && enterEvent !== null) {
    accumulateEnterLeaveListenersForEvent(
      dispatchQueue,
      enterEvent,
      to,
      common,
      true,
    );
  }
}

export function accumulateEventHandleNonManagedNodeListeners(
  reactEventType: DOMEventName,
  currentTarget: EventTarget,
  inCapturePhase: boolean,
): Array<DispatchListener> {
  const listeners: Array<DispatchListener> = [];

  const eventListeners = getEventHandlerListeners(currentTarget);
  if (eventListeners !== null) {
    eventListeners.forEach(entry => {
      if (entry.type === reactEventType && entry.capture === inCapturePhase) {
        listeners.push(
          createDispatchListener(null, entry.callback, currentTarget),
        );
      }
    });
  }
  return listeners;
}

export function getListenerSetKey(
  domEventName: DOMEventName,
  capture: boolean,
): string {
  return `${domEventName}__${capture ? 'capture' : 'bubble'}`;
}
