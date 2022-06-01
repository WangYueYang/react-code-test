import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { createElement } from '../packages/react/src/ReactElement'
// import App from './app'

import Demo01 from './demo/demo01'
import UseEffect from './demo/useEffect'

import * as Didact from '../my-react/react';

// packages/react-dom/src/client/ReactDOMLegacy.js
// ReactDOM.render()第一个参数其实就是 ReactElement 返回的对象 {$$typeof ......}
// ReactDOM.render(<App />, document.getElementById('root'))
// ReactDOM.render(<Demo01 />, document.getElementById('root'))
// ReactDOM.render(<UseEffect />, document.getElementById('root'))

// ReactDOM.unstable_createRoot(document.getElementById('root')).render(<App />)


/** @jsx Didact.createElement */
const element = (
  <div id="foo">
    <a className="my-name">aaa</a> 
    <b />
    <span>123</span>
  </div>
)


const container = document.getElementById("root")
Didact.render(element, container)
// ReactDOM.render(element, container)


