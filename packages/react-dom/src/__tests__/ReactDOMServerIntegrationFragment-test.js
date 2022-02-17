/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

const ReactDOMServerIntegrationUtils = require('./utils/ReactDOMServerIntegrationTestUtils');

let React;
let ReactDOM;
let ReactDOMServer;
let ReactTestUtils;

function initModules() {
  // Reset warning cache.
  jest.resetModuleRegistry();
  React = require('react');
  ReactDOM = require('react-dom');
  ReactDOMServer = require('react-dom/server');
  ReactTestUtils = require('react-dom/test-utils');

  // Make them available to the helpers.
  return {
    ReactDOM,
    ReactDOMServer,
    ReactTestUtils,
  };
}

const {resetModules, itRenders} = ReactDOMServerIntegrationUtils(initModules);

describe('ReactDOMServerIntegration', () => {
  beforeEach(() => {
    resetModules();
  });

  describe('React.Fragment', () => {
    itRenders('a fragment with one child', async render => {
      const e = await render(
        <>
          <div>text1</div>
        </>,
      );
      const parent = e.parentNode;
      expect(parent.childNodes[0].tagName).toBe('DIV');
    });

    itRenders('a fragment with several children', async render => {
      const Header = props => {
        return <p>header</p>;
      };
      const Footer = props => {
        return (
          <>
            <h2>footer</h2>
            <h3>about</h3>
          </>
        );
      };
      const e = await render(
        <>
          <div>text1</div>
          <span>text2</span>
          <Header />
          <Footer />
        </>,
      );
      const parent = e.parentNode;
      expect(parent.childNodes[0].tagName).toBe('DIV');
      expect(parent.childNodes[1].tagName).toBe('SPAN');
      expect(parent.childNodes[2].tagName).toBe('P');
      expect(parent.childNodes[3].tagName).toBe('H2');
      expect(parent.childNodes[4].tagName).toBe('H3');
    });

    itRenders('a nested fragment', async render => {
      const e = await render(
        <>
          <>
            <div>text1</div>
          </>
          <span>text2</span>
          <>
            <>
              <>
                {null}
                <p />
              </>
              {false}
            </>
          </>
        </>,
      );
      const parent = e.parentNode;
      expect(parent.childNodes[0].tagName).toBe('DIV');
      expect(parent.childNodes[1].tagName).toBe('SPAN');
      expect(parent.childNodes[2].tagName).toBe('P');
    });

    itRenders('an empty fragment', async render => {
      expect(await render(<React.Fragment />)).toBe(null);
    });
  });
});
