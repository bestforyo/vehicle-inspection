import { defineConfig } from '@tarojs/cli';

export default defineConfig<'webpack5'>({
  projectName: 'jianjian-inspector',
  date: '2026-11-18',
  designWidth: 375,
  deviceRatio: { 640: 2.34, 750: 1.828, 375: 2, 828: 1.81 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: 'webpack5',
  cache: { enable: false },
  defineConstants: {
    API_BASE_URL: JSON.stringify(process.env.API_BASE_URL || 'http://localhost:3000'),
  },
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      cssModules: { enable: false, config: { namingPattern: 'module', generateScopedName: '[name]__[local]___[hash:base64:5]' } },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: { autoprefixer: { enable: true, config: {} }, cssModules: { enable: false, config: {} } },
  },
});
