'use strict';

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./cjs/react-noop-renderer-flight-client.production.min.js');
} else {
  module.exports = require('./cjs/react-noop-renderer-flight-client.development.js');
}
