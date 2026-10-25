"use strict";

// (10) Use Node's authenticated encryption and keep the key outside the database.
const { randomBytes, createCipheriv, createDecipheriv } = require("node:crypto");
const SENSITIVE_FIELDS = Object.freeze(["ssn", "dob", "address", "bankAcc", "bankRouting"]);

function dataKey() {
    const value = process.env.DATA_KEY;
    if (typeof value !== "string" || value.length !== 64 || !/^[a-fA-F0-9]{64}$/.test(value)) {
        throw new Error("DATA_KEY must contain exactly 64 hexadecimal characters.");
    }
    return Buffer.from(value, "hex");
}

function context(userId, field) {
    const ownerId = Number(userId);
    const validOwnerType = typeof userId === "number" ||
        (typeof userId === "string" && userId.length > 0 && !/\D/.test(userId));
    if (!validOwnerType || !Number.isSafeInteger(ownerId) || ownerId < 1 || !SENSITIVE_FIELDS.includes(field)) {
        throw new Error("Invalid sensitive profile context.");
    }
    // (10) Bind each value to its owner and field so copied ciphertext is rejected.
    return Buffer.from(JSON.stringify(["nodegoat-profile-v1", String(ownerId), field]), "utf8");
}

function encrypt(value, userId, field) {
    const key = dataKey();
    const aad = context(userId, field);
    if (typeof value !== "string") throw new Error("Sensitive profile fields must be strings.");
    if (value === "") return "";

    // (10) Generate a new IV for every value; GCM also detects data changes.
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return ["gcm1", iv.toString("hex"), cipher.getAuthTag().toString("hex"), ciphertext.toString("hex")].join(":");
}

function decrypt(value, userId, field) {
    const key = dataKey();
    const aad = context(userId, field);
    if (value === undefined || value === null || value === "") return "";

    // (10) Reject plaintext and malformed values instead of showing unsafe data.
    const envelope = typeof value === "string" && value.match(/^gcm1:[a-f0-9]{24}:[a-f0-9]{32}:(?:[a-f0-9]{2})+$/);
    if (!envelope || envelope[0] !== value) {
        throw new Error("Sensitive profile data requires migration or repair.");
    }
    const [, iv, tag, ciphertext] = value.split(":");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"), { authTagLength: 16 });
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "hex")), decipher.final()]).toString("utf8");
}

module.exports = { encrypt, decrypt, dataKey, SENSITIVE_FIELDS };