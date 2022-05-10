import * as React from "react"

const UseEffect = () => {

  const [num, setNum] = React.useState(0)
  const [name, setName] = React.useState('name')
  React.useEffect(() => {
    console.log('useEffect 执行啦')
  })

  React.useEffect(() => {
    console.log('依赖项是: []')
  }, [])

  React.useEffect(() => {
    console.log('依赖的是 num')
  }, [num])


  React.useEffect(() => {
    console.log('依赖的是 name')
  }, [name])
  return (
    <div className="use-effect" >
      React useEffect
      <div onClick={() => setNum(num + 1)}>{num}</div>
      <div onClick={() => setName(name + 1)}>{name}</div>
    </div>
  )
}

export default UseEffect


