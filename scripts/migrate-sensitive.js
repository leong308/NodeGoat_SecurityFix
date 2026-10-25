"use strict";

// (10) Stop the web app and back up MongoDB before converting existing records.
const { encrypt, decrypt, dataKey, SENSITIVE_FIELDS } = require("../app/lib/field-crypto");

function validateFields(user) {
    for (const field of SENSITIVE_FIELDS) {
        const value = user[field];
        if (value === undefined || value === null || value === "") continue;
        if (typeof value !== "string") throw new Error("Invalid profile field type; migration stopped.");
        if (value.startsWith("gcm1:")) decrypt(value, user._id, field);
    }
}

async function migrateSensitive(users) {
    dataKey();

    // (10) Check every existing record before writing, including the key and tags.
    for await (const user of users.find({})) validateFields(user);

    let changedAccounts = 0;
    for await (const user of users.find({})) {
        validateFields(user);
        const changes = {};
        const original = { _id: user._id };
        for (const field of SENSITIVE_FIELDS) {
            const value = user[field];
            if (value === undefined || value === null || value === "" || value.startsWith("gcm1:")) continue;
            changes[field] = encrypt(value, user._id, field);
            original[field] = value;
        }
        if (Object.keys(changes).length) {
            // (10) Match the old values so a concurrent change is never overwritten.
            const result = await users.updateOne(original, { $set: changes });
            if (result.matchedCount !== 1) throw new Error("Profile changed during migration; stop the app and rerun.");
            changedAccounts++;
        }
    }
    return changedAccounts;
}

async function main() {
    dataKey();
    const { MongoClient } = require("mongodb");
    const { db } = require("../config/config");
    const client = await MongoClient.connect(db);
    try {
        const count = await migrateSensitive(client.db().collection("users"));
        // (10) Report counts only; never print profile values or encryption keys.
        console.log(`Encrypted sensitive fields for ${count} accounts; verified existing encrypted fields.`);
    } finally {
        await client.close();
    }
}

if (require.main === module) main().catch(() => {
    console.error("Sensitive-field migration failed. Check DATA_KEY, field integrity, and database availability; retain your backup.");
    process.exitCode = 1;
});

module.exports = { migrateSensitive };
