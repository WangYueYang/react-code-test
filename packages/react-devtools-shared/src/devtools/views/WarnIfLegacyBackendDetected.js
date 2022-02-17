/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import * as React from 'react';
import {Fragment, useContext, useEffect} from 'react';
import {BridgeContext} from './context';
import {ModalDialogContext} from './ModalDialog';

import styles from './WarnIfLegacyBackendDetected.css';

export default function WarnIfLegacyBackendDetected(_: {||}) {
  const bridge = useContext(BridgeContext);
  const {dispatch} = useContext(ModalDialogContext);

  // Detect pairing with legacy v3 backend.
  // We do this by listening to a message that it broadcasts but the v4 backend doesn't.
  // In this case the frontend should show upgrade instructions.
  useEffect(() => {
    // Wall.listen returns a cleanup function
    let unlisten = bridge.wall.listen(message => {
      switch (message.type) {
        case 'call':
        case 'event':
        case 'many-events':
          // Any of these types indicate the v3 backend.
          dispatch({
            canBeDismissed: false,
            type: 'SHOW',
            title: 'DevTools v4 is incompatible with this version of React',
            content: <InvalidBackendDetected />,
          });

          // Once we've identified the backend version, it's safe to unsubscribe.
          if (typeof unlisten === 'function') {
            unlisten();
            unlisten = null;
          }
          break;
        default:
          break;
      }

      switch (message.event) {
        case 'isBackendStorageAPISupported':
        case 'isNativeStyleEditorSupported':
        case 'operations':
        case 'overrideComponentFilters':
          // Any of these is sufficient to indicate a v4 backend.
          // Once we've identified the backend version, it's safe to unsubscribe.
          if (typeof unlisten === 'function') {
            unlisten();
            unlisten = null;
          }
          break;
        default:
          break;
      }
    });

    return () => {
      if (typeof unlisten === 'function') {
        unlisten();
        unlisten = null;
      }
    };
  }, [bridge, dispatch]);

  return null;
}

function InvalidBackendDetected(_: {||}) {
  return (
    <Fragment>
      <p>Either upgrade React or install React DevTools v3:</p>
      <code className={styles.Command}>npm install -d react-devtools@^3</code>
    </Fragment>
  );
}
