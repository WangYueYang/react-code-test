还是以这个组件为例子，我们看看 state 是如何改变的

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
      num: 3,
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

## enqueueSetState

我们在 classComponent 里做 setState 操作时实际调用的是 this.updater.enqueueSteState 方法，他的主要作用是获取到当前组件的 Fiber 实例，然后将更新的 update state 加入到 Fiber 的 updateQueue 中。

```js
// react/src/ReactBaseClasses.js
Component.prototype.setState = function (partialState, callback) {
  this.updater.enqueueSetState(this, partialState, callback, 'setState');
};

// react-reconciler/src/ReactFiberClassComponent.old.js
const classComponentUpdater = {
  enqueueSetState(inst, payload, callback) {
    // 获取当前组件 Fiber
    const fiber = getInstance(inst);
    const eventTime = requestEventTime();
    const lane = requestUpdateLane(fiber);
    // 创建 update 对象
    const update = createUpdate(eventTime, lane);
    // 把要修改的 state 赋值给 update.payload
    update.payload = payload;
    if (callback !== undefined && callback !== null) {
      update.callback = callback;
    }
    // 加入到 enqueueUpdate 中
    enqueueUpdate(fiber, update);
    scheduleUpdateOnFiber(fiber, lane, eventTime);
  },
};

// react-reconciler/src/ReactUpdateQueue.old.js
export function enqueueUpdate<State>(fiber: Fiber, update: Update<State>) {
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
    // 加入到链表头部
    update.next = pending.next;
    pending.next = update;
  }
  // 把 update 赋值到 sharedQueue.pending 上
  sharedQueue.pending = update;
}
```

## render 阶段

在 performSyncWorkOnRoot 之前的 scheduleUpdateOnFiber 里会对优先级做一些处理，我们这里先略过，直接来看后面对 state 的处理。

render 阶段中，因为 FIber 双缓存的特性，会根据 current tree 创建一颗新的 workInProgress tree。在第一次 beginWork 的时候，React 会根据 `!includesSomeLane(renderLanes, updateLanes)` 某些优先级调用 bailoutOnAlreadyFinishedWork 方法，复用原有的 current Fiber 对应的节点数据创建出 <App/> 的 Fiber 并通过 alternate 和 current Fiber 上对应的节点关联起来，最后将创建的 App 组件的 Fiber return 出去开始第二遍 beginWork

在 App 的 beginWork 中和渲染的流程一样会执行 updateClassComponent，去获取当前 workInProgress.stateNode 也就是 App 实例，如果存在的话就会执行 updateClassInstance 函数

## updateClassInstance 里的 processUpdateQueue

首先会获取到 updateQueue 中的 baseUpdate 链表的头尾，然后声明变量 pendingQueue 获取 updateQueue 的 shared.pending 也就是做 enqueueUpdate 操作时候的那条 pendingQueue 链表，如果这条链表存在的话，将原有的 pendingQueue 清空，再拿到 pendingQueue 的首尾并把这条环状链表剪开。然后将 pendingQueue 添加到 baseUpdate 的 尾部。

```js
// react-reconciler/src/ReactUpdateQueue.old.js/processUpdateQueue

const queue: UpdateQueue<State> = (workInProgress.updateQueue: any);
let firstBaseUpdate = queue.firstBaseUpdate;
let lastBaseUpdate = queue.lastBaseUpdate;

let pendingQueue = queue.shared.pending;
if (pendingQueue !== null) {
  queue.shared.pending = null;

  const lastPendingUpdate = pendingQueue;
  const firstPendingUpdate = lastPendingUpdate.next;
  // 把 update 的环状链表剪开
  lastPendingUpdate.next = null;
  // Append pending updates to base queue
  // 将 pendingQueue 添加到 baseUpdate 链表的尾部
  if (lastBaseUpdate === null) {
    firstBaseUpdate = firstPendingUpdate;
  } else {
    lastBaseUpdate.next = firstPendingUpdate;
  }
  // lastBaseUpdate 直接指向 baseUpdate 链表的最尾部
  lastBaseUpdate = lastPendingUpdate;
}
```

接下来遍历 baseUpdate 链表，以 fiber.updateQueue.baseState 为初始 state，以此与遍历到的每个 update 计算并产生新的 state 。在 getStateFromUpdate 函数里通过判断参数 update （通过 createUpdate 函数创建的 update 对象）上的 tag 进行不同的 update 操作，如果 tag 是 UpdateState 的话，会从传入的 update.payload 上拿到新的 state 和之前的 state 做 `Object.assign({}, prevState, partialState)` 操作，最后将结果返回出去。

```js
// react-reconciler/src/ReactUpdateQueue.old.js/processUpdateQueue
if (firstBaseUpdate !== null) {
  let newState = queue.baseState;
  let newLanes = NoLanes;

  let newBaseState = null;
  let newFirstBaseUpdate = null;
  let newLastBaseUpdate = null;

  let update = firstBaseUpdate;
  do {
    newState = getStateFromUpdate(
      workInProgress,
      queue,
      update,
      newState,
      props,
      instance
    );

    update = update.next;

    if (update == null) {
      pendingQueue = queue.shared.pending;
      if (pendingQueue === null) {
        break;
      }
    }
  } while (true);
}
```

获取到更新后到 state 后会添加到 workInProgress.memoizedState 上，而后续则会根据 memoizedState 的值来进行渲染。

```js
// react-reconciler/src/ReactUpdateQueue.old.js/processUpdateQueue
if (newLastBaseUpdate === null) {
  newBaseState = newState;
}

queue.baseState = ((newBaseState: any): State);
queue.firstBaseUpdate = newFirstBaseUpdate;
queue.lastBaseUpdate = newLastBaseUpdate;
workInProgress.lanes = newLanes;
workInProgress.memoizedState = newState;
```

## shouldUpdate & 更新 class state

在获取到新的 state 后，react 会根据 checkHasForceUpdateAfterProcessing 和 checkHasForceUpdateAfterProcessing 来判断是否更新。以及修改 class 实例上 state 的值, 如果 class 组件上有更新相关的生命周期的话，会为 workInProgress.flags 打上 Update 的 tag.

其中 checkHasForceUpdateAfterProcessing 会判断 Update 的 tag 是不是 FoceUpdate，而 checkShouldComponentUpdate 里会根据是否是 PureReactComponent 浅比较 state 和 props，或通过 shouldComponentUpdate 的返回值来判断是否更新，如果这两个都没有的话直接返回 true 打上 Update 的 tag。最终将 shouldUpdate 的结果返回出去。

```js
const shouldUpdate =
  checkHasForceUpdateAfterProcessing() ||
  checkShouldComponentUpdate(
    workInProgress,
    ctor,
    oldProps,
    newProps,
    oldState,
    newState,
    nextContext
  );

instance.props = newProps;
instance.state = newState;
instance.context = nextContext;
```

## state 更新后的 render

执行完 updateClassInstance 后，会接着在 finishClassComponent 里执行 class 实例的 render 方法，因为在前一步里 class 实例的 state 已经改变了，所以在执行了 render 方法后返回的 react element 里的 props.children 里的 num 就变成了 setState 更新后的值。接着复用原有的 current Fiber 创建新的 workInProgress Fiber 将新的 react element 的 props 赋值给 workInProgress.pendingProps。

这时 `<div className="app-root">` 的 fiber node 的 pendingProps 上保存着更新后的 state。我们继续 render 阶段的流程。

## div#app-root 里更新子 Fiber

div#app-root 的 beginWork 里根据他自己对应的 workInProgress 的 pendingProps.children 来更新子 Fiber，关于里面的 Diff 操作我们先不用管，我们只需要知道因为 `this.state.num` 的值改变了，在这一步里 react 会复用之前 `this.state.num` 的 current fiber 创建新的 workInProgress fiber，同样将新的 `this.state.num` 的值添加到他自己的 workInProgress.pendingProps 上

## 更新 workInProgress.memoizedProps

每次 beginWork 结束后，会修改当前的 workInProgress.memoizedProps。 State.num 的 beginWork 的 memoizedProps 也是这个时候变成了 setState 后的值。

```js
unitOfWork.memoizedProps = unitOfWork.pendingProps;
```

## state.num 的 completeWork

benginWork 执行完后，在 `state.num` 的 Fiber Node 的 completeWork 阶段，react 会从他的 Fiber Node 上获取 pendingProps（更新后的 state）和 memoizedProps （以前的 state）做对比，如果不想等的话，就会给他的 Fiber Node 上打上 Update 的 flags `workInProgress.flags |= Update`

## commitMutationEffects 里进行 Update

还记得之前在 wrkInProgress.flags 上打的 Update 标记吗， commit 阶段中的 commitMutationEffects 会根据 flags 来进行 Update 操作。然后判断 state.num 的 Fiber Node 的 tag 是 HostText。会从 Fiber 的 memoizedProps 获取到新的 text 然后使用 `dom.nodeValue = newText;` 来更新文本。这时候页面上的 num 就从 0 变成了 3。

## 做个总结：

1. 首先会将 setState 的值添加到当前组件 Fiber 的 pendingQueue 中
2. 在 updateClassInstace 里 会吧 pendingQueue 这条环状链表剪开，然后连接到 baseUpdate 链表的尾部
3. 遍历 baseUpdate 链表，以 fiber.updateQueue.baseState 为初始值和这条链表上的每一个 update 对象计算产生新的 state。（具体是 `Object.assign({}, oldState, newState)`）
4. 把更新后的值添加到当前组件的 workInProgress.memoizedState
5. 更新组件实例的 state `instance.state = newState` 并且如果组件有更新相关的生命周期 （componentDidUpdate，getSnapshotBeforeUpdate）的话会对 oldProps, oldState 和 newProps，newState 做浅比较，如果不想等的话会给 workInProgress.flags 打上 Update 或 Snapshot tag。
6. 执行 render 方法，因为 state 改变了，所以通过 React.creatElement 返回的 react element 的 props.children 的值就是 setState 后的值，拿新的 react element 复用之前的 current fiber 去创建新的 Fiber，并且把更新后的 state 保存在创建的 Fiber.pendingProps 上
7. 创建 `{this.state.num}` 对应的 Fiber ，同样也是将更新后的值保存在他的 Fiber.pendingProps 上
8. beginWork 后，修改当前 workInProgress.menmoizedProps = workInProgress.pendingProps
9. completeWork 阶段用 oldState 和 newState 做对比如果不想等的话给当前 wrokInProgress.flags 打上 Update 标记
10. commit 阶段中的 commitMutationEffects 判断 workInProgress.flags 如果是 Update 的话做更新操作，对于 `{this.state,num}` 来说就直接使用 `DOM.nodeValue = newText` 来更新文本
