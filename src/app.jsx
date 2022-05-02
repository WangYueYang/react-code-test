import * as React from 'react';

// const App = () => {
//   const [count, setCount] = React.useState(0);
//   const addCount = () => {
//     setCount((state) => {
//       return ++state;
//     });
//   };
//   return (
//     <div className="app-root">
//       <div>App React</div>
//       <div className="clickMe" onClick={addCount}>
//         clickMe: {count}
//       </div>
//     </div>
//   );
// };



class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      num: 0,
    };
  }

  handleClick() {
    this.setState({
      num: 3
    })
  }

  render() {
    return (
      <div className="app-root" onClick={this.handleClick.bind(this)}>
        Number {this.state.num}
      </div>
    );
  }
}
export default App;
