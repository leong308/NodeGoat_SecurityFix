
"use strict";

const { randomUUID } = require("node:crypto");

// (09) Safe error handling to prevent internal information disclosure.
function errorHandler(err, req, res, next) {

    if (res.headersSent) {
        return next(err);
    }

    const requestId = req.requestId || randomUUID();

    const status =
        Number.isInteger(err.status) &&
        err.status >= 400 &&
        err.status <= 499
            ? err.status
            : 500;

    // Log only safe metadata, not sensitive exception details.
    console.error(JSON.stringify({
        event: "application_error",
        requestId,
        status
    }));

    // Never expose raw exception messages or stack traces.
    const message = status === 500
        ? "The request could not be completed. Please try again later."
        : "The request contains invalid data.";

    return res.status(status).render("error-template", {
        requestId,
        message
    });
}

module.exports = { errorHandler };
