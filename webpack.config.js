// webpack.config.js
const path = require("path");

module.exports = {
  mode: "production",
  optimization: {
    usedExports: true,
  },

  entry: {
    castmill: "./src/index.ts",
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: "ts-loader",
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "umd",
  },
};
