// next.config.js
module.exports = {
  turbopack: {
    root: __dirname,
  },
};

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
