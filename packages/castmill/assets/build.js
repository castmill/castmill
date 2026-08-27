const esbuild = require('esbuild');
const { solidPlugin } = require('esbuild-plugin-solid');
const { ScssModulesPlugin } = require('esbuild-scss-modules-plugin');

const glob = require('glob');
const path = require('path');
const sass = require('sass');

const args = process.argv.slice(2);
const watch = args.includes('--watch');
const deploy = args.includes('--deploy');

// Custom plugin to inline CSS/SCSS
const inlineCSSPlugin = {
  name: 'inlineCSS',
  setup(build) {
    build.onLoad({ filter: /\.s?css$/ }, async (args) => {
      // Use sass to compile SCSS to CSS
      const result = sass.compile(args.path, { outputStyle: 'compressed' });

      // Return an esbuild object that injects the CSS into the head of the document
      return {
        contents: `
            const style = document.createElement('style');
            style.innerText = ${JSON.stringify(result.css)};
            document.head.appendChild(style);
          `,
        loader: 'js', // Treat the return content as JavaScript
      };
    });
  },
};

// Define the base options for esbuild
let baseOpts = {
  bundle: true,
  logLevel: 'debug',
  target: 'es2017',
  format: 'esm', // Use ES Module format
  external: ['/fonts/*', '/images/*'],
  // packages: 'external',
  platform: 'browser',
  loader: {
    '.js': 'jsx',
    '.ts': 'ts',
    '.tsx': 'tsx',
    '.scss': 'css',
  },
  plugins: [
    ScssModulesPlugin({
      inject: true,
      minify: true,
      cssCallback: (css) => console.log(css),
    }),
    inlineCSSPlugin,
    solidPlugin(),
  ],
  // TODO: It would be important to be able to mark SolidJS as external as it takes a lot of Kb per component otherwise
  external: [/*'solid-js', 'solid-js/web',  */ '@solidjs/router'], // Mark SolidJS and its modules as external
};

// Add minify option for deployment
if (deploy) {
  baseOpts.minify = true;
}

buildAddons();

const componentIcons = glob.sync(
  path.join(
    __dirname,
    '..',
    'lib',
    'castmill',
    'addons',
    '*',
    'components',
    'icon.tsx'
  )
);

componentIcons.forEach((entry) => {
  const componentDirName = path.basename(
    path.dirname(path.resolve(entry, '..'))
  );
  esbuild
    .build({
      ...baseOpts,
      entryPoints: [entry],
      outfile: path.join(
        __dirname,
        `../priv/static/assets/addons/${componentDirName}_icon.js`
      ),
    })
    .catch(() => process.exit(1));
});

async function buildAddons() {
  // Dynamically find and bundle each TSX file in addons/components
  const componentEntryPoints = glob.sync(
    path.join(
      __dirname,
      '..',
      'lib',
      'castmill',
      'addons',
      '*',
      'components',
      'index.tsx'
    )
  );

  componentEntryPoints.forEach(async (entry) => {
    const componentDirName = path.basename(
      path.dirname(path.resolve(entry, '..'))
    );

    const opts = {
      ...baseOpts,
      entryPoints: [entry],
      outfile: path.join(
        __dirname,
        `../priv/static/assets/addons/${componentDirName}.js`
      ),
    };

    if (watch) {
      const context = await esbuild.context(opts);
      await context.watch();
    } else {
      esbuild.build(opts).catch(() => process.exit(1));
    }
  });
}
