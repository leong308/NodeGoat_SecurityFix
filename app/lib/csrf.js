"use strict";
const {randomBytes,timingSafeEqual}=require("node:crypto");
module.exports=function csrf(req,res,next) {
 if(!req.session.csrf)req.session.csrf=randomBytes(32).toString("hex");
 res.locals.csrftoken=req.session.csrf;
 if(["GET","HEAD","OPTIONS"].includes(req.method))return next();
 const supplied=req.body&&req.body._csrf;
 if(typeof supplied!=="string" || supplied.length!==64 || !/^[a-f0-9]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied,"hex"),Buffer.from(req.session.csrf,"hex")))return res.status(403).send("Form expired or invalid. Reload the page and try again.");
 return next();
};
