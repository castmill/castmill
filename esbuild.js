import esbuild from "esbuild";
import { glsl } from "esbuild-plugin-glsl";

esbuild
  .build({
    entryPoints: ["src/index.ts"],
    outdir: "dist",
    bundle: true,
    sourcemap: true,
    minify: true,
    splitting: true,
    format: "esm",
    target: ["esnext"],
    plugins: [
      glsl({
        minify: true,
      }),
    ],
  })
  .catch(() => process.exit(1));
