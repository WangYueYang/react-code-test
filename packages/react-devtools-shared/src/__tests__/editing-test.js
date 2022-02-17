/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {FrontendBridge} from 'react-devtools-shared/src/bridge';
import type Store from 'react-devtools-shared/src/devtools/store';

describe('editing interface', () => {
  let PropTypes;
  let React;
  let ReactDOM;
  let bridge: FrontendBridge;
  let store: Store;
  let utils;

  const flushPendingUpdates = () => {
    jest.runOnlyPendingTimers();
  };

  beforeEach(() => {
    utils = require('./utils');

    bridge = global.bridge;
    store = global.store;
    store.collapseNodesByDefault = false;

    PropTypes = require('prop-types');
    React = require('react');
    ReactDOM = require('react-dom');
  });

  describe('props', () => {
    let committedClassProps;
    let committedFunctionProps;
    let classID;
    let functionID;

    async function mountTestApp() {
      class ClassComponent extends React.Component {
        componentDidMount() {
          committedClassProps = this.props;
        }
        componentDidUpdate() {
          committedClassProps = this.props;
        }
        render() {
          return null;
        }
      }

      function FunctionComponent(props) {
        React.useLayoutEffect(() => {
          committedFunctionProps = props;
        });
        return null;
      }

      const container = document.createElement('div');
      await utils.actAsync(() =>
        ReactDOM.render(
          <>
            <ClassComponent
              array={[1, 2, 3]}
              object={{nested: 'initial'}}
              shallow="initial"
            />
            ,
            <FunctionComponent
              array={[1, 2, 3]}
              object={{nested: 'initial'}}
              shallow="initial"
            />
            ,
          </>,
          container,
        ),
      );

      classID = ((store.getElementIDAtIndex(0): any): number);
      functionID = ((store.getElementIDAtIndex(1): any): number);

      expect(committedClassProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'initial',
      });
      expect(committedFunctionProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'initial',
      });
    }

    it('should have editable values', async () => {
      await mountTestApp();

      function overrideProps(id, path, value) {
        const rendererID = utils.getRendererID();
        bridge.send('overrideValueAtPath', {
          id,
          path,
          rendererID,
          type: 'props',
          value,
        });
        flushPendingUpdates();
      }

      overrideProps(classID, ['shallow'], 'updated');
      expect(committedClassProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'updated',
      });
      overrideProps(classID, ['object', 'nested'], 'updated');
      expect(committedClassProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'updated',
        },
        shallow: 'updated',
      });
      overrideProps(classID, ['array', 1], 'updated');
      expect(committedClassProps).toStrictEqual({
        array: [1, 'updated', 3],
        object: {
          nested: 'updated',
        },
        shallow: 'updated',
      });

      overrideProps(functionID, ['shallow'], 'updated');
      expect(committedFunctionProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'updated',
      });
      overrideProps(functionID, ['object', 'nested'], 'updated');
      expect(committedFunctionProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'updated',
        },
        shallow: 'updated',
      });
      overrideProps(functionID, ['array', 1], 'updated');
      expect(committedFunctionProps).toStrictEqual({
        array: [1, 'updated', 3],
        object: {
          nested: 'updated',
        },
        shallow: 'updated',
      });
    });

    // Tests the combination of older frontend (DevTools UI) with newer backend (embedded within a renderer).
    it('should still support overriding prop values with legacy backend methods', async () => {
      await mountTestApp();

      function overrideProps(id, path, value) {
        const rendererID = utils.getRendererID();
        bridge.send('overrideProps', {
          id,
          path,
          rendererID,
          value,
        });
        flushPendingUpdates();
      }

      overrideProps(classID, ['object', 'nested'], 'updated');
      expect(committedClassProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'updated',
        },
        shallow: 'initial',
      });

      overrideProps(functionID, ['shallow'], 'updated');
      expect(committedFunctionProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'updated',
      });
    });

    it('should have editable paths', async () => {
      await mountTestApp();

      function renamePath(id, oldPath, newPath) {
        const rendererID = utils.getRendererID();
        bridge.send('renamePath', {
          id,
          oldPath,
          newPath,
          rendererID,
          type: 'props',
        });
        flushPendingUpdates();
      }

      renamePath(classID, ['shallow'], ['after']);
      expect(committedClassProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        after: 'initial',
      });
      renamePath(classID, ['object', 'nested'], ['object', 'after']);
      expect(committedClassProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          after: 'initial',
        },
        after: 'initial',
      });

      renamePath(functionID, ['shallow'], ['after']);
      expect(committedFunctionProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        after: 'initial',
      });
      renamePath(functionID, ['object', 'nested'], ['object', 'after']);
      expect(committedFunctionProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          after: 'initial',
        },
        after: 'initial',
      });
    });

    it('should enable adding new object properties and array values', async () => {
      await mountTestApp();

      function overrideProps(id, path, value) {
        const rendererID = utils.getRendererID();
        bridge.send('overrideValueAtPath', {
          id,
          path,
          rendererID,
          type: 'props',
          value,
        });
        flushPendingUpdates();
      }

      overrideProps(classID, ['new'], 'value');
      expect(committedClassProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'initial',
        new: 'value',
      });

      overrideProps(classID, ['object', 'new'], 'value');
      expect(committedClassProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
          new: 'value',
        },
        shallow: 'initial',
        new: 'value',
      });

      overrideProps(classID, ['array', 3], 'new value');
      expect(committedClassProps).toStrictEqual({
        array: [1, 2, 3, 'new value'],
        object: {
          nested: 'initial',
          new: 'value',
        },
        shallow: 'initial',
        new: 'value',
      });

      overrideProps(functionID, ['new'], 'value');
      expect(committedFunctionProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'initial',
        new: 'value',
      });

      overrideProps(functionID, ['object', 'new'], 'value');
      expect(committedFunctionProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
          new: 'value',
        },
        shallow: 'initial',
        new: 'value',
      });

      overrideProps(functionID, ['array', 3], 'new value');
      expect(committedFunctionProps).toStrictEqual({
        array: [1, 2, 3, 'new value'],
        object: {
          nested: 'initial',
          new: 'value',
        },
        shallow: 'initial',
        new: 'value',
      });
    });

    it('should have deletable keys', async () => {
      await mountTestApp();

      function deletePath(id, path) {
        const rendererID = utils.getRendererID();
        bridge.send('deletePath', {
          id,
          path,
          rendererID,
          type: 'props',
        });
        flushPendingUpdates();
      }

      deletePath(classID, ['shallow']);
      expect(committedClassProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
      });
      deletePath(classID, ['object', 'nested']);
      expect(committedClassProps).toStrictEqual({
        array: [1, 2, 3],
        object: {},
      });
      deletePath(classID, ['array', 1]);
      expect(committedClassProps).toStrictEqual({
        array: [1, 3],
        object: {},
      });

      deletePath(functionID, ['shallow']);
      expect(committedFunctionProps).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
      });
      deletePath(functionID, ['object', 'nested']);
      expect(committedFunctionProps).toStrictEqual({
        array: [1, 2, 3],
        object: {},
      });
      deletePath(functionID, ['array', 1]);
      expect(committedFunctionProps).toStrictEqual({
        array: [1, 3],
        object: {},
      });
    });
  });

  describe('state', () => {
    let committedState;
    let id;

    async function mountTestApp() {
      class ClassComponent extends React.Component {
        state = {
          array: [1, 2, 3],
          object: {
            nested: 'initial',
          },
          shallow: 'initial',
        };
        componentDidMount() {
          committedState = this.state;
        }
        componentDidUpdate() {
          committedState = this.state;
        }
        render() {
          return null;
        }
      }

      const container = document.createElement('div');
      await utils.actAsync(() =>
        ReactDOM.render(
          <ClassComponent object={{nested: 'initial'}} shallow="initial" />,
          container,
        ),
      );

      id = ((store.getElementIDAtIndex(0): any): number);

      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'initial',
      });
    }

    it('should have editable values', async () => {
      await mountTestApp();

      function overrideState(path, value) {
        const rendererID = utils.getRendererID();
        bridge.send('overrideValueAtPath', {
          id,
          path,
          rendererID,
          type: 'state',
          value,
        });
        flushPendingUpdates();
      }

      overrideState(['shallow'], 'updated');
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {nested: 'initial'},
        shallow: 'updated',
      });

      overrideState(['object', 'nested'], 'updated');
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {nested: 'updated'},
        shallow: 'updated',
      });

      overrideState(['array', 1], 'updated');
      expect(committedState).toStrictEqual({
        array: [1, 'updated', 3],
        object: {nested: 'updated'},
        shallow: 'updated',
      });
    });

    // Tests the combination of older frontend (DevTools UI) with newer backend (embedded within a renderer).
    it('should still support overriding state values with legacy backend methods', async () => {
      await mountTestApp();

      function overrideState(path, value) {
        const rendererID = utils.getRendererID();
        bridge.send('overrideState', {
          id,
          path,
          rendererID,
          value,
        });
        flushPendingUpdates();
      }

      overrideState(['array', 1], 'updated');
      expect(committedState).toStrictEqual({
        array: [1, 'updated', 3],
        object: {nested: 'initial'},
        shallow: 'initial',
      });
    });

    it('should have editable paths', async () => {
      await mountTestApp();

      function renamePath(oldPath, newPath) {
        const rendererID = utils.getRendererID();
        bridge.send('renamePath', {
          id,
          oldPath,
          newPath,
          rendererID,
          type: 'state',
        });
        flushPendingUpdates();
      }

      renamePath(['shallow'], ['after']);
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        after: 'initial',
      });

      renamePath(['object', 'nested'], ['object', 'after']);
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          after: 'initial',
        },
        after: 'initial',
      });
    });

    it('should enable adding new object properties and array values', async () => {
      await mountTestApp();

      function overrideState(path, value) {
        const rendererID = utils.getRendererID();
        bridge.send('overrideValueAtPath', {
          id,
          path,
          rendererID,
          type: 'state',
          value,
        });
        flushPendingUpdates();
      }

      overrideState(['new'], 'value');
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'initial',
        new: 'value',
      });

      overrideState(['object', 'new'], 'value');
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
          new: 'value',
        },
        shallow: 'initial',
        new: 'value',
      });

      overrideState(['array', 3], 'new value');
      expect(committedState).toStrictEqual({
        array: [1, 2, 3, 'new value'],
        object: {
          nested: 'initial',
          new: 'value',
        },
        shallow: 'initial',
        new: 'value',
      });
    });

    it('should have deletable keys', async () => {
      await mountTestApp();

      function deletePath(path) {
        const rendererID = utils.getRendererID();
        bridge.send('deletePath', {
          id,
          path,
          rendererID,
          type: 'state',
        });
        flushPendingUpdates();
      }

      deletePath(['shallow']);
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
      });

      deletePath(['object', 'nested']);
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {},
      });

      deletePath(['array', 1]);
      expect(committedState).toStrictEqual({
        array: [1, 3],
        object: {},
      });
    });
  });

  describe('hooks', () => {
    let committedState;
    let hookID;
    let id;

    async function mountTestApp() {
      function FunctionComponent() {
        const [state] = React.useState({
          array: [1, 2, 3],
          object: {
            nested: 'initial',
          },
          shallow: 'initial',
        });
        React.useLayoutEffect(() => {
          committedState = state;
        });
        return null;
      }

      const container = document.createElement('div');
      await utils.actAsync(() =>
        ReactDOM.render(<FunctionComponent />, container),
      );

      hookID = 0; // index
      id = ((store.getElementIDAtIndex(0): any): number);

      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'initial',
      });
    }

    it('should have editable values', async () => {
      await mountTestApp();

      function overrideHookState(path, value) {
        const rendererID = utils.getRendererID();
        bridge.send('overrideValueAtPath', {
          hookID,
          id,
          path,
          rendererID,
          type: 'hooks',
          value,
        });
        flushPendingUpdates();
      }

      overrideHookState(['shallow'], 'updated');
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'updated',
      });

      overrideHookState(['object', 'nested'], 'updated');
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'updated',
        },
        shallow: 'updated',
      });

      overrideHookState(['array', 1], 'updated');
      expect(committedState).toStrictEqual({
        array: [1, 'updated', 3],
        object: {
          nested: 'updated',
        },
        shallow: 'updated',
      });
    });

    // Tests the combination of older frontend (DevTools UI) with newer backend (embedded within a renderer).
    it('should still support overriding hook values with legacy backend methods', async () => {
      await mountTestApp();

      function overrideHookState(path, value) {
        const rendererID = utils.getRendererID();
        bridge.send('overrideHookState', {
          hookID,
          id,
          path,
          rendererID,
          value,
        });
        flushPendingUpdates();
      }

      overrideHookState(['shallow'], 'updated');
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'updated',
      });
    });

    it('should have editable paths', async () => {
      await mountTestApp();

      function renamePath(oldPath, newPath) {
        const rendererID = utils.getRendererID();
        bridge.send('renamePath', {
          id,
          hookID,
          oldPath,
          newPath,
          rendererID,
          type: 'hooks',
        });
        flushPendingUpdates();
      }

      renamePath(['shallow'], ['after']);
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        after: 'initial',
      });

      renamePath(['object', 'nested'], ['object', 'after']);
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          after: 'initial',
        },
        after: 'initial',
      });
    });

    it('should enable adding new object properties and array values', async () => {
      await mountTestApp();

      function overrideHookState(path, value) {
        const rendererID = utils.getRendererID();
        bridge.send('overrideValueAtPath', {
          hookID,
          id,
          path,
          rendererID,
          type: 'hooks',
          value,
        });
        flushPendingUpdates();
      }

      overrideHookState(['new'], 'value');
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'initial',
        new: 'value',
      });

      overrideHookState(['object', 'new'], 'value');
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
          new: 'value',
        },
        shallow: 'initial',
        new: 'value',
      });

      overrideHookState(['array', 3], 'new value');
      expect(committedState).toStrictEqual({
        array: [1, 2, 3, 'new value'],
        object: {
          nested: 'initial',
          new: 'value',
        },
        shallow: 'initial',
        new: 'value',
      });
    });

    it('should have deletable keys', async () => {
      await mountTestApp();

      function deletePath(path) {
        const rendererID = utils.getRendererID();
        bridge.send('deletePath', {
          hookID,
          id,
          path,
          rendererID,
          type: 'hooks',
        });
        flushPendingUpdates();
      }

      deletePath(['shallow']);
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
      });

      deletePath(['object', 'nested']);
      expect(committedState).toStrictEqual({
        array: [1, 2, 3],
        object: {},
      });

      deletePath(['array', 1]);
      expect(committedState).toStrictEqual({
        array: [1, 3],
        object: {},
      });
    });
  });

  describe('context', () => {
    let committedContext;
    let id;

    async function mountTestApp() {
      class LegacyContextProvider extends React.Component<any> {
        static childContextTypes = {
          array: PropTypes.array,
          object: PropTypes.object,
          shallow: PropTypes.string,
        };
        getChildContext() {
          return {
            array: [1, 2, 3],
            object: {
              nested: 'initial',
            },
            shallow: 'initial',
          };
        }
        render() {
          return this.props.children;
        }
      }

      class ClassComponent extends React.Component<any> {
        static contextTypes = {
          array: PropTypes.array,
          object: PropTypes.object,
          shallow: PropTypes.string,
        };
        componentDidMount() {
          committedContext = this.context;
        }
        componentDidUpdate() {
          committedContext = this.context;
        }
        render() {
          return null;
        }
      }

      const container = document.createElement('div');
      await utils.actAsync(() =>
        ReactDOM.render(
          <LegacyContextProvider>
            <ClassComponent />
          </LegacyContextProvider>,
          container,
        ),
      );

      // This test only covers Class components.
      // Function components using legacy context are not editable.

      id = ((store.getElementIDAtIndex(1): any): number);

      expect(committedContext).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'initial',
      });
    }

    it('should have editable values', async () => {
      await mountTestApp();

      function overrideContext(path, value) {
        const rendererID = utils.getRendererID();

        // To simplify hydration and display of primitive context values (e.g. number, string)
        // the inspectElement() method wraps context in a {value: ...} object.
        path = ['value', ...path];

        bridge.send('overrideValueAtPath', {
          id,
          path,
          rendererID,
          type: 'context',
          value,
        });
        flushPendingUpdates();
      }

      overrideContext(['shallow'], 'updated');
      expect(committedContext).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'updated',
      });

      overrideContext(['object', 'nested'], 'updated');
      expect(committedContext).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'updated',
        },
        shallow: 'updated',
      });

      overrideContext(['array', 1], 'updated');
      expect(committedContext).toStrictEqual({
        array: [1, 'updated', 3],
        object: {
          nested: 'updated',
        },
        shallow: 'updated',
      });
    });

    // Tests the combination of older frontend (DevTools UI) with newer backend (embedded within a renderer).
    it('should still support overriding context values with legacy backend methods', async () => {
      await mountTestApp();

      function overrideContext(path, value) {
        const rendererID = utils.getRendererID();

        // To simplify hydration and display of primitive context values (e.g. number, string)
        // the inspectElement() method wraps context in a {value: ...} object.
        path = ['value', ...path];

        bridge.send('overrideContext', {
          id,
          path,
          rendererID,
          value,
        });
        flushPendingUpdates();
      }

      overrideContext(['object', 'nested'], 'updated');
      expect(committedContext).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'updated',
        },
        shallow: 'initial',
      });
    });

    it('should have editable paths', async () => {
      await mountTestApp();

      function renamePath(oldPath, newPath) {
        const rendererID = utils.getRendererID();

        // To simplify hydration and display of primitive context values (e.g. number, string)
        // the inspectElement() method wraps context in a {value: ...} object.
        oldPath = ['value', ...oldPath];
        newPath = ['value', ...newPath];

        bridge.send('renamePath', {
          id,
          oldPath,
          newPath,
          rendererID,
          type: 'context',
        });
        flushPendingUpdates();
      }

      renamePath(['shallow'], ['after']);
      expect(committedContext).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        after: 'initial',
      });

      renamePath(['object', 'nested'], ['object', 'after']);
      expect(committedContext).toStrictEqual({
        array: [1, 2, 3],
        object: {
          after: 'initial',
        },
        after: 'initial',
      });
    });

    it('should enable adding new object properties and array values', async () => {
      await mountTestApp();

      function overrideContext(path, value) {
        const rendererID = utils.getRendererID();

        // To simplify hydration and display of primitive context values (e.g. number, string)
        // the inspectElement() method wraps context in a {value: ...} object.
        path = ['value', ...path];

        bridge.send('overrideValueAtPath', {
          id,
          path,
          rendererID,
          type: 'context',
          value,
        });
        flushPendingUpdates();
      }

      overrideContext(['new'], 'value');
      expect(committedContext).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
        shallow: 'initial',
        new: 'value',
      });

      overrideContext(['object', 'new'], 'value');
      expect(committedContext).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
          new: 'value',
        },
        shallow: 'initial',
        new: 'value',
      });

      overrideContext(['array', 3], 'new value');
      expect(committedContext).toStrictEqual({
        array: [1, 2, 3, 'new value'],
        object: {
          nested: 'initial',
          new: 'value',
        },
        shallow: 'initial',
        new: 'value',
      });
    });

    it('should have deletable keys', async () => {
      await mountTestApp();

      function deletePath(path) {
        const rendererID = utils.getRendererID();

        // To simplify hydration and display of primitive context values (e.g. number, string)
        // the inspectElement() method wraps context in a {value: ...} object.
        path = ['value', ...path];

        bridge.send('deletePath', {
          id,
          path,
          rendererID,
          type: 'context',
        });
        flushPendingUpdates();
      }

      deletePath(['shallow']);
      expect(committedContext).toStrictEqual({
        array: [1, 2, 3],
        object: {
          nested: 'initial',
        },
      });

      deletePath(['object', 'nested']);
      expect(committedContext).toStrictEqual({
        array: [1, 2, 3],
        object: {},
      });

      deletePath(['array', 1]);
      expect(committedContext).toStrictEqual({
        array: [1, 3],
        object: {},
      });
    });
  });
});
