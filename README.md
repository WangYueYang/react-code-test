## React 17.0.0 源码笔记 （更新中）

首先感谢卡颂大哥的 《React 技术揭秘》这本书，对于我第一次阅读 react 源码起了非常大的帮助。
其次也是第一次写源码相关的东西，可能因为个人的技术原因（我很菜）或是源码部分个人理解上的错误，会导致里面的内容有些地方不是很正确。如果有大佬看到的话可以帮忙指正一下吗。🙏🙏🙏
目前还有很多东西没有写，比如 Diff, hooks, context 等等，后面会慢慢补充。

------------------------------------------------

packages: react 源码

react:  react 源码笔记

src: demos

---------------------------------

阅读目录：
------------------------------------------------

###  React 渲染

[React是如何创建FiberNode的](https://github.com/WangYueYang/react-code-test/blob/master/react/React%E6%98%AF%E5%A6%82%E4%BD%95%E5%88%9B%E5%BB%BAFiberNode%E7%9A%84.md)

[React.createElement](https://github.com/WangYueYang/react-code-test/blob/master/react/React.createElement.md)

[React 的 render 流程一](https://github.com/WangYueYang/react-code-test/blob/master/react/React%20%E7%9A%84%20render%E6%B5%81%E7%A8%8B%20%E4%B8%80.md)

[React render 流程二 （beginWork）](https://github.com/WangYueYang/react-code-test/blob/master/react/React%20render%20%E6%B5%81%E7%A8%8B%E4%BA%8C%20%EF%BC%88beginWork%EF%BC%89.md)

[React render 流程三 （completeWork)](https://github.com/WangYueYang/react-code-test/blob/master/react/React%20render%20%E6%B5%81%E7%A8%8B%E4%B8%89%20%EF%BC%88completeWork%EF%BC%89.md)

[React commit 阶段](https://github.com/WangYueYang/react-code-test/blob/master/react/React%20commit%20%E9%98%B6%E6%AE%B5.md)


### React 更新

[React 状态更新之 ReactDOM.render 是如何渲染state 的](https://github.com/WangYueYang/react-code-test/blob/master/react/React%20%E7%8A%B6%E6%80%81%E6%9B%B4%E6%96%B0%E4%B9%8B%20ReactDOM.render%20%E6%98%AF%E5%A6%82%E4%BD%95%E6%B8%B2%E6%9F%93state%20%E7%9A%84.md)

[React 更新之 setState](https://github.com/WangYueYang/react-code-test/blob/master/react/React%20%E6%9B%B4%E6%96%B0%E4%B9%8B%20setState.md)
