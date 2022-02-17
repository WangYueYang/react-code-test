/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

export type StringDecoder = void;

export const supportsBinaryStreams = false;

export function createStringDecoder(): void {
  throw new Error('Should never be called');
}

export function readPartialStringChunk(
  decoder: StringDecoder,
  buffer: Uint8Array,
): string {
  throw new Error('Should never be called');
}

export function readFinalStringChunk(
  decoder: StringDecoder,
  buffer: Uint8Array,
): string {
  throw new Error('Should never be called');
}
