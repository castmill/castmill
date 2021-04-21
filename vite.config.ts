import { defineConfig } from "vite";
const { resolve } = require("path");
import babel from "@rollup/plugin-babel";
import { nodeResolve } from "@rollup/plugin-node-resolve";
const arrowFunctions = require("@babel/plugin-transform-arrow-functions");

import legacy from "@vitejs/plugin-legacy";

const path = require("path");

import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,

    rollupOptions: {
      plugins: [
        nodeResolve(),
        /*
        babel({
          babelHelpers: "bundled",
          plugins: [arrowFunctions],
          presets: [
            [
              "@babel/preset-env",
              {
                corejs: 2,
                useBuiltIns: "usage",
                targets: {
                  chrome: "1",
                },
              },
            ],
          ],
        }),
        */
      ],
      input: {
        // demo: resolve(__dirname, "demos/index.html"),
        webos: resolve(__dirname, "demos/webos/index.html"),
      },
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      // external: ["vue", "gsap", "lodash", "rxjs"],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        /*
        globals: {
          vue: "Vue",
        },
        */
      },
    },
  },
  root: __dirname + "/demos",
  plugins: [
    vue(),
    legacy({
      targets: ["chrome 39"],
    }),
  ],
});
