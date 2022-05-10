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

在 React 的 commit 阶段里，执行 commitBeforeMutationEffects 的时候会通过 scheduleCallback 调度 flushPassiveEffects，在 flushPassiveEffects 里会执行 `runWithPriority(priorityLevel, flushPassiveEffectsImpl);` 以某一个优先级来执行 flushPassiveEffectsImpl 

```js
// packages/react-reconciler/src/ReactFiberWorkLoop.old.js

function commitBeforeMutationEffects() {
  while (nextEffect !== null) {
    // ... 省略代码
    if ((flags & Passive) !== NoFlags) {
      // If there are passive effects, schedule a callback to flush at
      // the earliest opportunity.
      if (!rootDoesHavePassiveEffects) {
        rootDoesHavePassiveEffects = true;
        scheduleCallback(NormalSchedulerPriority, () => {
          flushPassiveEffects();
          return null;
        });
      }
    }
    nextEffect = nextEffect.nextEffect;
  }
}

export function flushPassiveEffects(): boolean {

  // ...省略了好多代码
  return runWithPriority(priorityLevel, flushPassiveEffectsImpl);

}
```

### 关于 scheduleCallback

scheduleCallback 是调度器 scheduler 提供的方法，用于以某一个优先级调度一个回调函数，我们可以简单理解为这部分代码会以异步执行 `flushPassiveEffects()` 关于 scheduler 的原理后面继续了解吧。。

### flushPassiveEffectsImpl

pendingPassiveHookEffectsUnmount 是一个全局的数组，里面存储了所有的 useEffect 他的存储方法是这样的 `[useEffect1, 对应的Fiber1, useEffect2, 对应的Fiber2]` 。

声明一个常量 unmountEffects 拿到所有 Effects 的时候会先遍历这个数组，然后判断 effect.distory 是不是 function ，去执行 useEffect return 的函数。

```js
const unmountEffects = pendingPassiveHookEffectsUnmount;
  pendingPassiveHookEffectsUnmount = [];
for (let i = 0; i < unmountEffects.length; i += 2) {
  const effect = ((unmountEffects[i]: any): HookEffect);
    const fiber = ((unmountEffects[i + 1]: any): Fiber);
    const destroy = effect.destroy;
    effect.destroy = undefined;
  if (typeof destroy === 'function') {
    // 里面省略代码，反正就是执行 destory
    invokeGuardedCallback(null, destroy, null);
  }
}
```

然后同样是去 pendingPassiveHookEffectsUnmount 拿到所有的 Effects，接着遍历这个数组。然后通过 invokeGuardedCallback 调度 invokePassiveEffectCreate ，最终是在 invokePassiveEffectCreate 里执行的 useEffect 的 callback，把 callback 的返回值赋值给 effect.destory 

```js
const mountEffects = pendingPassiveHookEffectsMount;
  pendingPassiveHookEffectsMount = [];
 for (let i = 0; i < mountEffects.length; i += 2) {
    const effect = ((mountEffects[i]: any): HookEffect);
    const fiber = ((mountEffects[i + 1]: any): Fiber);
   
   // ... 省略好多代码
   invokeGuardedCallback(null, invokePassiveEffectCreate, null, effect);
 }

function invokePassiveEffectCreate(effect: HookEffect): void {
  const create = effect.create;
  effect.destroy = create();
}
```









