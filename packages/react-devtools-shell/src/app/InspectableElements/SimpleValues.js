/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import * as React from 'react';
import {Component} from 'react';

function noop() {}

export default class SimpleValues extends Component {
  anonymousFunction = () => {};

  render() {
    return (
      <ChildComponent
        string="abc"
        emptyString=""
        number={123}
        undefined={undefined}
        null={null}
        nan={NaN}
        infinity={Infinity}
        true={true}
        false={false}
        function={noop}
        anonymousFunction={this.anonymousFunction}
        boundFunction={noop.bind(this)}
        regex={/abc[123]+/i}
      />
    );
  }
}

function ChildComponent(props: any) {
  return null;
}
