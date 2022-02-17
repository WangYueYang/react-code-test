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
let ReactTestRenderer;
let Scheduler;
let ReactDebugTools;
let act;

describe('ReactHooksInspectionIntegration', () => {
  beforeEach(() => {
    jest.resetModules();
    React = require('react');
    ReactTestRenderer = require('react-test-renderer');
    Scheduler = require('scheduler');
    act = ReactTestRenderer.unstable_concurrentAct;
    ReactDebugTools = require('react-debug-tools');
  });

  it('should inspect the current state of useState hooks', () => {
    const useState = React.useState;
    function Foo(props) {
      const [state1, setState1] = useState('hello');
      const [state2, setState2] = useState('world');
      return (
        <div onMouseDown={setState1} onMouseUp={setState2}>
          {state1} {state2}
        </div>
      );
    }
    const renderer = ReactTestRenderer.create(<Foo prop="prop" />);

    let childFiber = renderer.root.findByType(Foo)._currentFiber();
    let tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
    expect(tree).toEqual([
      {
        isStateEditable: true,
        id: 0,
        name: 'State',
        value: 'hello',
        subHooks: [],
      },
      {
        isStateEditable: true,
        id: 1,
        name: 'State',
        value: 'world',
        subHooks: [],
      },
    ]);

    const {
      onMouseDown: setStateA,
      onMouseUp: setStateB,
    } = renderer.root.findByType('div').props;

    act(() => setStateA('Hi'));

    childFiber = renderer.root.findByType(Foo)._currentFiber();
    tree = ReactDebugTools.inspectHooksOfFiber(childFiber);

    expect(tree).toEqual([
      {
        isStateEditable: true,
        id: 0,
        name: 'State',
        value: 'Hi',
        subHooks: [],
      },
      {
        isStateEditable: true,
        id: 1,
        name: 'State',
        value: 'world',
        subHooks: [],
      },
    ]);

    act(() => setStateB('world!'));

    childFiber = renderer.root.findByType(Foo)._currentFiber();
    tree = ReactDebugTools.inspectHooksOfFiber(childFiber);

    expect(tree).toEqual([
      {
        isStateEditable: true,
        id: 0,
        name: 'State',
        value: 'Hi',
        subHooks: [],
      },
      {
        isStateEditable: true,
        id: 1,
        name: 'State',
        value: 'world!',
        subHooks: [],
      },
    ]);
  });

  it('should inspect the current state of all stateful hooks', () => {
    const outsideRef = React.createRef();
    function effect() {}
    function Foo(props) {
      const [state1, setState] = React.useState('a');
      const [state2, dispatch] = React.useReducer((s, a) => a.value, 'b');
      const ref = React.useRef('c');

      React.useLayoutEffect(effect);
      React.useEffect(effect);

      React.useImperativeHandle(
        outsideRef,
        () => {
          // Return a function so that jest treats them as non-equal.
          return function Instance() {};
        },
        [],
      );

      React.useMemo(() => state1 + state2, [state1]);

      function update() {
        act(() => {
          setState('A');
        });
        act(() => {
          dispatch({value: 'B'});
        });
        ref.current = 'C';
      }
      const memoizedUpdate = React.useCallback(update, []);
      return (
        <div onClick={memoizedUpdate}>
          {state1} {state2}
        </div>
      );
    }
    let renderer;
    act(() => {
      renderer = ReactTestRenderer.create(<Foo prop="prop" />);
    });

    let childFiber = renderer.root.findByType(Foo)._currentFiber();

    const {onClick: updateStates} = renderer.root.findByType('div').props;

    let tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
    expect(tree).toEqual([
      {
        isStateEditable: true,
        id: 0,
        name: 'State',
        value: 'a',
        subHooks: [],
      },
      {
        isStateEditable: true,
        id: 1,
        name: 'Reducer',
        value: 'b',
        subHooks: [],
      },
      {isStateEditable: false, id: 2, name: 'Ref', value: 'c', subHooks: []},
      {
        isStateEditable: false,
        id: 3,
        name: 'LayoutEffect',
        value: effect,
        subHooks: [],
      },
      {
        isStateEditable: false,
        id: 4,
        name: 'Effect',
        value: effect,
        subHooks: [],
      },
      {
        isStateEditable: false,
        id: 5,
        name: 'ImperativeHandle',
        value: outsideRef.current,
        subHooks: [],
      },
      {
        isStateEditable: false,
        id: 6,
        name: 'Memo',
        value: 'ab',
        subHooks: [],
      },
      {
        isStateEditable: false,
        id: 7,
        name: 'Callback',
        value: updateStates,
        subHooks: [],
      },
    ]);

    updateStates();

    childFiber = renderer.root.findByType(Foo)._currentFiber();
    tree = ReactDebugTools.inspectHooksOfFiber(childFiber);

    expect(tree).toEqual([
      {
        isStateEditable: true,
        id: 0,
        name: 'State',
        value: 'A',
        subHooks: [],
      },
      {
        isStateEditable: true,
        id: 1,
        name: 'Reducer',
        value: 'B',
        subHooks: [],
      },
      {isStateEditable: false, id: 2, name: 'Ref', value: 'C', subHooks: []},
      {
        isStateEditable: false,
        id: 3,
        name: 'LayoutEffect',
        value: effect,
        subHooks: [],
      },
      {
        isStateEditable: false,
        id: 4,
        name: 'Effect',
        value: effect,
        subHooks: [],
      },
      {
        isStateEditable: false,
        id: 5,
        name: 'ImperativeHandle',
        value: outsideRef.current,
        subHooks: [],
      },
      {
        isStateEditable: false,
        id: 6,
        name: 'Memo',
        value: 'Ab',
        subHooks: [],
      },
      {
        isStateEditable: false,
        id: 7,
        name: 'Callback',
        value: updateStates,
        subHooks: [],
      },
    ]);
  });

  it('should inspect the value of the current provider in useContext', () => {
    const MyContext = React.createContext('default');
    function Foo(props) {
      const value = React.useContext(MyContext);
      return <div>{value}</div>;
    }
    const renderer = ReactTestRenderer.create(
      <MyContext.Provider value="contextual">
        <Foo prop="prop" />
      </MyContext.Provider>,
    );
    const childFiber = renderer.root.findByType(Foo)._currentFiber();
    const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
    expect(tree).toEqual([
      {
        isStateEditable: false,
        id: null,
        name: 'Context',
        value: 'contextual',
        subHooks: [],
      },
    ]);
  });

  it('should inspect forwardRef', () => {
    const obj = function() {};
    const Foo = React.forwardRef(function(props, ref) {
      React.useImperativeHandle(ref, () => obj);
      return <div />;
    });
    const ref = React.createRef();
    const renderer = ReactTestRenderer.create(<Foo ref={ref} />);

    const childFiber = renderer.root.findByType(Foo)._currentFiber();
    const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
    expect(tree).toEqual([
      {
        isStateEditable: false,
        id: 0,
        name: 'ImperativeHandle',
        value: obj,
        subHooks: [],
      },
    ]);
  });

  it('should inspect memo', () => {
    function InnerFoo(props) {
      const [value] = React.useState('hello');
      return <div>{value}</div>;
    }
    const Foo = React.memo(InnerFoo);
    const renderer = ReactTestRenderer.create(<Foo />);
    // TODO: Test renderer findByType is broken for memo. Have to search for the inner.
    const childFiber = renderer.root.findByType(InnerFoo)._currentFiber();
    const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
    expect(tree).toEqual([
      {
        isStateEditable: true,
        id: 0,
        name: 'State',
        value: 'hello',
        subHooks: [],
      },
    ]);
  });

  it('should inspect custom hooks', () => {
    function useCustom() {
      const [value] = React.useState('hello');
      return value;
    }
    function Foo(props) {
      const value = useCustom();
      return <div>{value}</div>;
    }
    const renderer = ReactTestRenderer.create(<Foo />);
    const childFiber = renderer.root.findByType(Foo)._currentFiber();
    const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
    expect(tree).toEqual([
      {
        isStateEditable: false,
        id: null,
        name: 'Custom',
        value: undefined,
        subHooks: [
          {
            isStateEditable: true,
            id: 0,
            name: 'State',
            value: 'hello',
            subHooks: [],
          },
        ],
      },
    ]);
  });

  // @gate experimental
  it('should support composite useTransition hook', () => {
    function Foo(props) {
      React.unstable_useTransition();
      const memoizedValue = React.useMemo(() => 'hello', []);
      return <div>{memoizedValue}</div>;
    }
    const renderer = ReactTestRenderer.create(<Foo />);
    const childFiber = renderer.root.findByType(Foo)._currentFiber();
    const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
    expect(tree).toEqual([
      {
        id: 0,
        isStateEditable: false,
        name: 'Transition',
        value: undefined,
        subHooks: [],
      },
      {
        id: 1,
        isStateEditable: false,
        name: 'Memo',
        value: 'hello',
        subHooks: [],
      },
    ]);
  });

  // @gate experimental
  it('should support composite useDeferredValue hook', () => {
    function Foo(props) {
      React.unstable_useDeferredValue('abc', {
        timeoutMs: 500,
      });
      const [state] = React.useState(() => 'hello', []);
      return <div>{state}</div>;
    }
    const renderer = ReactTestRenderer.create(<Foo />);
    const childFiber = renderer.root.findByType(Foo)._currentFiber();
    const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
    expect(tree).toEqual([
      {
        id: 0,
        isStateEditable: false,
        name: 'DeferredValue',
        value: 'abc',
        subHooks: [],
      },
      {
        id: 1,
        isStateEditable: true,
        name: 'State',
        value: 'hello',
        subHooks: [],
      },
    ]);
  });

  // @gate experimental
  it('should support composite useOpaqueIdentifier hook', () => {
    function Foo(props) {
      const id = React.unstable_useOpaqueIdentifier();
      const [state] = React.useState(() => 'hello', []);
      return <div id={id}>{state}</div>;
    }

    const renderer = ReactTestRenderer.create(<Foo />);
    const childFiber = renderer.root.findByType(Foo)._currentFiber();
    const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);

    expect(tree.length).toEqual(2);

    expect(tree[0].id).toEqual(0);
    expect(tree[0].isStateEditable).toEqual(false);
    expect(tree[0].name).toEqual('OpaqueIdentifier');
    expect((tree[0].value + '').startsWith('c_')).toBe(true);

    expect(tree[1]).toEqual({
      id: 1,
      isStateEditable: true,
      name: 'State',
      value: 'hello',
      subHooks: [],
    });
  });

  // @gate experimental
  it('should support composite useOpaqueIdentifier hook in concurrent mode', () => {
    function Foo(props) {
      const id = React.unstable_useOpaqueIdentifier();
      const [state] = React.useState(() => 'hello', []);
      return <div id={id}>{state}</div>;
    }

    const renderer = ReactTestRenderer.create(<Foo />, {
      unstable_isConcurrent: true,
    });
    expect(Scheduler).toFlushWithoutYielding();

    const childFiber = renderer.root.findByType(Foo)._currentFiber();
    const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);

    expect(tree.length).toEqual(2);

    expect(tree[0].id).toEqual(0);
    expect(tree[0].isStateEditable).toEqual(false);
    expect(tree[0].name).toEqual('OpaqueIdentifier');
    expect((tree[0].value + '').startsWith('c_')).toBe(true);

    expect(tree[1]).toEqual({
      id: 1,
      isStateEditable: true,
      name: 'State',
      value: 'hello',
      subHooks: [],
    });
  });

  describe('useDebugValue', () => {
    it('should support inspectable values for multiple custom hooks', () => {
      function useLabeledValue(label) {
        const [value] = React.useState(label);
        React.useDebugValue(`custom label ${label}`);
        return value;
      }
      function useAnonymous(label) {
        const [value] = React.useState(label);
        return value;
      }
      function Example() {
        useLabeledValue('a');
        React.useState('b');
        useAnonymous('c');
        useLabeledValue('d');
        return null;
      }
      const renderer = ReactTestRenderer.create(<Example />);
      const childFiber = renderer.root.findByType(Example)._currentFiber();
      const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
      expect(tree).toEqual([
        {
          isStateEditable: false,
          id: null,
          name: 'LabeledValue',
          value: __DEV__ ? 'custom label a' : undefined,
          subHooks: [
            {
              isStateEditable: true,
              id: 0,
              name: 'State',
              value: 'a',
              subHooks: [],
            },
          ],
        },
        {
          isStateEditable: true,
          id: 1,
          name: 'State',
          value: 'b',
          subHooks: [],
        },
        {
          isStateEditable: false,
          id: null,
          name: 'Anonymous',
          value: undefined,
          subHooks: [
            {
              isStateEditable: true,
              id: 2,
              name: 'State',
              value: 'c',
              subHooks: [],
            },
          ],
        },
        {
          isStateEditable: false,
          id: null,
          name: 'LabeledValue',
          value: __DEV__ ? 'custom label d' : undefined,
          subHooks: [
            {
              isStateEditable: true,
              id: 3,
              name: 'State',
              value: 'd',
              subHooks: [],
            },
          ],
        },
      ]);
    });

    it('should support inspectable values for nested custom hooks', () => {
      function useInner() {
        React.useDebugValue('inner');
        React.useState(0);
      }
      function useOuter() {
        React.useDebugValue('outer');
        useInner();
      }
      function Example() {
        useOuter();
        return null;
      }
      const renderer = ReactTestRenderer.create(<Example />);
      const childFiber = renderer.root.findByType(Example)._currentFiber();
      const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
      expect(tree).toEqual([
        {
          isStateEditable: false,
          id: null,
          name: 'Outer',
          value: __DEV__ ? 'outer' : undefined,
          subHooks: [
            {
              isStateEditable: false,
              id: null,
              name: 'Inner',
              value: __DEV__ ? 'inner' : undefined,
              subHooks: [
                {
                  isStateEditable: true,
                  id: 0,
                  name: 'State',
                  value: 0,
                  subHooks: [],
                },
              ],
            },
          ],
        },
      ]);
    });

    it('should support multiple inspectable values per custom hooks', () => {
      function useMultiLabelCustom() {
        React.useDebugValue('one');
        React.useDebugValue('two');
        React.useDebugValue('three');
        React.useState(0);
      }
      function useSingleLabelCustom(value) {
        React.useDebugValue(`single ${value}`);
        React.useState(0);
      }
      function Example() {
        useSingleLabelCustom('one');
        useMultiLabelCustom();
        useSingleLabelCustom('two');
        return null;
      }
      const renderer = ReactTestRenderer.create(<Example />);
      const childFiber = renderer.root.findByType(Example)._currentFiber();
      const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
      expect(tree).toEqual([
        {
          isStateEditable: false,
          id: null,
          name: 'SingleLabelCustom',
          value: __DEV__ ? 'single one' : undefined,
          subHooks: [
            {
              isStateEditable: true,
              id: 0,
              name: 'State',
              value: 0,
              subHooks: [],
            },
          ],
        },
        {
          isStateEditable: false,
          id: null,
          name: 'MultiLabelCustom',
          value: __DEV__ ? ['one', 'two', 'three'] : undefined,
          subHooks: [
            {
              isStateEditable: true,
              id: 1,
              name: 'State',
              value: 0,
              subHooks: [],
            },
          ],
        },
        {
          isStateEditable: false,
          id: null,
          name: 'SingleLabelCustom',
          value: __DEV__ ? 'single two' : undefined,
          subHooks: [
            {
              isStateEditable: true,
              id: 2,
              name: 'State',
              value: 0,
              subHooks: [],
            },
          ],
        },
      ]);
    });

    it('should ignore useDebugValue() made outside of a custom hook', () => {
      function Example() {
        React.useDebugValue('this is invalid');
        return null;
      }
      const renderer = ReactTestRenderer.create(<Example />);
      const childFiber = renderer.root.findByType(Example)._currentFiber();
      const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
      expect(tree).toHaveLength(0);
    });

    it('should support an optional formatter function param', () => {
      function useCustom() {
        React.useDebugValue({bar: 123}, object => `bar:${object.bar}`);
        React.useState(0);
      }
      function Example() {
        useCustom();
        return null;
      }
      const renderer = ReactTestRenderer.create(<Example />);
      const childFiber = renderer.root.findByType(Example)._currentFiber();
      const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
      expect(tree).toEqual([
        {
          isStateEditable: false,
          id: null,
          name: 'Custom',
          value: __DEV__ ? 'bar:123' : undefined,
          subHooks: [
            {
              isStateEditable: true,
              id: 0,
              name: 'State',
              subHooks: [],
              value: 0,
            },
          ],
        },
      ]);
    });
  });

  it('should support defaultProps and lazy', async () => {
    const Suspense = React.Suspense;

    function Foo(props) {
      const [value] = React.useState(props.defaultValue.substr(0, 3));
      return <div>{value}</div>;
    }
    Foo.defaultProps = {
      defaultValue: 'default',
    };

    async function fakeImport(result) {
      return {default: result};
    }

    const LazyFoo = React.lazy(() => fakeImport(Foo));

    const renderer = ReactTestRenderer.create(
      <Suspense fallback="Loading...">
        <LazyFoo />
      </Suspense>,
    );

    await LazyFoo;

    Scheduler.unstable_flushAll();

    const childFiber = renderer.root._currentFiber();
    const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
    expect(tree).toEqual([
      {
        isStateEditable: true,
        id: 0,
        name: 'State',
        value: 'def',
        subHooks: [],
      },
    ]);
  });

  it('should support an injected dispatcher', () => {
    function Foo(props) {
      const [state] = React.useState('hello world');
      return <div>{state}</div>;
    }

    const initial = {};
    let current = initial;
    let getterCalls = 0;
    const setterCalls = [];
    const FakeDispatcherRef = {
      get current() {
        getterCalls++;
        return current;
      },
      set current(value) {
        setterCalls.push(value);
        current = value;
      },
    };

    const renderer = ReactTestRenderer.create(<Foo />);
    const childFiber = renderer.root._currentFiber();
    expect(() => {
      ReactDebugTools.inspectHooksOfFiber(childFiber, FakeDispatcherRef);
    }).toThrow(
      'Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for' +
        ' one of the following reasons:\n' +
        '1. You might have mismatching versions of React and the renderer (such as React DOM)\n' +
        '2. You might be breaking the Rules of Hooks\n' +
        '3. You might have more than one copy of React in the same app\n' +
        'See https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.',
    );

    expect(getterCalls).toBe(1);
    expect(setterCalls).toHaveLength(2);
    expect(setterCalls[0]).not.toBe(initial);
    expect(setterCalls[1]).toBe(initial);
  });

  // This test case is based on an open source bug report:
  // facebookincubator/redux-react-hook/issues/34#issuecomment-466693787
  it('should properly advance the current hook for useContext', () => {
    const MyContext = React.createContext(1);

    let incrementCount;

    function Foo(props) {
      const context = React.useContext(MyContext);
      const [data, setData] = React.useState({count: context});

      incrementCount = () => setData(({count}) => ({count: count + 1}));

      return <div>count: {data.count}</div>;
    }

    const renderer = ReactTestRenderer.create(<Foo />);
    expect(renderer.toJSON()).toEqual({
      type: 'div',
      props: {},
      children: ['count: ', '1'],
    });

    act(incrementCount);
    expect(renderer.toJSON()).toEqual({
      type: 'div',
      props: {},
      children: ['count: ', '2'],
    });

    const childFiber = renderer.root._currentFiber();
    const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
    expect(tree).toEqual([
      {
        isStateEditable: false,
        id: null,
        name: 'Context',
        value: 1,
        subHooks: [],
      },
      {
        isStateEditable: true,
        id: 0,
        name: 'State',
        value: {count: 2},
        subHooks: [],
      },
    ]);
  });

  if (__EXPERIMENTAL__) {
    it('should support composite useMutableSource hook', () => {
      const mutableSource = React.unstable_createMutableSource({}, () => 1);
      function Foo(props) {
        React.unstable_useMutableSource(
          mutableSource,
          () => 'snapshot',
          () => {},
        );
        React.useMemo(() => 'memo', []);
        return <div />;
      }
      const renderer = ReactTestRenderer.create(<Foo />);
      const childFiber = renderer.root.findByType(Foo)._currentFiber();
      const tree = ReactDebugTools.inspectHooksOfFiber(childFiber);
      expect(tree).toEqual([
        {
          id: 0,
          isStateEditable: false,
          name: 'MutableSource',
          value: 'snapshot',
          subHooks: [],
        },
        {
          id: 1,
          isStateEditable: false,
          name: 'Memo',
          value: 'memo',
          subHooks: [],
        },
      ]);
    });
  }
});
