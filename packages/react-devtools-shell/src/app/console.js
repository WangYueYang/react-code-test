/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

function ignoreStrings(
  methodName: string,
  stringsToIgnore: Array<string>,
): void {
  // HACKY In the test harness, DevTools overrides the parent window's console.
  // Our test app code uses the iframe's console though.
  // To simulate a more accurate end-to-end environment,
  // the shell's console patching should pass through to the parent override methods.
  const originalMethod = window.parent.console[methodName];

  console[methodName] = (...args) => {
    const maybeString = args[0];
    if (typeof maybeString === 'string') {
      for (let i = 0; i < stringsToIgnore.length; i++) {
        if (maybeString.startsWith(stringsToIgnore[i])) {
          return;
        }
      }
    }
    originalMethod(...args);
  };
}

export function ignoreErrors(errorsToIgnore: Array<string>): void {
  ignoreStrings('error', errorsToIgnore);
}

export function ignoreWarnings(warningsToIgnore: Array<string>): void {
  ignoreStrings('warn', warningsToIgnore);
}
