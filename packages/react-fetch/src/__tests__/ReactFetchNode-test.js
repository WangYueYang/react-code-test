/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

describe('ReactFetchNode', () => {
  let ReactCache;
  let ReactFetchNode;
  let http;
  let fetch;
  let server;
  let serverEndpoint;
  let serverImpl;

  beforeEach(done => {
    jest.resetModules();
    if (__EXPERIMENTAL__) {
      ReactCache = require('react/unstable-cache');
      // TODO: A way to pass load context.
      ReactCache.CacheProvider._context._currentValue = ReactCache.createCache();
      ReactFetchNode = require('react-fetch');
      fetch = ReactFetchNode.fetch;
    }
    http = require('http');

    server = http.createServer((req, res) => {
      serverImpl(req, res);
    });
    server.listen(done);
    serverEndpoint = `http://localhost:${server.address().port}/`;
  });

  afterEach(done => {
    server.close(done);
    server = null;
  });

  async function waitForSuspense(fn) {
    while (true) {
      try {
        return fn();
      } catch (promise) {
        if (typeof promise.then === 'function') {
          await promise;
        } else {
          throw promise;
        }
      }
    }
  }

  // @gate experimental
  it('can read text', async () => {
    serverImpl = (req, res) => {
      res.write('ok');
      res.end();
    };
    await waitForSuspense(() => {
      const response = fetch(serverEndpoint);
      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(response.ok).toBe(true);
      expect(response.text()).toEqual('ok');
      // Can read again:
      expect(response.text()).toEqual('ok');
    });
  });

  // @gate experimental
  it('can read json', async () => {
    serverImpl = (req, res) => {
      res.write(JSON.stringify({name: 'Sema'}));
      res.end();
    };
    await waitForSuspense(() => {
      const response = fetch(serverEndpoint);
      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(response.ok).toBe(true);
      expect(response.json()).toEqual({
        name: 'Sema',
      });
      // Can read again:
      expect(response.json()).toEqual({
        name: 'Sema',
      });
    });
  });
});
