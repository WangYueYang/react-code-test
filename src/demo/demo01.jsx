import * as React from 'react'

const Demo01 = () => {

  const [num, setNum] = React.useState(22)
  const [text, setText] = React.useState('hello hook')

  return (
    <div onClick={() => setNum(num + 1)}>
      <p>react function component</p>
      <span>Hook num: {num}</span>
      <span>Hook text: {text}</span>
    </div>
  )
}

export default Demo01