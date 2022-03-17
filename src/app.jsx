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
  render() {
    return (
      <div className="app-root">
        <div>React Class Component</div>
        <p>
          <span>hahah</span>
        </p>
      </div>
    );
  }
}

export default App;
