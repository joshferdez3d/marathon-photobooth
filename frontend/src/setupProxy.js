// src/setupProxy.js
module.exports = function(app) {
  app.use((req, res, next) => {
    if (req.headers.host.includes('ngrok')) {
      req.headers['x-forwarded-host'] = req.headers.host;
      req.headers.host = 'localhost:3000';
    }
    next();
  });
};