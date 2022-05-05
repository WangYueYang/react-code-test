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

接着声明一个 pending 等于 queue.pending , 当 pending 为 null 时， update 和自己形成一条单向环状链表，不为 null 的话，就将声明的 update 插入到 queue.pending 的这条环状链表尾部，并且让 queue.pending 指向最后一个插入对 update。（这里做的事情和 enqueueUpdate() 是一样的）

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

## updateReducer

updateReducer 会先声明一块新的地址 newHook 然后从 current Fiber 的 memoizedState 链表上拿到对应的 hook，然后将 newHook 赋值给全局的 workInProgressHook 同样也是以链表的方式存储在当前 workInProgress.memoizedState 上。

```js
// updateReducer
// 获取对应的 hook
const hook = updateWorkInProgressHook()

// updateWorkInProgressHook
// 从 current Fiber 上拿到对应的 Hook
  let nextCurrentHook: null | Hook;
  if (currentHook === null) {
    const current = currentlyRenderingFiber.alternate;
    if (current !== null) {
      nextCurrentHook = current.memoizedState;
    } else {
      nextCurrentHook = null;
    }
  } else {
    nextCurrentHook = currentHook.next;
  }

currentHook = nextCurrentHook;

// 开辟一片新的地址
const newHook: Hook = {
      memoizedState: currentHook.memoizedState,

      baseState: currentHook.baseState,
      baseQueue: currentHook.baseQueue,
      queue: currentHook.queue,

      next: null,
    };

// 以链表的形式存储到当前 workInProgress.memoizedState 上
    if (workInProgressHook === null) {
      // This is the first hook in the list.
      currentlyRenderingFiber.memoizedState = workInProgressHook = newHook;
    } else {
      // Append to the end of the list.
      workInProgressHook = workInProgressHook.next = newHook;
    }
return workInProgressHook
```

然后和 class Component 一样，获取到 hook 上的 pendingQueue 链表和 baseQueue。如果 pendingQueue 存在的话，就将 pendingQueue 添加到 baseQueue 链表的尾部。之后将 pendingQueue 清空.

```js
// updateReducer
const queue = hook.queue
const current: Hook = (currentHook: any);
let baseQueue = current.baseQueue;
  const pendingQueue = queue.pending;

  if (pendingQueue !== null) {
	
    if (baseQueue !== null) {
      // 把 pendingQueue 插入到 baseQueue 尾部
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }
    current.baseQueue = baseQueue = pendingQueue;
    queue.pending = null;
  }
```

关于 pendingQueue 和 baseQueue 的操作：

之前在 dispatchAction 里会创建一个 update 的对象，接着会讲这个 update 插入到 queue.pending 中，当 pending == null 时他自己会和自己形成一条环状链表

```js
queue.pending:   u1 ─────┐ 
                  ^      |                                    
                  └──────┘
```

插入 u2 之后，pendingQueeu 就会变成这样

```js
queue.pending = update; // u2
u2.next = u1
u1.next = u2
queue.pending:   u2 ──> u1
                  ^      |                                    
                  └──────┘
```

在 updateReducer 里当 baseQueue == null 时，baseQueue 会直接等于 queue.pending

```js
current.baseQueue: u2 ——> u1
										^      |
  									└──────┘
queue.pending = null
```

当有新的 pendingQueue 进来以后 baseQueue 就变成了这样

```js
queue.pending:   u4 ──> u3
                  ^      |                                    
                  └──────┘

// 首先拿到两条链表的头部
const baseFirst = baseQueue.next // u1
const pendingFirst = pendingQueue.next //u3
// 把 baseQueue 链表尾部的 next 指向 pendingQueue 链表头部，
// 就形成了这样一条链表 u1 -> u2 -> u3 -> u4 -> u3
baseQueue.next = pendingFirst //u2.next = u3
// 接着把 pendingQueue 链表尾部的 next 指向 baseQueue 链表的头部
// 就形成了这样一条链表 u4 -> u1 -> u2 -> u3 -> u4
pendingQueue.next = baseFirst
current.baseQueue = baseQueue = pendingQueue;

current.baseQueue = queue.pending:   u4 ──> u1 ──> u2 ──> u3
                                      ^      							|                                    
                                      └───────────────────┘
```

然后遍历 baseQueue 链表，通过传进来的 basicStateReducer (reducer 参数) 和 update.eagerReducer 进行判断是否相等，然后拿到新的 state

```js
if (baseQueue !== null) {
  const first = baseQueue.next;
    let newState = current.baseState;

    let newBaseState = null;
    let newBaseQueueFirst = null;
    let newBaseQueueLast = null;
    let update = first;
  
  do {
    if (update.eagerReducer === reducer) {
          newState = ((update.eagerState: any): S);
        } else {
          // 可能是 useReducer 的逻辑？后面具体看看
          const action = update.action;
          newState = reducer(newState, action);
        }
    update = update.next;
  } while (update !== null && update !== first);
}
```

拿到了 newState 后将它赋值给 hook.memoizedState 最后把新的 state return 出去。

```js
 hook.memoizedState = newState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueueLast;

    queue.lastRenderedState = newState;

  const dispatch: Dispatch<A> = (queue.dispatch: any);
  return [hook.memoizedState, dispatch];
```

这样 function component 里拿到的就是更新后的 Hook 了。hook 改变后，返回了新的 react element，再往后就是 react 的 render 阶段和 commit 阶段了，最后在 commit 阶段里完成页面的更新. 

## 总结一下

1. 调用 dispatchAction 函数，创建 update 对象并存储更新后的值，
2. 把 update 对象插入到当前 hook 的 queue.peding 链表里，把新的 hook 的值和更新函数也存储在 update 对象上
3. 执行 scheduleUpdateOnFiber 函数，根据某个优先级调度 performSyncWorkOnRoot 进入 beginWork 里
4. 动态赋值 hook 为 updateHooks
5. 把 hook 的 pendingQueue 添加到 baseQueue 尾部，并且把 queue.pending 赋值给 baseQueue
6. 遍历 baseQueue 拿到新的 state
7. 赋值给 hook.memoizedState 并返回出去







