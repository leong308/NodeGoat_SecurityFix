// (01) Check JavaScript grammar without running the application or altering data.
// (01) Passing syntax checks does not prove application behaviour or security.
"use strict";
// (01) fs reads directories, path builds file paths, and child_process runs Node.
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
// (01) Recursively visit subfolders and collect their files into one flat list.
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(path.join(dir,d.name)):[path.join(dir,d.name)]);}
// (01) Collect .js files in app, scripts and tests plus the two entry points.
// (01) Run from the project root. config/config.js is not included in this list;
// (01) check that changed configuration file separately too.
const names=["app.js","server.js",...files("app"),...files("scripts"),...files("tests")].filter(n=>n.endsWith(".js"));
// (01) process.execPath selects the current Node executable. --check parses without
// (01) executing. Stop at the first syntax error; otherwise report the file count.
for(const name of names){const r=cp.spawnSync(process.execPath,["--check",name],{encoding:"utf8"});if(r.status){console.error(r.stderr);process.exit(1);}}
console.log(`Syntax checked ${names.length} JavaScript files.`);
