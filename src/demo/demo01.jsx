import * as React from 'react'

const Demo01 = () => {

  const [num, setNum] = React.useState(22)
  const [text, setText] = React.useState('hello hook')
  const changeNum = () => {
    setNum(24)
  }
  return (
    <div onClick={changeNum}>
      <p>react function component</p>
      <span>Hook num: {num}</span>
      <span>Hook text: {text}</span>
    </div>
  )
}

export default Demo01