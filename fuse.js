const {
  FuseBox,
  WebIndexPlugin,
  QuantumPlugin,
  EnvPlugin,
  CopyPlugin,
  JSONPlugin,
  StyledComponentsPlugin,
} = require('fuse-box');

const { spawn } = require('child_process');

const production = process.env.NODE_ENV === 'dev' ? false : true;
var startURI = '';

// if(process.argv[0]) {
//   process.argv.forEach(i => { if(new URL(i).hostname) { startURI = i } });
// }

const getConfig = (target, name) => {
  return {
    homeDir: 'src/',
    cache: !production,
    target,
    output: `build/$name.js`,
    useTypescriptCompiler: true,
    plugins: [
      EnvPlugin({ NODE_ENV: production ? 'production' : 'development' }),
      production &&
        QuantumPlugin({
          bakeApiIntoBundle: name,
          treeshake: true,
          removeExportsInterop: false,
          uglify: {
            es6: true,
          },
        }),
    ],
    alias: {
      '~': '~/',
    },
    log: {
      showBundledFiles: false,
    },
  };
};

const getWebConfig = name => {
  return {
    homeDir: `src/`,
    cache: !production,
    target: 'browser@es6',
    output: `build/$name.js`,
    modulesFolder: [
      'node_modules/react',
      'node_modules/react-dom',
      'node_modules/react-style-tag',
      'node_modules/react-cookies',
      'node_modules/electron',
      'node_modules/fs',
    ],
    useSingleBundle: true,
    dependencies: { ignoreAllExternal: true },
    useTypescriptCompiler: true,
    sourceMaps: !production,
    plugins: [
      EnvPlugin({ NODE_ENV: production ? 'production' : 'development' }),
      production &&
        QuantumPlugin({
          bakeApiIntoBundle: name,
          treeshake: true,
          removeExportsInterop: false,
          uglify: {
            es6: true,
          },
        }),
    ],
    alias: {
      '~': '~/',
    },
    log: {
      showBundledFiles: true,
    },
  };
};

const getRendererConfig = (target, name) => {
  const cfg = Object.assign({}, getConfig(target, name), {
    sourceMaps: !production,
  });

  return cfg;
};

const getWebIndexPlugin = name => {
  return WebIndexPlugin({
    template: `static/pages/${name}.html`,
    path: production ? '.' : '/',
    target: `${name}.html`,
    bundles: [name],
  });
};

const getCopyPlugin = () => {
  return CopyPlugin({
    files: ['*.woff2', '*.png', '*.svg'],
    dest: 'assets',
    resolve: production ? './assets' : '/assets',
  });
};

const main = () => {
  const fuse = FuseBox.init(getConfig('server', 'main'));

  const app = fuse.bundle('main').instructions(`> [main/index.ts]`);

  if (!production) {
    app.watch();
  }

  fuse.run();
};

const renderer = (name, port) => {
  const cfg = getRendererConfig('electron');

  cfg.plugins.push(getWebIndexPlugin(name));

  cfg.plugins.push(JSONPlugin());
  cfg.plugins.push(getCopyPlugin());
  cfg.plugins.push(StyledComponentsPlugin());

  const fuse = FuseBox.init(cfg);

  const app = fuse
    .bundle(name)
    .instructions(
      `> [${
        name == 'app' ? '/renderer' : '/renderer/externals'
      }/${name}/index.tsx]`,
    );

  if (!production) {
    if (name === 'app') {
      fuse.dev({ httpServer: true }, server => {
        const app = server.httpServer.app;
        app.get('/undefined', function(req, res) {
          res.send('undefined');
        });
      });

      app.hmr().watch();

      fuse.run().then(() => {
        spawn('npm', ['start'], {
          shell: true,
          stdio: 'inherit',
        });
      });
    } else {
      app.watch();
      fuse.run();
    }
  } else {
    fuse.run();
  }
};

const preload = name => {
  const cfg = getRendererConfig('electron', name);

  const fuse = FuseBox.init(cfg);

  const app = fuse.bundle(name).instructions(`> [preloads/${name}.ts]`);

  if (!production) {
    app.watch();
  }

  fuse.run();
};

const web = name => {
  const cfg = getWebConfig(name);

  cfg.plugins.push(getWebIndexPlugin(name));
  cfg.plugins.push(JSONPlugin());
  cfg.plugins.push(getCopyPlugin());
  cfg.plugins.push(StyledComponentsPlugin());

  const fuse = FuseBox.init(cfg);

  const app = fuse
    .bundle(name)
    .instructions(`> renderer/externals/${name}/index.tsx`);

  app.hmr({ reload: true }).watch();
  fuse.run();
};

web('newtab');
web('settings');
web('search');
renderer('app', 4444);
preload('view-preload');
preload('background-preload');
main();
