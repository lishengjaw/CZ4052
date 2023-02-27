const path = require("path");
const webpack = require("webpack");

module.exports = {
  mode: "development",
  entry: "./src/index.js",
  output: {
    filename: "main.js",
    path: path.resolve(__dirname, "dist"),
  },
  resolve: {
    fallback: {
      url: require.resolve("url/"),
      https: require.resolve("https-browserify"),
      http: require.resolve("stream-http"),
      path: require.resolve("path-browserify"),
      zlib: require.resolve("browserify-zlib"),
      assert: require.resolve("assert/"),
      buffer: require.resolve("buffer/"),
      stream: require.resolve("stream-browserify"),
      os: require.resolve("os-browserify/browser"),
      fs: false,
    },
  },
  devtool: "cheap-module-source-map",
  plugins: [
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
  ],
};
