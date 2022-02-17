/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Fiber} from './ReactInternalTypes';
import type {Container, SuspenseInstance} from './ReactFiberHostConfig';
import type {SuspenseState} from './ReactFiberSuspenseComponent.old';

import invariant from 'shared/invariant';

import {get as getInstance} from 'shared/ReactInstanceMap';
import ReactSharedInternals from 'shared/ReactSharedInternals';
import getComponentName from 'shared/getComponentName';
import {
  ClassComponent,
  HostComponent,
  HostRoot,
  HostPortal,
  HostText,
  FundamentalComponent,
  SuspenseComponent,
} from './ReactWorkTags';
import {NoFlags, Placement, Hydrating} from './ReactFiberFlags';
import {enableFundamentalAPI} from 'shared/ReactFeatureFlags';

const ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;

export function getNearestMountedFiber(fiber: Fiber): null | Fiber {
  let node = fiber;
  let nearestMounted = fiber;
  if (!fiber.alternate) {
    // If there is no alternate, this might be a new tree that isn't inserted
    // yet. If it is, then it will have a pending insertion effect on it.
    let nextNode = node;
    do {
      node = nextNode;
      if ((node.flags & (Placement | Hydrating)) !== NoFlags) {
        // This is an insertion or in-progress hydration. The nearest possible
        // mounted fiber is the parent but we need to continue to figure out
        // if that one is still mounted.
        nearestMounted = node.return;
      }
      nextNode = node.return;
    } while (nextNode);
  } else {
    while (node.return) {
      node = node.return;
    }
  }
  if (node.tag === HostRoot) {
    // TODO: Check if this was a nested HostRoot when used with
    // renderContainerIntoSubtree.
    return nearestMounted;
  }
  // If we didn't hit the root, that means that we're in an disconnected tree
  // that has been unmounted.
  return null;
}

export function getSuspenseInstanceFromFiber(
  fiber: Fiber,
): null | SuspenseInstance {
  if (fiber.tag === SuspenseComponent) {
    let suspenseState: SuspenseState | null = fiber.memoizedState;
    if (suspenseState === null) {
      const current = fiber.alternate;
      if (current !== null) {
        suspenseState = current.memoizedState;
      }
    }
    if (suspenseState !== null) {
      return suspenseState.dehydrated;
    }
  }
  return null;
}

export function getContainerFromFiber(fiber: Fiber): null | Container {
  return fiber.tag === HostRoot
    ? (fiber.stateNode.containerInfo: Container)
    : null;
}

export function isFiberMounted(fiber: Fiber): boolean {
  return getNearestMountedFiber(fiber) === fiber;
}

export function isMounted(component: React$Component<any, any>): boolean {
  if (__DEV__) {
    const owner = (ReactCurrentOwner.current: any);
    if (owner !== null && owner.tag === ClassComponent) {
      const ownerFiber: Fiber = owner;
      const instance = ownerFiber.stateNode;
      if (!instance._warnedAboutRefsInRender) {
        console.error(
          '%s is accessing isMounted inside its render() function. ' +
            'render() should be a pure function of props and state. It should ' +
            'never access something that requires stale data from the previous ' +
            'render, such as refs. Move this logic to componentDidMount and ' +
            'componentDidUpdate instead.',
          getComponentName(ownerFiber.type) || 'A component',
        );
      }
      instance._warnedAboutRefsInRender = true;
    }
  }

  const fiber: ?Fiber = getInstance(component);
  if (!fiber) {
    return false;
  }
  return getNearestMountedFiber(fiber) === fiber;
}

function assertIsMounted(fiber) {
  invariant(
    getNearestMountedFiber(fiber) === fiber,
    'Unable to find node on an unmounted component.',
  );
}

export function findCurrentFiberUsingSlowPath(fiber: Fiber): Fiber | null {
  const alternate = fiber.alternate;
  if (!alternate) {
    // If there is no alternate, then we only need to check if it is mounted.
    const nearestMounted = getNearestMountedFiber(fiber);
    invariant(
      nearestMounted !== null,
      'Unable to find node on an unmounted component.',
    );
    if (nearestMounted !== fiber) {
      return null;
    }
    return fiber;
  }
  // If we have two possible branches, we'll walk backwards up to the root
  // to see what path the root points to. On the way we may hit one of the
  // special cases and we'll deal with them.
  let a: Fiber = fiber;
  let b: Fiber = alternate;
  while (true) {
    const parentA = a.return;
    if (parentA === null) {
      // We're at the root.
      break;
    }
    const parentB = parentA.alternate;
    if (parentB === null) {
      // There is no alternate. This is an unusual case. Currently, it only
      // happens when a Suspense component is hidden. An extra fragment fiber
      // is inserted in between the Suspense fiber and its children. Skip
      // over this extra fragment fiber and proceed to the next parent.
      const nextParent = parentA.return;
      if (nextParent !== null) {
        a = b = nextParent;
        continue;
      }
      // If there's no parent, we're at the root.
      break;
    }

    // If both copies of the parent fiber point to the same child, we can
    // assume that the child is current. This happens when we bailout on low
    // priority: the bailed out fiber's child reuses the current child.
    if (parentA.child === parentB.child) {
      let child = parentA.child;
      while (child) {
        if (child === a) {
          // We've determined that A is the current branch.
          assertIsMounted(parentA);
          return fiber;
        }
        if (child === b) {
          // We've determined that B is the current branch.
          assertIsMounted(parentA);
          return alternate;
        }
        child = child.sibling;
      }
      // We should never have an alternate for any mounting node. So the only
      // way this could possibly happen is if this was unmounted, if at all.
      invariant(false, 'Unable to find node on an unmounted component.');
    }

    if (a.return !== b.return) {
      // The return pointer of A and the return pointer of B point to different
      // fibers. We assume that return pointers never criss-cross, so A must
      // belong to the child set of A.return, and B must belong to the child
      // set of B.return.
      a = parentA;
      b = parentB;
    } else {
      // The return pointers point to the same fiber. We'll have to use the
      // default, slow path: scan the child sets of each parent alternate to see
      // which child belongs to which set.
      //
      // Search parent A's child set
      let didFindChild = false;
      let child = parentA.child;
      while (child) {
        if (child === a) {
          didFindChild = true;
          a = parentA;
          b = parentB;
          break;
        }
        if (child === b) {
          didFindChild = true;
          b = parentA;
          a = parentB;
          break;
        }
        child = child.sibling;
      }
      if (!didFindChild) {
        // Search parent B's child set
        child = parentB.child;
        while (child) {
          if (child === a) {
            didFindChild = true;
            a = parentB;
            b = parentA;
            break;
          }
          if (child === b) {
            didFindChild = true;
            b = parentB;
            a = parentA;
            break;
          }
          child = child.sibling;
        }
        invariant(
          didFindChild,
          'Child was not found in either parent set. This indicates a bug ' +
            'in React related to the return pointer. Please file an issue.',
        );
      }
    }

    invariant(
      a.alternate === b,
      "Return fibers should always be each others' alternates. " +
        'This error is likely caused by a bug in React. Please file an issue.',
    );
  }
  // If the root is not a host container, we're in a disconnected tree. I.e.
  // unmounted.
  invariant(
    a.tag === HostRoot,
    'Unable to find node on an unmounted component.',
  );
  if (a.stateNode.current === a) {
    // We've determined that A is the current branch.
    return fiber;
  }
  // Otherwise B has to be current branch.
  return alternate;
}

export function findCurrentHostFiber(parent: Fiber): Fiber | null {
  const currentParent = findCurrentFiberUsingSlowPath(parent);
  if (!currentParent) {
    return null;
  }

  // Next we'll drill down this component to find the first HostComponent/Text.
  let node: Fiber = currentParent;
  while (true) {
    if (node.tag === HostComponent || node.tag === HostText) {
      return node;
    } else if (node.child) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === currentParent) {
      return null;
    }
    while (!node.sibling) {
      if (!node.return || node.return === currentParent) {
        return null;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
  // Flow needs the return null here, but ESLint complains about it.
  // eslint-disable-next-line no-unreachable
  return null;
}

export function findCurrentHostFiberWithNoPortals(parent: Fiber): Fiber | null {
  const currentParent = findCurrentFiberUsingSlowPath(parent);
  if (!currentParent) {
    return null;
  }

  // Next we'll drill down this component to find the first HostComponent/Text.
  let node: Fiber = currentParent;
  while (true) {
    if (
      node.tag === HostComponent ||
      node.tag === HostText ||
      (enableFundamentalAPI && node.tag === FundamentalComponent)
    ) {
      return node;
    } else if (node.child && node.tag !== HostPortal) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === currentParent) {
      return null;
    }
    while (!node.sibling) {
      if (!node.return || node.return === currentParent) {
        return null;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
  // Flow needs the return null here, but ESLint complains about it.
  // eslint-disable-next-line no-unreachable
  return null;
}

export function isFiberSuspenseAndTimedOut(fiber: Fiber): boolean {
  const memoizedState = fiber.memoizedState;
  return (
    fiber.tag === SuspenseComponent &&
    memoizedState !== null &&
    memoizedState.dehydrated === null
  );
}

export function doesFiberContain(
  parentFiber: Fiber,
  childFiber: Fiber,
): boolean {
  let node = childFiber;
  const parentFiberAlternate = parentFiber.alternate;
  while (node !== null) {
    if (node === parentFiber || node === parentFiberAlternate) {
      return true;
    }
    node = node.return;
  }
  return false;
}
