// (01) This file starts the server only; does not reset or seed the database.
"use strict";
// (01) Load MongoDB driver, persistent session store, app builder and compatibility adapter.
// (01) The adapter lets existing database code keep working.
const { MongoClient } = require("mongodb");
const MongoStore = require("connect-mongo");
const { createApp } = require("./app");
const legacyDatabase = require("./app/lib/mongo-compat");
const config = require("./config/config");
// (11) Load the TLS listener and validate its certificate before opening MongoDB.
const https = require("node:https");
const { loadTlsOptions } = require("./app/lib/transport");
// (01) async/await lets startup wait for a database connection before accepting requests.
async function main() {
  // (10) Refuse startup with a missing or invalid encryption key before opening the database.
  require("./app/lib/field-crypto").dataKey();
  const { options: tlsOptions, config: transport } = loadTlsOptions();
  const client = await MongoClient.connect(config.db);
  // (01) client.db() selects the database named in the connection URL
  // (01) ttl:1800 supplies a fallback session of 1,800 seconds (30 minutes).
  const app = createApp(legacyDatabase(client.db()), { session: { store: MongoStore.create({ mongoUrl: config.db, ttl: 1800 }) } });
  // (01) Listen on the container's interfaces. Compose still limits the published
  // (01) host endpoint to 127.0.0.1; the container bind address is a different layer.
  // (11) The old listener sent browser traffic without TLS.
  // const server = app.listen(config.port, "0.0.0.0", () => console.log("NodeGoat lab listening"));
  const server = https.createServer(tlsOptions, app).listen(transport.port, "0.0.0.0", () => console.log("NodeGoat HTTPS lab listening"));
  // (01) stop HTTP handling, close this MongoDB client and exit successfully. 
  // (01) basic cleanup, not a complete shutdown timeout strategy
  const stop = () => server.close(() => client.close().then(() => process.exit(0)));
  // (01) SIGTERM is sent by Docker; SIGINT is typically sent by Ctrl+C (exit).
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
}
// (01) Report startup failure without dumping the connection URL or secret config;
// (01) exit code 1 tells the caller that startup failed.
// (11) Add TLS to the safe startup guidance without printing keys or connection details.
// main().catch(() => { console.error("Startup failed: check database and environment configuration."); process.exit(1); });
main().catch(() => { console.error("Startup failed: check TLS certificates, DATA_KEY, database and environment configuration."); process.exit(1); });
