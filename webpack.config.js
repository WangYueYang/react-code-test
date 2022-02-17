const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: './src/index.jsx',
  devtool: 'source-map',
  devServer: {
    port: 8088,
    hot: true,
    historyApiFallback: true,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-flow'],
          },
        },
      },
    ],
  },
  resolve: {
    alias: {
      react: path.resolve(__dirname, './packages/react'),
      shared: path.resolve(__dirname, './packages/shared'),
      scheduler: path.resolve(__dirname, './packages/scheduler'),
      'react-dom': path.resolve(__dirname, './packages/react-dom'),
      'react-reconciler': path.resolve(
        __dirname,
        './packages/react-reconciler'
      ),
    },
  },
  plugins:[
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src/index.html'),
    }),
    new webpack.DefinePlugin({
      __DEV__: true,
      __PROFILE__: true,
      __EXPERIMENTAL__: true
    })
  ]
};
