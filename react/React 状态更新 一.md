在 React 中出发状态更新的方式有一下几种：

- ReactDOM.render
- This.setState
- this.forceUpdate
- useState
- useReducer

首先来看一下 ReactDOM.render 中 state 是如何渲染到页面的。

我们以这个组件为例子：

```js
class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      num: 0,
    };
  }

  handleClick() {
    this.setState({
      num: ++this.state.num,
    });
  }

  render() {
    return (
      <div className="app-root" onClick={this.handleClick.bind(this)}>
        Number {this.state.num}
      </div>
    );
  }
}
```

## 创建 UpdateQueue 对象挂载到 fiber 上

在之前的 React 渲染流程中我们知道，执行了 ReactDOM.render 方法后，react 会创建根节点的 FiberRootNode 和 rootFiber，同时也会创建 updateQueue 对象，并将它挂在到 rootFiber 上

```js
// react-reconciler/src/ReactFiberRoot.old.js

export function createFiberRoot(
  containerInfo: any,
  tag: RootTag,
  hydrate: boolean,
  hydrationCallbacks: null | SuspenseHydrationCallbacks
): FiberRoot {
  // 创建 FiberRootNode
  const root: FiberRoot = (new FiberRootNode(containerInfo, tag, hydrate): any);
  // 创建 rootFiber
  const uninitializedFiber = createHostRootFiber(tag);
  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;
  // 创建 updateQueue 对象
  initializeUpdateQueue(uninitializedFiber);
}

// react-reconciler/src/ReactUpdateQueue.old.js
export function initializeUpdateQueue<State>(fiber: Fiber): void {
  const queue: UpdateQueue<State> = {
    baseState: fiber.memoizedState,
    firstBaseUpdate: null,
    lastBaseUpdate: null,
    shared: {
      pending: null,
    },
    effects: null,
  };
  fiber.updateQueue = queue;
}
```

关于 updateQueue 对象：

- baseState: 初始 state，后面会基于这个 state 根据 update 计算新的 state
- firstBaseUpdate, lastBaseUpdate: update 形成的链表的头和尾
- Shared.pending: 新产生的 update 会以单向环状链表挂在到 shared.pending 上，计算 state 的时候会剪开这个环状链表，链接在 lastBaseUpdate 后面
- Effects: callback 不为 null 的 update

## createUpdate

挂载完了 updateQueue 对象后，继续 react 的渲染流程往下走，在 updateContainer 里会执行 createUpdate 方法创建一个 update 对象，并且把 jsx 对象赋值给 update.payload ，接着执行 enqueueUpdate 函数进行链表操作，把创建好的 update 对象推入到 fiber.updateQueue.shared.pending 这条环状链表中。

做完以上操作后，继续 react 更新的流程，执行 performSyncWorkOnRoot，开始 render 阶段，执行 renderRootSync

```js
// react-reconciler/src/ReactFiberReconciler.old.js
export function updateContainer(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?React$Component<any, any>,
  callback: ?Function
): Lane {
  const update = createUpdate(eventTime, lane);
  update.payload = { element };
  enqueueUpdate(current, update);
  scheduleUpdateOnFiber(current, lane, eventTime);
}

// react-reconciler/src/ReactUpdateQueue.old.js
export function createUpdate(eventTime: number, lane: Lane): Update<*> {
  const update: Update<*> = {
    eventTime, // 任务时间，通过performance.now()获取的毫秒数。该字段在未来会重构
    lane, // 优先级 车道

    tag: UpdateState, // 更新的类型，包括UpdateState | ReplaceState | ForceUpdate | CaptureUpdate。
    payload: null, // 更新挂载的数据，不同类型组件挂载的数据不同
    callback: null, // 更新的回调函数

    next: null, // 与其他的 Update 形成链表
  };
  return update;
}

export function enqueueUpdate<State>(fiber: Fiber, update: Update<State>) {
  // 还记得创建 rootFiber 时候给 rootFiber 上挂载的 updateQueue 对象吗
  const updateQueue = fiber.updateQueue;
  if (updateQueue === null) {
    // Only occurs if the fiber has been unmounted.
    return;
  }

  const sharedQueue: SharedQueue<State> = (updateQueue: any).shared;
  const pending = sharedQueue.pending;
  // 如果 pending == null 的话 让自己的 update 和自己形成环状链表
  if (pending === null) {
    update.next = update;
  } else {
    // 把pending.next 加入到链表尾部
    update.next = pending.next;
    pending.next = update;
  }
  sharedQueue.pending = update;
}
```

## updateHostRoot 中的 processUpdateQueue

第一遍 beginWork 里根据 workInProgress.tag 先执行 updateHostRoot，里面有比较重要的几步：

1. 根据 current.updateQueue 对 workInProgress.updateQueue 做深拷贝，和 Fiber 树的双缓存一样，updateQueue 也有 workInProgress updateQueue 和 current updateQueue
2. 通过 processUpdateQueue 计算 state，把 state 添加到 workInProgress.memoizedState 和 workInProgress.updateQueue.baseState 上

我们具体来看下 processUpdateQueue 里做了什么事情:

首先是获取到 workInProgress 的 updateQueue 以及 update 链表的首部和尾部。然后获取 updateQueue.shared.pending 也就是整条 update 链表。如果这条链表存在的话会先把原来 workInProgress 上的 update 链表设置为 null。接着会把 update 环状链表剪开，然后判断原有的 lastBaseUpdate 是否存在，如果不存在的话把这一次的 firstPendingUpdate 赋值给 updateQueue 的 firstBaseUpdate, 如果存在的话添加在 updateQueue.lastBaseUpdate 的链表上。也就是插入到之前的 update 链表的后面，然后更改 lastBaseUpdate 的值。这样就得到了一条新的链表 pendingQueue

```js
// react-reconciler/src/ReactUpdateQueue.old.js/ processUpdateQueue
const queue: UpdateQueue<State> = (workInProgress.updateQueue: any);

// 拿到链表的首尾
let firstBaseUpdate = queue.firstBaseUpdate;
let lastBaseUpdate = queue.lastBaseUpdate;
// 暂存整条链表
let pendingQueue = queue.shared.pending;

if (pendingQueue !== null) {
  queue.shared.pending = null;

  // 拿到 暂存的 update 链表中的首和尾，链表尾部就是 shared.pending
  const lastPendingUpdate = pendingQueue;
  // 因为是环状链表所以 尾部.next 就是这条链表的首部
  const firstPendingUpdate = lastPendingUpdate.next;
  // 把这条环状链表剪开
  lastPendingUpdate.next = null;

  if (lastBaseUpdate === null) {
    firstBaseUpdate = firstPendingUpdate;
  } else {
    lastBaseUpdate.next = firstPendingUpdate;
  }
  lastBaseUpdate = lastPendingUpdate;
}
```

然后再通过 while 循环遍历 update 链表执行 getStateFromUpdate 计算出新的 state。这里只看 updateHostRoot 时候的逻辑.

在 getStateFromUpdate 判断 update.tag 最终返回的是这次 update.payload 和上次 state 合并后的结果。然后将 newState 赋值给 updateQueue.baseState 和 workInProgress.memoizedState 上

```js
if (firstBaseUpdate !== null) {
  let newState = queue.baseState;
  let newLanes = NoLanes;

  let newBaseState = null;
  let newFirstBaseUpdate = null;
  let newLastBaseUpdate = null;

  let update = firstBaseUpdate;

  do {
    const updateLane = update.lane;
    const updateEventTime = update.eventTime;
    newState = getStateFromUpdate(
      workInProgress,
      queue,
      update,
      newState,
      props,
      instance
    );
  } while (true);
}

 if (newLastBaseUpdate === null) {
      newBaseState = newState;
    }

    queue.baseState = ((newBaseState: any): State);
    queue.firstBaseUpdate = newFirstBaseUpdate;
    queue.lastBaseUpdate = newLastBaseUpdate;

    workInProgress.lanes = newLanes;
    workInProgress.memoizedState = newState;

...

function getStateFromUpdate<State>(
  workInProgress: Fiber,
  queue: UpdateQueue<State>,
  update: Update<State>,
  prevState: State,
  nextProps: any,
  instance: any
): any {
  switch (update.tag) {
    case UpdateState: {
      const payload = update.payload;
      let partialState;
      partialState = payload;
      return Object.assign({}, prevState, partialState);
    }
  }
}
```

执行完 processUpdateQueue 以后，从 workInProgress 上获取到新计算出的 state 和 element 。执行 reconcileChildren 创建他的 children Fiber 也就是 <App/> 的 Fiber。

```js
processUpdateQueue(workInProgress, nextProps, null, renderLanes);
const nextState = workInProgress.memoizedState;
const nextChildren = nextState.element;
reconcileChildren(current, workInProgress, nextChildren, renderLanes);
```

## new ctor 实例化组件

在 <App/> 的 beginWork 中 会执行 constructClassInstance 函数，在这个函数里会对 classComponent 执行 new 操作，如果 classComponent 上有 state 属性，就可以通过实例.state 获取到，然后把它赋值给当前 workInProgress.memoizedState。然后再执行 adoptClassInstance 给实例的 updater 属性上挂载了组件更新会调用的方法。把当前实例挂载到 workInProgress.stateNode 上。

```js
// constructClassInstance
const instance = new ctor(props, context)
  const state = (workInProgress.memoizedState =
    instance.state !== null && instance.state !== undefined
      ? instance.state
      : null);
adoptClassInstance(workInProgress, instance);

function adoptClassInstance(workInProgress: Fiber, instance: any): void {
  instance.updater = classComponentUpdater;
  workInProgress.stateNode = instance;
}

classComponentUpdater = {
  enqueueForceUpdate: function
  enqueueReplaceState: function
  enqueueSetState: function
  isMounted: function
}
```
