import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'fs';

// Read package.json manually since direct import requires assertion in ESM
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default [
  // UMD build (for browsers)
  {
    input: 'src/index.js',
    output: {
      name: 'VisionCharts',
      file: 'dist/visioncharts.js',
      format: 'umd',
      sourcemap: true,
    },
    plugins: [
      resolve(),
      commonjs(),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**',
        presets: [
          ['@babel/preset-env', { targets: '> 0.25%, not dead' }]
        ]
      })
    ]
  },
  
  // Minified UMD build (for browsers)
  {
    input: 'src/index.js',
    output: {
      name: 'VisionCharts',
      file: 'dist/visioncharts.min.js',
      format: 'umd',
      sourcemap: true,
    },
    plugins: [
      resolve(),
      commonjs(),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**',
        presets: [
          ['@babel/preset-env', { targets: '> 0.25%, not dead' }]
        ]
      }),
      terser()
    ]
  },
  
  // ESM build (for bundlers)
  {
    input: 'src/index.js',
    output: {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      resolve(),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**',
        presets: [
          ['@babel/preset-env', { targets: { node: 14 } }]
        ]
      })
    ]
  }
];