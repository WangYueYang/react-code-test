import * as React from 'react'
import * as ReactDOM from 'react-dom'
import App from './app'

// packages/react-dom/src/client/ReactDOMLegacy.js
// ReactDOM.render()第一个参数其实就是 ReactElement 返回的对象 {$$typeof ......}
ReactDOM.render(<App />, document.getElementById('app'))

// ReactDOM.unstable_createRoot(document.getElementById('app')).render(<App />)