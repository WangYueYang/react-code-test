/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import typeof ReactTestRenderer from 'react-test-renderer';
import type {FrontendBridge} from 'react-devtools-shared/src/bridge';
import type {Context} from 'react-devtools-shared/src/devtools/views/Profiler/ProfilerContext';
import type {DispatcherContext} from 'react-devtools-shared/src/devtools/views/Components/TreeContext';
import type Store from 'react-devtools-shared/src/devtools/store';

describe('ProfilerContext', () => {
  let React;
  let ReactDOM;
  let TestRenderer: ReactTestRenderer;
  let bridge: FrontendBridge;
  let store: Store;
  let utils;

  let BridgeContext;
  let ProfilerContext;
  let ProfilerContextController;
  let StoreContext;
  let TreeContextController;
  let TreeDispatcherContext;
  let TreeStateContext;

  beforeEach(() => {
    utils = require('./utils');
    utils.beforeEachProfiling();

    bridge = global.bridge;
    store = global.store;
    store.collapseNodesByDefault = false;
    store.recordChangeDescriptions = true;

    React = require('react');
    ReactDOM = require('react-dom');
    TestRenderer = utils.requireTestRenderer();

    BridgeContext = require('react-devtools-shared/src/devtools/views/context')
      .BridgeContext;
    ProfilerContext = require('react-devtools-shared/src/devtools/views/Profiler/ProfilerContext')
      .ProfilerContext;
    ProfilerContextController = require('react-devtools-shared/src/devtools/views/Profiler/ProfilerContext')
      .ProfilerContextController;
    StoreContext = require('react-devtools-shared/src/devtools/views/context')
      .StoreContext;
    TreeContextController = require('react-devtools-shared/src/devtools/views/Components/TreeContext')
      .TreeContextController;
    TreeDispatcherContext = require('react-devtools-shared/src/devtools/views/Components/TreeContext')
      .TreeDispatcherContext;
    TreeStateContext = require('react-devtools-shared/src/devtools/views/Components/TreeContext')
      .TreeStateContext;
  });

  const Contexts = ({
    children = null,
    defaultSelectedElementID = null,
    defaultSelectedElementIndex = null,
  }: any) => (
    <BridgeContext.Provider value={bridge}>
      <StoreContext.Provider value={store}>
        <TreeContextController
          defaultSelectedElementID={defaultSelectedElementID}
          defaultSelectedElementIndex={defaultSelectedElementIndex}>
          <ProfilerContextController>{children}</ProfilerContextController>
        </TreeContextController>
      </StoreContext.Provider>
    </BridgeContext.Provider>
  );

  it('updates updates profiling support based on the attached roots', async done => {
    const Component = () => null;

    let context: Context = ((null: any): Context);

    function ContextReader() {
      context = React.useContext(ProfilerContext);
      return null;
    }
    await utils.actAsync(() => {
      TestRenderer.create(
        <Contexts>
          <ContextReader />
        </Contexts>,
      );
    });

    expect(context.supportsProfiling).toBe(false);

    const containerA = document.createElement('div');
    const containerB = document.createElement('div');

    await utils.actAsync(() => ReactDOM.render(<Component />, containerA));
    expect(context.supportsProfiling).toBe(true);

    await utils.actAsync(() => ReactDOM.render(<Component />, containerB));
    await utils.actAsync(() => ReactDOM.unmountComponentAtNode(containerA));
    expect(context.supportsProfiling).toBe(true);

    await utils.actAsync(() => ReactDOM.unmountComponentAtNode(containerB));
    expect(context.supportsProfiling).toBe(false);

    done();
  });

  it('should gracefully handle an empty profiling session (with no recorded commits)', async done => {
    const Example = () => null;

    utils.act(() =>
      ReactDOM.render(<Example />, document.createElement('div')),
    );

    let context: Context = ((null: any): Context);

    function ContextReader() {
      context = React.useContext(ProfilerContext);
      return null;
    }

    // Profile but don't record any updates.
    await utils.actAsync(() => store.profilerStore.startProfiling());
    await utils.actAsync(() => {
      TestRenderer.create(
        <Contexts>
          <ContextReader />
        </Contexts>,
      );
    });
    expect(context).not.toBeNull();
    expect(context.didRecordCommits).toBe(false);
    expect(context.isProcessingData).toBe(false);
    expect(context.isProfiling).toBe(true);
    expect(context.profilingData).toBe(null);
    await utils.actAsync(() => store.profilerStore.stopProfiling());

    expect(context).not.toBeNull();
    expect(context.didRecordCommits).toBe(false);
    expect(context.isProcessingData).toBe(false);
    expect(context.isProfiling).toBe(false);
    expect(context.profilingData).toBe(null);

    done();
  });

  it('should auto-select the root ID matching the Components tab selection if it has profiling data', async done => {
    const Parent = () => <Child />;
    const Child = () => null;

    const containerOne = document.createElement('div');
    const containerTwo = document.createElement('div');
    utils.act(() => ReactDOM.render(<Parent />, containerOne));
    utils.act(() => ReactDOM.render(<Parent />, containerTwo));
    expect(store).toMatchSnapshot('mounted');

    // Profile and record updates to both roots.
    await utils.actAsync(() => store.profilerStore.startProfiling());
    await utils.actAsync(() => ReactDOM.render(<Parent />, containerOne));
    await utils.actAsync(() => ReactDOM.render(<Parent />, containerTwo));
    await utils.actAsync(() => store.profilerStore.stopProfiling());

    let context: Context = ((null: any): Context);
    function ContextReader() {
      context = React.useContext(ProfilerContext);
      return null;
    }

    // Select an element within the second root.
    await utils.actAsync(() =>
      TestRenderer.create(
        <Contexts
          defaultSelectedElementID={store.getElementIDAtIndex(3)}
          defaultSelectedElementIndex={3}>
          <ContextReader />
        </Contexts>,
      ),
    );

    expect(context).not.toBeNull();
    expect(context.rootID).toBe(
      store.getRootIDForElement(((store.getElementIDAtIndex(3): any): number)),
    );

    done();
  });

  it('should not select the root ID matching the Components tab selection if it has no profiling data', async done => {
    const Parent = () => <Child />;
    const Child = () => null;

    const containerOne = document.createElement('div');
    const containerTwo = document.createElement('div');
    utils.act(() => ReactDOM.render(<Parent />, containerOne));
    utils.act(() => ReactDOM.render(<Parent />, containerTwo));
    expect(store).toMatchSnapshot('mounted');

    // Profile and record updates to only the first root.
    await utils.actAsync(() => store.profilerStore.startProfiling());
    await utils.actAsync(() => ReactDOM.render(<Parent />, containerOne));
    await utils.actAsync(() => store.profilerStore.stopProfiling());

    let context: Context = ((null: any): Context);
    function ContextReader() {
      context = React.useContext(ProfilerContext);
      return null;
    }

    // Select an element within the second root.
    await utils.actAsync(() =>
      TestRenderer.create(
        <Contexts
          defaultSelectedElementID={store.getElementIDAtIndex(3)}
          defaultSelectedElementIndex={3}>
          <ContextReader />
        </Contexts>,
      ),
    );

    // Verify the default profiling root is the first one.
    expect(context).not.toBeNull();
    expect(context.rootID).toBe(
      store.getRootIDForElement(((store.getElementIDAtIndex(0): any): number)),
    );

    done();
  });

  it('should maintain root selection between profiling sessions so long as there is data for that root', async done => {
    const Parent = () => <Child />;
    const Child = () => null;

    const containerA = document.createElement('div');
    const containerB = document.createElement('div');
    utils.act(() => ReactDOM.render(<Parent />, containerA));
    utils.act(() => ReactDOM.render(<Parent />, containerB));
    expect(store).toMatchSnapshot('mounted');

    // Profile and record updates.
    await utils.actAsync(() => store.profilerStore.startProfiling());
    await utils.actAsync(() => ReactDOM.render(<Parent />, containerA));
    await utils.actAsync(() => ReactDOM.render(<Parent />, containerB));
    await utils.actAsync(() => store.profilerStore.stopProfiling());

    let context: Context = ((null: any): Context);
    let dispatch: DispatcherContext = ((null: any): DispatcherContext);
    let selectedElementID = null;
    function ContextReader() {
      context = React.useContext(ProfilerContext);
      dispatch = React.useContext(TreeDispatcherContext);
      selectedElementID = React.useContext(TreeStateContext).selectedElementID;
      return null;
    }

    const id = ((store.getElementIDAtIndex(3): any): number);

    // Select an element within the second root.
    await utils.actAsync(() =>
      TestRenderer.create(
        <Contexts defaultSelectedElementID={id} defaultSelectedElementIndex={3}>
          <ContextReader />
        </Contexts>,
      ),
    );

    expect(selectedElementID).toBe(id);

    // Profile and record more updates to both roots
    await utils.actAsync(() => store.profilerStore.startProfiling());
    await utils.actAsync(() => ReactDOM.render(<Parent />, containerA));
    await utils.actAsync(() => ReactDOM.render(<Parent />, containerB));
    await utils.actAsync(() => store.profilerStore.stopProfiling());

    const otherID = ((store.getElementIDAtIndex(0): any): number);

    // Change the selected element within a the Components tab.
    utils.act(() => dispatch({type: 'SELECT_ELEMENT_AT_INDEX', payload: 0}));

    // Verify that the initial Profiler root selection is maintained.
    expect(selectedElementID).toBe(otherID);
    expect(context).not.toBeNull();
    expect(context.rootID).toBe(store.getRootIDForElement(id));

    done();
  });

  it('should sync selected element in the Components tab too, provided the element is a match', async done => {
    const GrandParent = ({includeChild}) => (
      <Parent includeChild={includeChild} />
    );
    const Parent = ({includeChild}) => (includeChild ? <Child /> : null);
    const Child = () => null;

    const container = document.createElement('div');
    utils.act(() =>
      ReactDOM.render(<GrandParent includeChild={true} />, container),
    );
    expect(store).toMatchSnapshot('mounted');

    const parentID = ((store.getElementIDAtIndex(1): any): number);
    const childID = ((store.getElementIDAtIndex(2): any): number);

    // Profile and record updates.
    await utils.actAsync(() => store.profilerStore.startProfiling());
    await utils.actAsync(() =>
      ReactDOM.render(<GrandParent includeChild={true} />, container),
    );
    await utils.actAsync(() =>
      ReactDOM.render(<GrandParent includeChild={false} />, container),
    );
    await utils.actAsync(() => store.profilerStore.stopProfiling());

    expect(store).toMatchSnapshot('updated');

    let context: Context = ((null: any): Context);
    let selectedElementID = null;
    function ContextReader() {
      context = React.useContext(ProfilerContext);
      selectedElementID = React.useContext(TreeStateContext).selectedElementID;
      return null;
    }

    await utils.actAsync(() =>
      TestRenderer.create(
        <Contexts>
          <ContextReader />
        </Contexts>,
      ),
    );
    expect(selectedElementID).toBeNull();

    // Select an element in the Profiler tab and verify that the selection is synced to the Components tab.
    await utils.actAsync(() => context.selectFiber(parentID, 'Parent'));
    expect(selectedElementID).toBe(parentID);

    // Select an unmounted element and verify no Components tab selection doesn't change.
    await utils.actAsync(() => context.selectFiber(childID, 'Child'));
    expect(selectedElementID).toBe(parentID);

    done();
  });
});
