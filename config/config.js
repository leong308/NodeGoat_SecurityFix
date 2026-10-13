// (01) Strict mode makes accidental JavaScript mistakes throw an error
"use strict";
// (01) Replace old environment-file merge and full configuration logging
// (01) process.env reads values supplied by the environment
// (01) module does not load .env itself and not print secrets
module.exports = {
  // (01) Use the supplied port or 4000
  port: Number(process.env.PORT || 4000),
  // (01) Prefer configured MongoDB address
  db: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nodegoat",
  // (01) Read signing secret from the environment.
  cookieSecret: process.env.SESSION_SECRET || "LOCAL-LAB-ONLY-change-this-in-env-before-use",
  // (01) Keep the template setting available but provide no injected extra scripts.
  environmentalScripts: []
};
