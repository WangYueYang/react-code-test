## dispatchAction

从 mountState 的返回值可以看到 useState 的第二个用来更新状态的函数实际上就是 dispatchAction 。我们来看看他做了什么事情

```js
function mountState(initState){
  const dispatch = queue.dispatch = dispatchAction.bind(null,currentlyRenderingFiber,queue)
  return [hook.memoizedState, dispatch];
}
```

