/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import {copy} from 'clipboard-js';
import * as React from 'react';
import Button from '../Button';
import ButtonIcon from '../ButtonIcon';
import KeyValue from './KeyValue';
import NewKeyValue from './NewKeyValue';
import {alphaSortEntries, serializeDataForCopy} from '../utils';
import Store from '../../store';
import styles from './InspectedElementSharedStyles.css';
import {ElementTypeClass} from 'react-devtools-shared/src/types';

import type {InspectedElement} from './types';
import type {GetInspectedElementPath} from './InspectedElementContext';
import type {FrontendBridge} from 'react-devtools-shared/src/bridge';

type Props = {|
  bridge: FrontendBridge,
  getInspectedElementPath: GetInspectedElementPath,
  inspectedElement: InspectedElement,
  store: Store,
|};

export default function InspectedElementPropsTree({
  bridge,
  getInspectedElementPath,
  inspectedElement,
  store,
}: Props) {
  const {
    canEditFunctionProps,
    canEditFunctionPropsDeletePaths,
    canEditFunctionPropsRenamePaths,
    props,
    type,
  } = inspectedElement;

  const canDeletePaths =
    type === ElementTypeClass || canEditFunctionPropsDeletePaths;
  const canEditValues = type === ElementTypeClass || canEditFunctionProps;
  const canRenamePaths =
    type === ElementTypeClass || canEditFunctionPropsRenamePaths;

  const entries = props != null ? Object.entries(props) : null;
  if (entries !== null) {
    entries.sort(alphaSortEntries);
  }

  const isEmpty = entries === null || entries.length === 0;

  const handleCopy = () => copy(serializeDataForCopy(((props: any): Object)));

  return (
    <div className={styles.InspectedElementTree}>
      <div className={styles.HeaderRow}>
        <div className={styles.Header}>props</div>
        {!isEmpty && (
          <Button onClick={handleCopy} title="Copy to clipboard">
            <ButtonIcon type="copy" />
          </Button>
        )}
      </div>
      {!isEmpty &&
        (entries: any).map(([name, value]) => (
          <KeyValue
            key={name}
            alphaSort={true}
            bridge={bridge}
            canDeletePaths={canDeletePaths}
            canEditValues={canEditValues}
            canRenamePaths={canRenamePaths}
            depth={1}
            getInspectedElementPath={getInspectedElementPath}
            hidden={false}
            inspectedElement={inspectedElement}
            name={name}
            path={[name]}
            pathRoot="props"
            store={store}
            value={value}
          />
        ))}
      {canEditValues && (
        <NewKeyValue
          bridge={bridge}
          depth={0}
          hidden={false}
          inspectedElement={inspectedElement}
          path={[]}
          store={store}
          type="props"
        />
      )}
    </div>
  );
}
