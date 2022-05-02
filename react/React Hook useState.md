```js
const Demo01 = () => {

  const [num, setNum] = React.useState(22)
  const [text, setText] = React.useState('hello hook')

  return (
    <div onClick={() => setNum(num + 1)}>
      <p>react function component</p>
      <span>Hook num: {num}</span>
      <span>Hook text: {text}</span>
    </div>
  )
}
```

按照惯例，我们以 Demo01 为例子来深入了解 useState。

## React Hook 的动态赋值

如果我们直接通过 react/src/React.js 去查看 useState 的源码的话，会发现最终引用的却是一个什么都没有 current 对象。这是因为在 react 的内部对于 ReactCurrentDispatcher 是进行动态赋值的，因为在不同状态下 （mount, update）hooks 内部调用的函数也是不同的。

```js
export function useState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

function resolveDispatcher() {
  const dispatcher = ReactCurrentDispatcher.current;
  return dispatcher;
}

const ReactCurrentDispatcher = {
  /**
   * @internal
   * @type {ReactComponent}
   */
  current: (null: null | Dispatcher),
};
```

首先，在 react 的 beginWork 阶段里在创建 <Demo01/> 的 Fiber Node 时，react 会先对 workInProgress.tag 打上 IndeterminateComponent 标记。意思就是 还不知道这个组件是 function or class。

```js
// react-reconciler/src/ReactWorkTags.js
export const IndeterminateComponent = 2; // Before we know whether it is function or class
```

 所以在初次渲染 Demo01  的时候会根据当前 workInProgress.tag == IndeterminateComponent 来执行 mountIndeterminateComponent 函数，在这个函数里就有对 React Hook 赋值的关键函数 renderWithHooks 。

在 renderWithHooks 里会判断当前是 mount 阶段还是 update 阶段，将 ReactCurrentDispatcher.current 赋值为 HooksDispatcherOnMountInDEV 或 HooksDispatcherOnUpdateInDEV。

```js
// /react-reconciler/src/ReactFiberHooks.old.js  
currentlyRenderingFiber = workInProgress;

if (__DEV__) {
    if (current !== null && current.memoizedState !== null) {
      ReactCurrentDispatcher.current = HooksDispatcherOnUpdateInDEV;
    } else if (hookTypesDev !== null) {
      // This dispatcher handles an edge case where a component is updating,
      // but no stateful hooks have been used.
      // We want to match the production code behavior (which will use HooksDispatcherOnMount),
      // but with the extra DEV validation to ensure hooks ordering hasn't changed.
      // This dispatcher does that.
      ReactCurrentDispatcher.current = HooksDispatcherOnMountWithHookTypesInDEV;
    } else {
      ReactCurrentDispatcher.current = HooksDispatcherOnMountInDEV;
    }
  } else {
    ReactCurrentDispatcher.current =
      current === null || current.memoizedState === null
        ? HooksDispatcherOnMount
        : HooksDispatcherOnUpdate;
  }
```

HooksDispatcherOnMountInDEV 里包含了所有 mount 阶段时的 hooks ，HooksDispatcherOnUpdateInDEV 里包含了所有 update 时的 hooks。我们先来看 HooksDispatcherOnMountInDEV。

以 useState 为例子：

```js
// packages/react-reconciler/src/ReactFiberHooks.old.js
let HooksDispatcherOnMountInDEV: Dispatcher | null = null;

HooksDispatcherOnMountInDEV = {
      useState<S>(
      initialState: (() => S) | S,
    ): [S, Dispatch<BasicStateAction<S>>] {
      currentHookNameInDev = 'useState';
        // 把 currentHookNameInDev 添加到 hookTypesDev 数组中,这个数组用来存放 hooks
      mountHookTypesDev();
      const prevDispatcher = ReactCurrentDispatcher.current;
      ReactCurrentDispatcher.current = InvalidNestedHooksDispatcherOnMountInDEV;
      try {
        return mountState(initialState);
      } finally {
        ReactCurrentDispatcher.current = prevDispatcher;
      }
    },
      ......
}
```

对 Hooks 赋值完以后 react 会执行 Demo01 去获取 return 的 react element，而在执行 Demo01 的时候也就会执行我们的 useState hooks

```js
let children = Component(props, secondArg) // Component 就是当前 function Component 的函数名
```

## 执行 useState

在对 ReactCurrentDispatcher.current 赋值后，我们执行的 useState 就是 HooksDispatcherOnMountInDEV 里的 useState，可以根据代码看到，最终执行的是一个 mountState(initialState) 的函数。我们来看看他做了哪些事情。

```js
// packages/react-reconciler/src/ReactFiberHooks.old.js

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,

    baseState: null,
    baseQueue: null,
    queue: null,

    next: null,
  };

  if (workInProgressHook === null) {
    // This is the first hook in the list
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  } else {
    // Append to the end of the list
    workInProgressHook = workInProgressHook.next = hook;
  }
  return workInProgressHook;
}

function mountState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  const hook = mountWorkInProgressHook();
  if (typeof initialState === 'function') {
    // $FlowFixMe: Flow doesn't like mixed types
    initialState = initialState();
  }
  hook.memoizedState = hook.baseState = initialState;
  const queue = (hook.queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: (initialState: any),
  });
  const dispatch: Dispatch<
    BasicStateAction<S>,
  > = (queue.dispatch = (dispatchAction.bind(
    null,
    currentlyRenderingFiber,
    queue,
  ): any));
  return [hook.memoizedState, dispatch];
}
```

1. 首先声明了一个 Hook 对象，然后将它赋值给 workInProgressHook，并且以链表的形式挂载在 currentlyRenderingFiber.memoizedState 上 （还记得 renderWithHooks 里的 currentlyRenderingFiber = workInProgress; 吗），然后返回链表的尾部。
2. 把获取到的 initialState 值赋给 hook 对象的 baseState 和 memoizedState 
3. 声明 queue 和 dispatch 并赋值，用来做更新操作
4. 把 state 和 setState 返回出去。

执行完 Hooks 后，workInProgress.memoizedState 上就存在了一条存放 hooks 的链表，也就是 currentlyRenderingFiber.memoizedState