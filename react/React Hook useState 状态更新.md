## dispatchAction

从 mountState 的返回值可以看到 useState 的第二个用来更新状态的函数实际上就是 dispatchAction 。通过 bind 将当前的 workInProgress 和前面声明的 obj queue 作为参数传给 dispatchAction 函数。

```js
// packages/react-reconciler/src/ReactFiberHooks.old.js
function mountState<S>(
  initialState: (() => S) | S
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
  const dispatch: Dispatch<BasicStateAction<S>> = (queue.dispatch =
    (dispatchAction.bind(null, currentlyRenderingFiber, queue): any));
  return [hook.memoizedState, dispatch];
}
```

我们平时在做 `const [num, setNum] = useState(1) setNum(2)` 更新操作的时候传递的参数实际是 dispatchAction 的第三个参数 action。在触发 dispatchAction 函数后，和 class 的 setState 一样 会创建一个用于更新的 obj update，他的 action 属性就是 参数 action

```js
// packages/react-reconciler/src/ReactFiberHooks.old.js/dispatchAction
const update: Update<S, A> = {
  lane,
  action,
  eagerReducer: null,
  eagerState: null,
  next: (null: any),
};
```

接着声明一个 pending 等于 queue.pending , 当 pending 为 null 时， update 和自己形成一条单向环状链表，不为 null 的话，就将声明的 update 插入到 queue.pending 的这条环状链表里，并且让 queue.pending 指向最后一个插入对 update。（这里做的事情和 enqueueUpdate() 是一样的）

```js
const pending = queue.pending;
if (pending === null) {
  // This is the first update. Create a circular list.
  update.next = update;
} else {
  update.next = pending.next;
  pending.next = update;
}
queue.pending = update;
```

然后根据 obj queue 上的 lastRenderedReducer 方法拿到 `setNum` 的值，并且赋值给 queue.eagerState。

```js
const lastRenderedReducer = queue.lastRenderedReducer;
const currentState: S = (queue.lastRenderedState: any);
const eagerState = lastRenderedReducer(currentState, action);
update.eagerReducer = lastRenderedReducer;
update.eagerState = eagerState;
```

queue.lastRenderedReducer: basicStateReducer

```js
//  basicStateReducer
function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {
  // $FlowFixMe: Flow doesn't like mixed types
  return typeof action === 'function' ? action(state) : action;
}
```

当 action 是个函数的时候返回的是 action(state) 这也是 `setNum(prevState => xxx)` 可以获取到上一次的 state 的原因。

拿到了新的 state 值以后，和 class compionent 一样会执行 scheduleUpdateOnFiber 开始根据优先级调度 performSyncWorkOnRoot 进入到 beginWork 阶段，准备进行 updateFunctionComponent

## updateFunctionComponent

在 updateFunctionComponent 里也会执行 renderWithHooks 函数，因为这一次做的是更新的操作，所以 hooks 动态赋值为了 HooksDispatcherOnUpdateInDEV 。然后执行 function Component，又来到了我们的函数组件里。因为 hooks 被赋值成了新的函数，所以组件里的 React.useState 执行的就是 updateState。

```js
if (current !== null && current.memoizedState !== null) {
  ReactCurrentDispatcher.current = HooksDispatcherOnUpdateInDEV;
}
// 执行 function Component
let children = Component(props, secondArg);

// HooksDispatcherOnUpdateInDEV 的结构
const HooksDispatcherOnUpdateInDEV: Dispatcher = {
  useCallback: updateCallback,
  useContext: readContext,
  useEffect: updateEffect,
  useImperativeHandle: updateImperativeHandle,
  useLayoutEffect: updateLayoutEffect,
  useMemo: updateMemo,
  useReducer: updateReducer,
  useRef: updateRef,
  useState: updateState,
  // ...省略
};

// HooksDispatcherOnUpdateInDEV 的代码
HooksDispatcherOnUpdateInDEV = {
  useState<S>(initialState: (() => S) | S): [S, Dispatch<BasicStateAction<S>>] {
    currentHookNameInDev = 'useState';
    updateHookTypesDev();
    const prevDispatcher = ReactCurrentDispatcher.current;
    ReactCurrentDispatcher.current = InvalidNestedHooksDispatcherOnUpdateInDEV;
    try {
      return updateState(initialState);
    } finally {
      ReactCurrentDispatcher.current = prevDispatcher;
    }
  },
    //...省略
};

// updateState
function updateState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  return updateReducer(basicStateReducer, (initialState: any));
}
```

通过源码可以看到 updateState 实际执行的函数是 updateReducer 也就是说 useState 和 useReducer 更新时的逻辑其实是一样的，这也是为什么说 useReducer 是 useState 的替代方案的原因吧。。。。

在 updateState 时给 updateReducer 传入了两个参数，分别是 queue 对象上的 basicStateReducer 和 useState 的默认值。

