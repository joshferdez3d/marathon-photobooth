module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Disable code splitting for Electron
      if (env === 'production') {
        webpackConfig.optimization.splitChunks = {
          cacheGroups: {
            default: false,
          },
        };
        webpackConfig.optimization.runtimeChunk = false;
        
        // Output all JS into a single file
        webpackConfig.output = {
          ...webpackConfig.output,
          filename: 'static/js/[name].js',
          chunkFilename: 'static/js/[name].chunk.js',
        };
      }
      return webpackConfig;
    },
  },
};