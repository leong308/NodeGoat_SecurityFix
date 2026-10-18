// (05) Use scrypt to hash passwords securely and verify them
// using a random salt and timing-safe comparison.
"use strict";
const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util"); const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
async function hashPassword(password) {
    const salt = randomBytes(16).toString("hex"), hash = await derive(password, salt, 64, options);
    return `scrypt$32768$8$3$${salt}$${hash.toString("hex")}`;
}
async function verifyPassword(password, stored) {
    if (typeof password !== "string" || password.length > 128 || typeof stored !== "string") return false;
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== "32768" || parts[2] !== "8" || parts[3] !== "3"
        || !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) return false;
    const result = await derive(password, parts[4], 64, options); return timingSafeEqual(result, Buffer.from(parts[5], "hex"));
}
module.exports = { hashPassword, verifyPassword };
