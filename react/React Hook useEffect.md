## mountEffect

```js
function mountEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  if (__DEV__) {
    // $FlowExpectedError - jest isn't a global, and isn't recognized outside of tests
    if ('undefined' !== typeof jest) {
      warnIfNotCurrentlyActingEffectsInDEV(currentlyRenderingFiber);
    }
  }
  return mountEffectImpl(
    UpdateEffect | PassiveEffect,
    HookPassive,
    create,
    deps,
  );
}

// UpdateEffect
export const Update = /*                       */ 0b000000000000000100;
// PassiveEffect
export const Passive = /*                      */ 0b000000001000000000;
// HookPassive
export const Passive = /*   */ 0b100;
```

mountEffect 里会调用 mountEffectImpl 方法，把 useEffect 的回调和依赖传递进去。关于前两个参数我的理解是 react 的某些优先级。具体的其实我也不太清楚。我是彩笔。我觉得和优先级相关的可以先不管，毕竟我是这样的。

然后也是声明一个 hook 的数据结构，把他添加在当前 workInProgress.memoizedState 的链表上，和 useState 是一样的。拿到 useEffect 的依赖项 deps 没有的话就是 null ，然后把 pushEffect 的值传给 hook.memoizedState。我们来看看 pushEffect

```js
function mountEffectImpl(fiberFlags, hookFlags, create, deps): void {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  currentlyRenderingFiber.flags |= fiberFlags;
  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,
    create,
    undefined,
    nextDeps,
  );
}
```

### pushEffect

pushEffect 里做的事情很简单

1. 声明一个 effect 的数据结构
2. 判断 componentUpdateQueue （也就是 workInProgress.updateQueue） 是否存在，如果不存在的话就创建一个 componentUpdateQueue ，把他赋值给当前 workInProgress.updateQueue ，
3. 如果 componentUpdateQueue 不存在 让 effect 和自己形成一条单向环状链表，把这条链表赋值给 componentUpdateQueue.lastEffect
4. 如果 componentUpdateQueue 存在但是 componentUpdateQueue.lastEffect 不存在的话就重复 3 的逻辑
5. componentUpdateQueue.lastEffect 存在的话就把当前 effect 添加到这条链表的尾部
6. 把 effect 返回出去

```js
function pushEffect(tag, create, destroy, deps) {
  const effect: Effect = {
    tag, // 优先级相关
    create, // useEffect 的 callback
    destroy, // useEffect 的 return 的函数
    deps, // 依赖项
    // Circular
    next: (null: any), // 指向下一个 useEffect
  };
  let componentUpdateQueue: null | FunctionComponentUpdateQueue = (currentlyRenderingFiber.updateQueue: any);
  if (componentUpdateQueue === null) {
    componentUpdateQueue = createFunctionComponentUpdateQueue();
    currentlyRenderingFiber.updateQueue = (componentUpdateQueue: any);
    componentUpdateQueue.lastEffect = effect.next = effect;
  } else {
    const lastEffect = componentUpdateQueue.lastEffect;
    if (lastEffect === null) {
      componentUpdateQueue.lastEffect = effect.next = effect;
    } else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      componentUpdateQueue.lastEffect = effect;
    }
  }
  return effect;
}
```

关于创建 componentUpdateQueue，只是返回了一个有 lastEffect 属性的 obj

```js
componentUpdateQueue = createFunctionComponentUpdateQueue();
function createFunctionComponentUpdateQueue(): FunctionComponentUpdateQueue {
  return {
    lastEffect: null,
  };
}
```

## 执行 useEffect callback



