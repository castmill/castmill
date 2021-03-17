import { defineConfig } from "vite";
const { resolve } = require("path");

const path = require("path");

import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: "es2015",
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "castmill",
    },
    rollupOptions: {
      input: {
        demo: resolve(__dirname, "demos/index.html"),
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
  plugins: [vue()],
});
