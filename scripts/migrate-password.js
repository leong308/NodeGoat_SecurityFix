// (05) Migrate plaintext passwords to secure scrypt hashes,
// create a unique username index, and safely close the database connection.
"use strict";
const { MongoClient } = require("mongodb"), { db } = require("../config/config"), { hashPassword } = require("../app/lib/password");
(async () => {
    const client = await MongoClient.connect(db); try {
        const users = client.db().collection("users"); let count = 0;
        await users.createIndex({ userName: 1 }, { unique: true });
        for await (const user of users.find({})) {
            if (typeof user.password === "string" && !user.password.startsWith("scrypt$")) {
                if (user.password.startsWith("$2")) throw Error("Existing bcrypt hashes require a password reset; do not hash the hash.");
                await users.updateOne({ _id: user._id }, { $set: { password: await hashPassword(user.password) } }); count++;
            }
        } console.log(`Migrated ${count} plaintext lab passwords; reruns are safe.`);
    } finally { await client.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
