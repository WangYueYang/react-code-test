import * as React from 'react'
import * as ReactDOM from 'react-dom'

const App = () => {
  const [num, setNum] = React.useState(0);
  return (
    <div>
      app
      <p onClick={() => setNum(1)}>{num}</p>
    </div>
  )
}

// packages/react-dom/src/client/ReactDOMLegacy.js
// ReactDOM.render()第一个参数其实就是 ReactElement 返回的对象 {$$typeof ......}
ReactDOM.render(<App />, document.getElementById('app'))

// ReactDOM.unstable_createRoot(document.getElementById('app')).render(<App />)