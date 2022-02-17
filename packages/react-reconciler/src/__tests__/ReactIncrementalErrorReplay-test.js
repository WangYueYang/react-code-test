/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 * @jest-environment node
 */

'use strict';

let React;
let ReactNoop;
let Scheduler;

describe('ReactIncrementalErrorReplay', () => {
  beforeEach(() => {
    jest.resetModules();
    React = require('react');
    ReactNoop = require('react-noop-renderer');
    Scheduler = require('scheduler');
  });

  it('should fail gracefully on error in the host environment', () => {
    ReactNoop.render(<errorInBeginPhase />);
    expect(Scheduler).toFlushAndThrow('Error in host config.');
  });

  it("should ignore error if it doesn't throw on retry", () => {
    let didInit = false;

    function badLazyInit() {
      const needsInit = !didInit;
      didInit = true;
      if (needsInit) {
        throw new Error('Hi');
      }
    }

    class App extends React.Component {
      render() {
        badLazyInit();
        return <div />;
      }
    }
    ReactNoop.render(<App />);
    expect(Scheduler).toFlushWithoutYielding();
  });
});
