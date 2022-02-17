/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import * as React from 'react';
import Immutable from 'immutable';

const set = new Set(['abc', 123]);
const map = new Map([
  ['name', 'Brian'],
  ['food', 'sushi'],
]);
const setOfSets = new Set([new Set(['a', 'b', 'c']), new Set([1, 2, 3])]);
const mapOfMaps = new Map([
  ['first', map],
  ['second', map],
]);
const typedArray = Int8Array.from([100, -100, 0]);
const arrayBuffer = typedArray.buffer;
const dataView = new DataView(arrayBuffer);
const immutable = Immutable.fromJS({
  a: [{hello: 'there'}, 'fixed', true],
  b: 123,
  c: {
    '1': 'xyz',
    xyz: 1,
  },
});
// $FlowFixMe
const bigInt = BigInt(123); // eslint-disable-line no-undef

export default function UnserializableProps() {
  return (
    <ChildComponent
      arrayBuffer={arrayBuffer}
      dataView={dataView}
      map={map}
      set={set}
      mapOfMaps={mapOfMaps}
      setOfSets={setOfSets}
      typedArray={typedArray}
      immutable={immutable}
      bigInt={bigInt}
    />
  );
}

function ChildComponent(props: any) {
  return null;
}
