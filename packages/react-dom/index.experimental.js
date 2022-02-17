/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

export {
  createPortal,
  unstable_batchedUpdates,
  flushSync,
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
  version,
  // Disabled behind disableLegacyReactDOMAPIs
  findDOMNode,
  hydrate,
  render,
  unmountComponentAtNode,
  // exposeConcurrentModeAPIs
  createRoot as unstable_createRoot,
  createBlockingRoot as unstable_createBlockingRoot,
  unstable_flushControlled,
  unstable_scheduleHydration,
  // DO NOT USE: Temporarily exposing this to migrate off of Scheduler.runWithPriority.
  unstable_runWithPriority,
  // Disabled behind disableUnstableRenderSubtreeIntoContainer
  unstable_renderSubtreeIntoContainer,
  // Disabled behind disableUnstableCreatePortal
  // Temporary alias since we already shipped React 16 RC with it.
  // TODO: remove in React 18.
  unstable_createPortal,
} from './src/client/ReactDOM';
