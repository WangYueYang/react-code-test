/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

let act;
let React;
let ReactDOM;
let ReactDOMFlightRelayServer;
let ReactDOMFlightRelayServerRuntime;
let ReactDOMFlightRelayClient;

describe('ReactFlightDOMRelay', () => {
  beforeEach(() => {
    jest.resetModules();

    act = require('react-dom/test-utils').unstable_concurrentAct;
    React = require('react');
    ReactDOM = require('react-dom');
    ReactDOMFlightRelayServer = require('react-transport-dom-relay/server');
    ReactDOMFlightRelayServerRuntime = require('react-transport-dom-relay/server-runtime');
    ReactDOMFlightRelayClient = require('react-transport-dom-relay');
  });

  function readThrough(data) {
    const response = ReactDOMFlightRelayClient.createResponse();
    for (let i = 0; i < data.length; i++) {
      const chunk = data[i];
      if (chunk.type === 'json') {
        ReactDOMFlightRelayClient.resolveModel(response, chunk.id, chunk.json);
      } else {
        ReactDOMFlightRelayClient.resolveError(
          response,
          chunk.id,
          chunk.json.message,
          chunk.json.stack,
        );
      }
    }
    ReactDOMFlightRelayClient.close(response);
    const model = response.readRoot();
    return model;
  }

  function block(render, load) {
    if (load === undefined) {
      return ReactDOMFlightRelayServerRuntime.serverBlock(render);
    }
    return function(...args) {
      const curriedLoad = () => {
        return load(...args);
      };
      return ReactDOMFlightRelayServerRuntime.serverBlock(render, curriedLoad);
    };
  }

  it('can render a server component', () => {
    function Bar({text}) {
      return text.toUpperCase();
    }
    function Foo() {
      return {
        bar: (
          <div>
            <Bar text="a" />, <Bar text="b" />
          </div>
        ),
      };
    }
    const transport = [];
    ReactDOMFlightRelayServer.render(
      {
        foo: <Foo />,
      },
      transport,
    );

    const model = readThrough(transport);
    expect(model).toEqual({
      foo: {
        bar: (
          <div>
            {'A'}
            {', '}
            {'B'}
          </div>
        ),
      },
    });
  });

  // @gate experimental
  it('can transfer a Block to the client and render there', () => {
    function load(firstName, lastName) {
      return {name: firstName + ' ' + lastName};
    }
    function User(props, data) {
      return (
        <span>
          {props.greeting}, {data.name}
        </span>
      );
    }
    const loadUser = block(User, load);
    const model = {
      User: loadUser('Seb', 'Smith'),
    };

    const transport = [];
    ReactDOMFlightRelayServer.render(model, transport);

    const modelClient = readThrough(transport);

    const container = document.createElement('div');
    const root = ReactDOM.createRoot(container);
    act(() => {
      const UserClient = modelClient.User;
      root.render(<UserClient greeting="Hello" />);
    });

    expect(container.innerHTML).toEqual('<span>Hello, Seb Smith</span>');
  });

  // @gate experimental
  it('can reasonably handle different element types', () => {
    const {
      forwardRef,
      memo,
      Fragment,
      StrictMode,
      Profiler,
      Suspense,
      SuspenseList,
    } = React;

    const Inner = memo(
      forwardRef((props, ref) => {
        return <div ref={ref}>{'Hello ' + props.name}</div>;
      }),
    );

    function Foo() {
      return {
        bar: (
          <div>
            <Fragment>Fragment child</Fragment>
            <Profiler>Profiler child</Profiler>
            <StrictMode>StrictMode child</StrictMode>
            <Suspense fallback="Loading...">Suspense child</Suspense>
            <SuspenseList fallback="Loading...">
              {'SuspenseList row 1'}
              {'SuspenseList row 2'}
            </SuspenseList>
            <Inner name="world" />
          </div>
        ),
      };
    }
    const transport = [];
    ReactDOMFlightRelayServer.render(
      {
        foo: <Foo />,
      },
      transport,
    );

    const model = readThrough(transport);
    expect(model).toEqual({
      foo: {
        bar: (
          <div>
            {'Fragment child'}
            {'Profiler child'}
            {'StrictMode child'}
            {'Suspense child'}
            {['SuspenseList row 1', 'SuspenseList row 2']}
            <div>Hello world</div>
          </div>
        ),
      },
    });
  });

  it('can handle a subset of Hooks', () => {
    const {useMemo, useCallback} = React;
    function Inner({x}) {
      const foo = useMemo(() => x + x, [x]);
      const bar = useCallback(() => 10 + foo, [foo]);
      return bar();
    }

    function Foo() {
      return {
        bar: <Inner x={2} />,
      };
    }
    const transport = [];
    ReactDOMFlightRelayServer.render(
      {
        foo: <Foo />,
      },
      transport,
    );

    const model = readThrough(transport);
    expect(model).toEqual({
      foo: {
        bar: 14,
      },
    });
  });

  it('can handle a subset of Hooks, with element as root', () => {
    const {useMemo, useCallback} = React;
    function Inner({x}) {
      const foo = useMemo(() => x + x, [x]);
      const bar = useCallback(() => 10 + foo, [foo]);
      return bar();
    }

    function Foo() {
      return <Inner x={2} />;
    }
    const transport = [];
    ReactDOMFlightRelayServer.render(<Foo />, transport);

    const model = readThrough(transport);
    expect(model).toEqual(14);
  });
});
