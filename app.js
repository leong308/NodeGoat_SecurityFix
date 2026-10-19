// (01) Strict mode helps catch JavaScript mistakes
"use strict";
// (01) loads reusable codes
const path = require("node:path");
const express = require("express");
const session = require("express-session");
const nunjucks = require("nunjucks");
const { marked } = require("marked");
const routes = require("./app/routes");
const config = require("./config/config");
// (01) Build and return the application separately from starting HTTP listener
// (01) db is the connected database adapter; 
// (01) options lets the caller provide a session store
function createApp(db, options = {}) {
  const app = express();
  // (01) Suppress the default header that advertises Express
  app.disable("x-powered-by");
  // (01) Serve browser files from app/assets before session handling
  app.use(express.static(path.join(__dirname, "app/assets")));
  // (01) Convert JSON and form data into req.body and limit each body to 16 KB
  // (01) extended:false parses simple form fields; this is not input validation.
  app.use(express.json({ limit: "16kb" }));
  app.use(express.urlencoded({ extended: false, limit: "16kb" }));
  // (01) Install session handling using the configured signing secret
  // app.use(session({ secret: config.cookieSecret, saveUninitialized: true, resave: true, ...options.session }));
  // (04) Configure secure session cookies and session settings
  app.use(session({
    name: "retire.sid", secret: config.cookieSecret, saveUninitialized: false, resave: false,
    // (04) Protect the session cookie from JavaScript and cross-site requests
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 30 * 60 * 1000, secure: process.env.HTTPS_ONLY === "true" }, ...options.session
  }));
  // (08) CSRF Protection
  app.use(require("./app/lib/csrf"));
  // (04)Limit login and signup attempts to help prevent brute-force attacks
  const { rateLimit } = require("express-rate-limit");
  app.use(["/login", "/signup"], rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false,
    message: "Too many authentication attempts. Try again later."
  }));
  // (01) Replace Swig with Nunjucks to render the existing HTML templates
  // (04) Enable automatic escaping in Nunjucks to help prevent Cross-Site Scripting (XSS)
  // by escaping HTML special characters in template output
  nunjucks.configure(path.join(__dirname, "app/views"), { autoescape: true, express: app, noCache: true });
  app.set("view engine", "html");
  const sanitize = require("sanitize-html");
  // (01) Adapt to marked's current parse API and convert missing input to empty text
  // (04) Sanitize rendered Markdown HTML by allowing only specific safe HTML tags,
  // restricting link attributes, allowing only HTTP/HTTPS URLs, and blocking protocol-relative URLs.
  app.locals.marked = text => new nunjucks.runtime.SafeString(sanitize(marked.parse(String(text || "")), {
    allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "blockquote", "code", "pre", "a"],
    allowedAttributes: { a: ["href", "title"] }, allowedSchemes: ["https", "http"], allowProtocolRelative: false
  }));
  // (01) Register the existing URL handlers with new application and adapter
  routes(app, db);
  return app;
}
// (01) Export the builder so server.js and tests can call it
module.exports = { createApp };
