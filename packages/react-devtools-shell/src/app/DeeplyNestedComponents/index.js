/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import * as React from 'react';
import {Fragment} from 'react';

function wrapWithHoc(Component, index) {
  function HOC() {
    return <Component />;
  }

  // $FlowFixMe
  const displayName = Component.displayName || Component.name;

  HOC.displayName = `withHoc${index}(${displayName})`;
  return HOC;
}

function wrapWithNested(Component, times) {
  for (let i = 0; i < times; i++) {
    Component = wrapWithHoc(Component, i);
  }

  return Component;
}

function Nested() {
  return <div>Deeply nested div</div>;
}

const DeeplyNested = wrapWithNested(Nested, 100);

export default function DeeplyNestedComponents() {
  return (
    <Fragment>
      <h1>Deeply nested component</h1>
      <DeeplyNested />
    </Fragment>
  );
}
