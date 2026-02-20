/**
 * API configuration
 *
 * For LOCAL development this file is served as-is by nginx.
 * For PRODUCTION (Vercel), update PRODUCTION_API_URL to your Render backend URL
 * before deploying, e.g.:
 *   https://your-service-name.onrender.com/api
 */
(function () {
  var PRODUCTION_API_URL = 'https://filedrive-backend.onrender.com/api';
  var DEV_API_URL        = 'http://localhost:5000/api';

  var isLocal = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  window.API_URL = isLocal ? DEV_API_URL : PRODUCTION_API_URL;
})();
