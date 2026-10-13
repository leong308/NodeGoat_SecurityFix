// (01) Strict mode helps catch JavaScript mistakes
"use strict";
// (01) loads reusable codes
const path=require("node:path");
const express=require("express");
const session=require("express-session");
const nunjucks=require("nunjucks");
const {marked}=require("marked");
const routes=require("./app/routes");
const config=require("./config/config");
// (01) Build and return the application separately from starting HTTP listener
// (01) db is the connected database adapter; 
// (01) options lets the caller provide a session store
function createApp(db, options={}) {
  const app=express();
  // (01) Suppress the default header that advertises Express
  app.disable("x-powered-by");
  // (01) Serve browser files from app/assets before session handling
  app.use(express.static(path.join(__dirname,"app/assets")));
  // (01) Convert JSON and form data into req.body and limit each body to 16 KB
  // (01) extended:false parses simple form fields; this is not input validation.
  app.use(express.json({limit:"16kb"}));
  app.use(express.urlencoded({extended:false,limit:"16kb"}));
  // (01) Install session handling using the configured signing secret
  app.use(session({secret:config.cookieSecret,saveUninitialized:true,resave:true,...options.session}));
  // (01) Replace Swig with Nunjucks to render the existing HTML templates
  nunjucks.configure(path.join(__dirname,"app/views"),{autoescape:false,express:app,noCache:true});
  app.set("view engine","html");
  // (01) Adapt to marked's current parse API and convert missing input to empty text
  app.locals.marked=text=>marked.parse(String(text||""));
  // (01) Register the existing URL handlers with new application and adapter
  routes(app,db);
  return app;
}
// (01) Export the builder so server.js and tests can call it
module.exports={createApp};
