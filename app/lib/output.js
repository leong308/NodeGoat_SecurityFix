"use strict";

// (04) Validate website URLs to allow only safe HTTPS links
function safeWebsite(value) {
    // (04) Reject non-string inputs and URLs longer than 2048 characters
    if (typeof value !== "string" || value.length > 2048) return "";

    try {
        // (04) Parse the input as a URL and validate its protocol and credentials
        const u = new URL(value);

        // (04) Allow only HTTPS URLs without embedded usernames or passwords
        // to reduce the risk of unsafe links and credential exposure
        return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
    } catch {
        // (04) Return an empty string if the input is not a valid URL
        return "";
    }
}

// (04) Export the validation function for reuse in other modules
module.exports = { safeWebsite };
