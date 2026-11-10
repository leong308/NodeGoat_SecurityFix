
"use strict";

const { randomUUID } = require("node:crypto");

// Record only approved request metadata and outcomes.
// Do not store passwords, cookies, request bodies or query strings.
function auditMiddleware(db) {
    return (req, res, next) => {

        //  Generate a unique identifier for each request.
        req.requestId = randomUUID();
        res.set("X-Request-ID", req.requestId);

        //  Record the outcome after the response finishes.
        res.on("finish", () => {
            const route = req.route && req.route.path;

            const event = {
                event: "http_request",
                at: new Date(),

                //  Record a valid session user ID or null.
                userId: Number.isSafeInteger(
                    req.session && req.session.userId
                ) ? req.session.userId : null,

                method: req.method,
                route: typeof route === "string"
                    ? route : "unmatched",
                status: res.statusCode,
                requestId: req.requestId
            };

            // Save the event in the MongoDB auditEvents collection.
            db.collection("auditEvents").insert(event, (err) => {
                if (err) {
                    console.error(JSON.stringify({
                        event: "audit_write_failed",
                        requestId: req.requestId
                    }));
                }
            });
        });

        next();
    };
}

module.exports = { auditMiddleware };
