/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {PriorityLevel} from './SchedulerPriorities';
import {enableProfiling} from './SchedulerFeatureFlags';

import {NoPriority} from './SchedulerPriorities';

let runIdCounter: number = 0;
let mainThreadIdCounter: number = 0;

const profilingStateSize = 4;
export const sharedProfilingBuffer = enableProfiling
  ? // $FlowFixMe Flow doesn't know about SharedArrayBuffer
    typeof SharedArrayBuffer === 'function'
    ? new SharedArrayBuffer(profilingStateSize * Int32Array.BYTES_PER_ELEMENT)
    : // $FlowFixMe Flow doesn't know about ArrayBuffer
    typeof ArrayBuffer === 'function'
    ? new ArrayBuffer(profilingStateSize * Int32Array.BYTES_PER_ELEMENT)
    : null // Don't crash the init path on IE9
  : null;

const profilingState =
  enableProfiling && sharedProfilingBuffer !== null
    ? new Int32Array(sharedProfilingBuffer)
    : []; // We can't read this but it helps save bytes for null checks

const PRIORITY = 0;
const CURRENT_TASK_ID = 1;
const CURRENT_RUN_ID = 2;
const QUEUE_SIZE = 3;

if (enableProfiling) {
  profilingState[PRIORITY] = NoPriority;
  // This is maintained with a counter, because the size of the priority queue
  // array might include canceled tasks.
  profilingState[QUEUE_SIZE] = 0;
  profilingState[CURRENT_TASK_ID] = 0;
}

// Bytes per element is 4
const INITIAL_EVENT_LOG_SIZE = 131072;
const MAX_EVENT_LOG_SIZE = 524288; // Equivalent to 2 megabytes

let eventLogSize = 0;
let eventLogBuffer = null;
let eventLog = null;
let eventLogIndex = 0;

const TaskStartEvent = 1;
const TaskCompleteEvent = 2;
const TaskErrorEvent = 3;
const TaskCancelEvent = 4;
const TaskRunEvent = 5;
const TaskYieldEvent = 6;
const SchedulerSuspendEvent = 7;
const SchedulerResumeEvent = 8;

function logEvent(entries) {
  if (eventLog !== null) {
    const offset = eventLogIndex;
    eventLogIndex += entries.length;
    if (eventLogIndex + 1 > eventLogSize) {
      eventLogSize *= 2;
      if (eventLogSize > MAX_EVENT_LOG_SIZE) {
        // Using console['error'] to evade Babel and ESLint
        console['error'](
          "Scheduler Profiling: Event log exceeded maximum size. Don't " +
            'forget to call `stopLoggingProfilingEvents()`.',
        );
        stopLoggingProfilingEvents();
        return;
      }
      const newEventLog = new Int32Array(eventLogSize * 4);
      newEventLog.set(eventLog);
      eventLogBuffer = newEventLog.buffer;
      eventLog = newEventLog;
    }
    eventLog.set(entries, offset);
  }
}

export function startLoggingProfilingEvents(): void {
  eventLogSize = INITIAL_EVENT_LOG_SIZE;
  eventLogBuffer = new ArrayBuffer(eventLogSize * 4);
  eventLog = new Int32Array(eventLogBuffer);
  eventLogIndex = 0;
}

export function stopLoggingProfilingEvents(): ArrayBuffer | null {
  const buffer = eventLogBuffer;
  eventLogSize = 0;
  eventLogBuffer = null;
  eventLog = null;
  eventLogIndex = 0;
  return buffer;
}

export function markTaskStart(
  task: {
    id: number,
    priorityLevel: PriorityLevel,
    ...
  },
  ms: number,
) {
  if (enableProfiling) {
    profilingState[QUEUE_SIZE]++;

    if (eventLog !== null) {
      // performance.now returns a float, representing milliseconds. When the
      // event is logged, it's coerced to an int. Convert to microseconds to
      // maintain extra degrees of precision.
      logEvent([TaskStartEvent, ms * 1000, task.id, task.priorityLevel]);
    }
  }
}

export function markTaskCompleted(
  task: {
    id: number,
    priorityLevel: PriorityLevel,
    ...
  },
  ms: number,
) {
  if (enableProfiling) {
    profilingState[PRIORITY] = NoPriority;
    profilingState[CURRENT_TASK_ID] = 0;
    profilingState[QUEUE_SIZE]--;

    if (eventLog !== null) {
      logEvent([TaskCompleteEvent, ms * 1000, task.id]);
    }
  }
}

export function markTaskCanceled(
  task: {
    id: number,
    priorityLevel: PriorityLevel,
    ...
  },
  ms: number,
) {
  if (enableProfiling) {
    profilingState[QUEUE_SIZE]--;

    if (eventLog !== null) {
      logEvent([TaskCancelEvent, ms * 1000, task.id]);
    }
  }
}

export function markTaskErrored(
  task: {
    id: number,
    priorityLevel: PriorityLevel,
    ...
  },
  ms: number,
) {
  if (enableProfiling) {
    profilingState[PRIORITY] = NoPriority;
    profilingState[CURRENT_TASK_ID] = 0;
    profilingState[QUEUE_SIZE]--;

    if (eventLog !== null) {
      logEvent([TaskErrorEvent, ms * 1000, task.id]);
    }
  }
}

export function markTaskRun(
  task: {
    id: number,
    priorityLevel: PriorityLevel,
    ...
  },
  ms: number,
) {
  if (enableProfiling) {
    runIdCounter++;

    profilingState[PRIORITY] = task.priorityLevel;
    profilingState[CURRENT_TASK_ID] = task.id;
    profilingState[CURRENT_RUN_ID] = runIdCounter;

    if (eventLog !== null) {
      logEvent([TaskRunEvent, ms * 1000, task.id, runIdCounter]);
    }
  }
}

export function markTaskYield(task: {id: number, ...}, ms: number) {
  if (enableProfiling) {
    profilingState[PRIORITY] = NoPriority;
    profilingState[CURRENT_TASK_ID] = 0;
    profilingState[CURRENT_RUN_ID] = 0;

    if (eventLog !== null) {
      logEvent([TaskYieldEvent, ms * 1000, task.id, runIdCounter]);
    }
  }
}

export function markSchedulerSuspended(ms: number) {
  if (enableProfiling) {
    mainThreadIdCounter++;

    if (eventLog !== null) {
      logEvent([SchedulerSuspendEvent, ms * 1000, mainThreadIdCounter]);
    }
  }
}

export function markSchedulerUnsuspended(ms: number) {
  if (enableProfiling) {
    if (eventLog !== null) {
      logEvent([SchedulerResumeEvent, ms * 1000, mainThreadIdCounter]);
    }
  }
}
