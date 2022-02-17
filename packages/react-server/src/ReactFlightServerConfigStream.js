/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

// This file is an intermediate layer to translate between Flight
// calls to stream output over a binary stream.

/*
FLIGHT PROTOCOL GRAMMAR

Response
- JSONData RowSequence
- JSONData

RowSequence
- Row RowSequence
- Row

Row
- "J" RowID JSONData
- "H" RowID HTMLData
- "B" RowID BlobData
- "U" RowID URLData
- "E" RowID ErrorData

RowID
- HexDigits ":"

HexDigits
- HexDigit HexDigits
- HexDigit

HexDigit
- 0-F

URLData
- (UTF8 encoded URL) "\n"

ErrorData
- (UTF8 encoded JSON: {message: "...", stack: "..."}) "\n"

JSONData
- (UTF8 encoded JSON) "\n"
  - String values that begin with $ are escaped with a "$" prefix.
  - References to other rows are encoding as JSONReference strings.

JSONReference
- "$" HexDigits

HTMLData
- ByteSize (UTF8 encoded HTML)

BlobData
- ByteSize (Binary Data)

ByteSize
- (unsigned 32-bit integer)
*/

// TODO: Implement HTMLData, BlobData and URLData.

import type {Request, ReactModel} from 'react-server/src/ReactFlightServer';

import {convertStringToBuffer} from './ReactServerStreamConfig';

export type {Destination} from './ReactServerStreamConfig';

export type Chunk = Uint8Array;

const stringify = JSON.stringify;

function serializeRowHeader(tag: string, id: number) {
  return tag + id.toString(16) + ':';
}

export function processErrorChunk(
  request: Request,
  id: number,
  message: string,
  stack: string,
): Chunk {
  const errorInfo = {message, stack};
  const row = serializeRowHeader('E', id) + stringify(errorInfo) + '\n';
  return convertStringToBuffer(row);
}

export function processModelChunk(
  request: Request,
  id: number,
  model: ReactModel,
): Chunk {
  const json = stringify(model, request.toJSON);
  let row;
  if (id === 0) {
    row = json + '\n';
  } else {
    row = serializeRowHeader('J', id) + json + '\n';
  }
  return convertStringToBuffer(row);
}

export {
  scheduleWork,
  flushBuffered,
  beginWriting,
  writeChunk,
  completeWriting,
  close,
} from './ReactServerStreamConfig';
