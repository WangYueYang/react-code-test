/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

let createSubscription;
let BehaviorSubject;
let React;
let ReactNoop;
let Scheduler;
let ReplaySubject;

describe('createSubscription', () => {
  beforeEach(() => {
    jest.resetModules();
    createSubscription = require('create-subscription').createSubscription;

    React = require('react');
    ReactNoop = require('react-noop-renderer');
    Scheduler = require('scheduler');

    BehaviorSubject = require('rxjs/BehaviorSubject').BehaviorSubject;
    ReplaySubject = require('rxjs/ReplaySubject').ReplaySubject;
  });

  function createBehaviorSubject(initialValue) {
    const behaviorSubject = new BehaviorSubject();
    if (initialValue) {
      behaviorSubject.next(initialValue);
    }
    return behaviorSubject;
  }

  function createReplaySubject(initialValue) {
    const replaySubject = new ReplaySubject();
    if (initialValue) {
      replaySubject.next(initialValue);
    }
    return replaySubject;
  }

  it('supports basic subscription pattern', () => {
    const Subscription = createSubscription({
      getCurrentValue: source => source.getValue(),
      subscribe: (source, callback) => {
        const subscription = source.subscribe(callback);
        return () => subscription.unsubscribe;
      },
    });

    const observable = createBehaviorSubject();
    ReactNoop.render(
      <Subscription source={observable}>
        {(value = 'default') => {
          Scheduler.unstable_yieldValue(value);
          return null;
        }}
      </Subscription>,
    );

    // Updates while subscribed should re-render the child component
    expect(Scheduler).toFlushAndYield(['default']);
    observable.next(123);
    expect(Scheduler).toFlushAndYield([123]);
    observable.next('abc');
    expect(Scheduler).toFlushAndYield(['abc']);

    // Unmounting the subscriber should remove listeners
    ReactNoop.render(<div />);
    observable.next(456);
    expect(Scheduler).toFlushAndYield([]);
  });

  it('should support observable types like RxJS ReplaySubject', () => {
    const Subscription = createSubscription({
      getCurrentValue: source => {
        let currentValue;
        source
          .subscribe(value => {
            currentValue = value;
          })
          .unsubscribe();
        return currentValue;
      },
      subscribe: (source, callback) => {
        const subscription = source.subscribe(callback);
        return () => subscription.unsubscribe;
      },
    });

    function render(value = 'default') {
      Scheduler.unstable_yieldValue(value);
      return null;
    }

    const observable = createReplaySubject('initial');

    ReactNoop.render(<Subscription source={observable}>{render}</Subscription>);
    expect(Scheduler).toFlushAndYield(['initial']);
    observable.next('updated');
    expect(Scheduler).toFlushAndYield(['updated']);

    // Unsetting the subscriber prop should reset subscribed values
    ReactNoop.render(<Subscription>{render}</Subscription>);
    expect(Scheduler).toFlushAndYield(['default']);
  });

  describe('Promises', () => {
    it('should support Promises', async () => {
      const Subscription = createSubscription({
        getCurrentValue: source => undefined,
        subscribe: (source, callback) => {
          source.then(
            value => callback(value),
            value => callback(value),
          );
          // (Can't unsubscribe from a Promise)
          return () => {};
        },
      });

      function render(hasLoaded) {
        if (hasLoaded === undefined) {
          Scheduler.unstable_yieldValue('loading');
        } else {
          Scheduler.unstable_yieldValue(hasLoaded ? 'finished' : 'failed');
        }
        return null;
      }

      let resolveA, rejectB;
      const promiseA = new Promise((resolve, reject) => {
        resolveA = resolve;
      });
      const promiseB = new Promise((resolve, reject) => {
        rejectB = reject;
      });

      // Test a promise that resolves after render
      ReactNoop.render(<Subscription source={promiseA}>{render}</Subscription>);
      expect(Scheduler).toFlushAndYield(['loading']);
      resolveA(true);
      await promiseA;
      expect(Scheduler).toFlushAndYield(['finished']);

      // Test a promise that resolves before render
      // Note that this will require an extra render anyway,
      // Because there is no way to synchronously get a Promise's value
      rejectB(false);
      ReactNoop.render(<Subscription source={promiseB}>{render}</Subscription>);
      expect(Scheduler).toFlushAndYield(['loading']);
      await promiseB.catch(() => true);
      expect(Scheduler).toFlushAndYield(['failed']);
    });

    it('should still work if unsubscription is managed incorrectly', async () => {
      const Subscription = createSubscription({
        getCurrentValue: source => undefined,
        subscribe: (source, callback) => {
          source.then(callback);
          // (Can't unsubscribe from a Promise)
          return () => {};
        },
      });

      function render(value = 'default') {
        Scheduler.unstable_yieldValue(value);
        return null;
      }

      let resolveA, resolveB;
      const promiseA = new Promise(resolve => (resolveA = resolve));
      const promiseB = new Promise(resolve => (resolveB = resolve));

      // Subscribe first to Promise A then Promise B
      ReactNoop.render(<Subscription source={promiseA}>{render}</Subscription>);
      expect(Scheduler).toFlushAndYield(['default']);
      ReactNoop.render(<Subscription source={promiseB}>{render}</Subscription>);
      expect(Scheduler).toFlushAndYield(['default']);

      // Resolve both Promises
      resolveB(123);
      resolveA('abc');
      await Promise.all([promiseA, promiseB]);

      // Ensure that only Promise B causes an update
      expect(Scheduler).toFlushAndYield([123]);
    });

    it('should not call setState for a Promise that resolves after unmount', async () => {
      const Subscription = createSubscription({
        getCurrentValue: source => undefined,
        subscribe: (source, callback) => {
          source.then(
            value => callback(value),
            value => callback(value),
          );
          // (Can't unsubscribe from a Promise)
          return () => {};
        },
      });

      function render(hasLoaded) {
        Scheduler.unstable_yieldValue('rendered');
        return null;
      }

      let resolvePromise;
      const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
      });

      ReactNoop.render(<Subscription source={promise}>{render}</Subscription>);
      expect(Scheduler).toFlushAndYield(['rendered']);

      // Unmount
      ReactNoop.render(null);
      expect(Scheduler).toFlushWithoutYielding();

      // Resolve Promise should not trigger a setState warning
      resolvePromise(true);
      await promise;
    });
  });

  it('should unsubscribe from old subscribables and subscribe to new subscribables when props change', () => {
    const Subscription = createSubscription({
      getCurrentValue: source => source.getValue(),
      subscribe: (source, callback) => {
        const subscription = source.subscribe(callback);
        return () => subscription.unsubscribe();
      },
    });

    function render(value = 'default') {
      Scheduler.unstable_yieldValue(value);
      return null;
    }

    const observableA = createBehaviorSubject('a-0');
    const observableB = createBehaviorSubject('b-0');

    ReactNoop.render(
      <Subscription source={observableA}>{render}</Subscription>,
    );

    // Updates while subscribed should re-render the child component
    expect(Scheduler).toFlushAndYield(['a-0']);

    // Unsetting the subscriber prop should reset subscribed values
    ReactNoop.render(
      <Subscription source={observableB}>{render}</Subscription>,
    );
    expect(Scheduler).toFlushAndYield(['b-0']);

    // Updates to the old subscribable should not re-render the child component
    observableA.next('a-1');
    expect(Scheduler).toFlushAndYield([]);

    // Updates to the bew subscribable should re-render the child component
    observableB.next('b-1');
    expect(Scheduler).toFlushAndYield(['b-1']);
  });

  it('should ignore values emitted by a new subscribable until the commit phase', () => {
    const log = [];

    function Child({value}) {
      Scheduler.unstable_yieldValue('Child: ' + value);
      return null;
    }

    const Subscription = createSubscription({
      getCurrentValue: source => source.getValue(),
      subscribe: (source, callback) => {
        const subscription = source.subscribe(callback);
        return () => subscription.unsubscribe();
      },
    });

    class Parent extends React.Component {
      state = {};

      static getDerivedStateFromProps(nextProps, prevState) {
        if (nextProps.observed !== prevState.observed) {
          return {
            observed: nextProps.observed,
          };
        }

        return null;
      }

      componentDidMount() {
        log.push('Parent.componentDidMount');
      }

      componentDidUpdate() {
        log.push('Parent.componentDidUpdate');
      }

      render() {
        return (
          <Subscription source={this.state.observed}>
            {(value = 'default') => {
              Scheduler.unstable_yieldValue('Subscriber: ' + value);
              return <Child value={value} />;
            }}
          </Subscription>
        );
      }
    }

    const observableA = createBehaviorSubject('a-0');
    const observableB = createBehaviorSubject('b-0');

    ReactNoop.render(<Parent observed={observableA} />);
    expect(Scheduler).toFlushAndYield(['Subscriber: a-0', 'Child: a-0']);
    expect(log).toEqual(['Parent.componentDidMount']);

    // Start React update, but don't finish
    ReactNoop.render(<Parent observed={observableB} />);
    expect(Scheduler).toFlushAndYieldThrough(['Subscriber: b-0']);
    expect(log).toEqual(['Parent.componentDidMount']);

    // Emit some updates from the uncommitted subscribable
    observableB.next('b-1');
    observableB.next('b-2');
    observableB.next('b-3');

    // Update again
    ReactNoop.render(<Parent observed={observableA} />);

    // Flush everything and ensure that the correct subscribable is used
    // We expect the last emitted update to be rendered (because of the commit phase value check)
    // But the intermediate ones should be ignored,
    // And the final rendered output should be the higher-priority observable.
    expect(Scheduler).toFlushAndYield([
      'Child: b-0',
      'Subscriber: b-3',
      'Child: b-3',
      'Subscriber: a-0',
      'Child: a-0',
    ]);
    expect(log).toEqual([
      'Parent.componentDidMount',
      'Parent.componentDidUpdate',
      'Parent.componentDidUpdate',
    ]);
  });

  it('should not drop values emitted between updates', () => {
    const log = [];

    function Child({value}) {
      Scheduler.unstable_yieldValue('Child: ' + value);
      return null;
    }

    const Subscription = createSubscription({
      getCurrentValue: source => source.getValue(),
      subscribe: (source, callback) => {
        const subscription = source.subscribe(callback);
        return () => subscription.unsubscribe();
      },
    });

    class Parent extends React.Component {
      state = {};

      static getDerivedStateFromProps(nextProps, prevState) {
        if (nextProps.observed !== prevState.observed) {
          return {
            observed: nextProps.observed,
          };
        }

        return null;
      }

      componentDidMount() {
        log.push('Parent.componentDidMount');
      }

      componentDidUpdate() {
        log.push('Parent.componentDidUpdate');
      }

      render() {
        return (
          <Subscription source={this.state.observed}>
            {(value = 'default') => {
              Scheduler.unstable_yieldValue('Subscriber: ' + value);
              return <Child value={value} />;
            }}
          </Subscription>
        );
      }
    }

    const observableA = createBehaviorSubject('a-0');
    const observableB = createBehaviorSubject('b-0');

    ReactNoop.render(<Parent observed={observableA} />);
    expect(Scheduler).toFlushAndYield(['Subscriber: a-0', 'Child: a-0']);
    expect(log).toEqual(['Parent.componentDidMount']);

    // Start React update, but don't finish
    ReactNoop.render(<Parent observed={observableB} />);
    expect(Scheduler).toFlushAndYieldThrough(['Subscriber: b-0']);
    expect(log).toEqual(['Parent.componentDidMount']);

    // Emit some updates from the old subscribable
    observableA.next('a-1');
    observableA.next('a-2');

    // Update again
    ReactNoop.render(<Parent observed={observableA} />);

    // Flush everything and ensure that the correct subscribable is used
    // We expect the new subscribable to finish rendering,
    // But then the updated values from the old subscribable should be used.
    expect(Scheduler).toFlushAndYield([
      'Child: b-0',
      'Subscriber: a-2',
      'Child: a-2',
    ]);
    expect(log).toEqual([
      'Parent.componentDidMount',
      'Parent.componentDidUpdate',
      'Parent.componentDidUpdate',
    ]);

    // Updates from the new subscribable should be ignored.
    observableB.next('b-1');
    expect(Scheduler).toFlushAndYield([]);
    expect(log).toEqual([
      'Parent.componentDidMount',
      'Parent.componentDidUpdate',
      'Parent.componentDidUpdate',
    ]);
  });

  describe('warnings', () => {
    it('should warn for invalid missing getCurrentValue', () => {
      expect(() => {
        createSubscription(
          {
            subscribe: () => () => {},
          },
          () => null,
        );
      }).toErrorDev('Subscription must specify a getCurrentValue function', {
        withoutStack: true,
      });
    });

    it('should warn for invalid missing subscribe', () => {
      expect(() => {
        createSubscription(
          {
            getCurrentValue: () => () => {},
          },
          () => null,
        );
      }).toErrorDev('Subscription must specify a subscribe function', {
        withoutStack: true,
      });
    });

    it('should warn if subscribe does not return an unsubscribe method', () => {
      const Subscription = createSubscription({
        getCurrentValue: source => undefined,
        subscribe: (source, callback) => {},
      });

      const observable = createBehaviorSubject();
      ReactNoop.render(
        <Subscription source={observable}>{value => null}</Subscription>,
      );

      expect(Scheduler).toFlushAndThrow(
        'A subscription must return an unsubscribe function.',
      );
    });
  });
});
