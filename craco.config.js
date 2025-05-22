// CRACO configuration to polyfill Node.js core modules for Webpack 5
module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        buffer: require.resolve('buffer/'),
      };
      return webpackConfig;
    },
  },
};
