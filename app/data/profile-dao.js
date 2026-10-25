/* The ProfileDAO must be constructed with a connected database object */
// (04) Use the same website URL policy before database writes.
const { safeWebsite } = require("../lib/output");
// (10) Use authenticated encryption for sensitive profile fields.
const { encrypt, decrypt, SENSITIVE_FIELDS } = require("../lib/field-crypto");

function ProfileDAO(db) {

    "use strict";

    /* If this constructor is called without the "new" operator, "this" points
     * to the global object. Log a warning and call it correctly. */
    if (false === (this instanceof ProfileDAO)) {
        console.log("Warning: ProfileDAO constructor called without 'new' operator");
        return new ProfileDAO(db);
    }

    const users = db.collection("users");

    // (10) Using a shared IV and missing authentication are unsafe.
    /* Fix for A6 - Sensitive Data Exposure

    // Use crypto module to save sensitive data such as ssn, dob in encrypted format
    const crypto = require("crypto");
    const config = require("../../config/config");

    /// Helper method create initialization vector
    // By default the initialization vector is not secure enough, so we create our own
    const createIV = () => {
        // create a random salt for the PBKDF2 function - 16 bytes is the minimum length according to NIST
        const salt = crypto.randomBytes(16);
        return crypto.pbkdf2Sync(config.cryptoKey, salt, 100000, 512, "sha512");
    };

    // Helper methods to encryt / decrypt
    const encrypt = (toEncrypt) => {
        config.iv = createIV();
        const cipher = crypto.createCipheriv(config.cryptoAlgo, config.cryptoKey, config.iv);
        return `${cipher.update(toEncrypt, "utf8", "hex")} ${cipher.final("hex")}`;
    };

    const decrypt = (toDecrypt) => {
        const decipher = crypto.createDecipheriv(config.cryptoAlgo, config.cryptoKey, config.iv);
        return `${decipher.update(toDecrypt, "hex", "utf8")} ${decipher.final("utf8")}`;
    };
    */

    this.updateUser = (userId, firstName, lastName, ssn, dob, address, bankAcc, bankRouting, website, callback) => {

        // Create user document
        const user = {};
        // (04) Save valid websites, allow clearing, and preserve omitted values.
        if (website !== undefined) {
            const validatedWebsite = safeWebsite(website);
            if (website !== "" && !validatedWebsite) return callback(Object.assign(new Error("Website must be a valid HTTPS URL."), { status: 400 }), null);
            user.website = validatedWebsite;
        }
        if (firstName) {
            user.firstName = firstName;
        }
        if (lastName) {
            user.lastName = lastName;
        }
        // (10) The old setters stored sensitive data as readable text.
        /*
        if (address) {
            user.address = address;
        }
        if (bankAcc) {
            user.bankAcc = bankAcc;
        }
        if (bankRouting) {
            user.bankRouting = bankRouting;
        }
        if (ssn) {
            user.ssn = ssn;
        }
        if (dob) {
            user.dob = dob;
        }
        */
        // (10) Keep readable form values separate from the encrypted database values.
        const display = { ...user };
        const submitted = { ssn, dob, address, bankAcc, bankRouting };
        const ownerId = parseInt(userId, 10);
        try {
            for (const field of SENSITIVE_FIELDS) {
                // (10) Preserve omitted fields; an empty string clears an old value.
                if (submitted[field] === undefined) continue;
                display[field] = submitted[field];
                user[field] = encrypt(submitted[field], ownerId, field);
            }
        } catch (error) {
            // (10) Stop the update if encryption or key validation fails.
            return callback(error, null);
        }
        /*
        // Fix for A7 - Sensitive Data Exposure
        // Store encrypted ssn and DOB
        if(ssn) {
            user.ssn = encrypt(ssn);
        }
        if(dob) {
            user.dob = encrypt(dob);
        }
        */

        users.update({
            _id: parseInt(userId)
        }, {
            $set: user
        },
            err => {
                if (!err) {
                    console.log("Updated user profile");
                    // (10) The old return would show ciphertext after the encrypted write.
                    // return callback(null, user);
                    return callback(null, display);
                }

                return callback(err, null);
            }
        );
    };

    this.getByUserId = (userId, callback) => {
        users.findOne({
            _id: parseInt(userId)
        },
            (err, user) => {
                if (err) return callback(err, null);
                /*
                // Fix for A6 - Sensitive Data Exposure
                // Decrypt ssn and DOB values to display to user
                user.ssn = user.ssn ? decrypt(user.ssn) : "";
                user.dob = user.dob ? decrypt(user.dob) : "";
                */

                if (!user) return callback(null, null);
                let display;
                try {
                    // (10) Send only profile fields to the view, excluding password hashes and roles.
                    display = {};
                    for (const field of ["_id", "userName", "firstName", "lastName", "website"]) {
                        if (user[field] !== undefined) display[field] = user[field];
                    }
                    for (const field of SENSITIVE_FIELDS) {
                        // (10) Decrypt a copy so the stored document remains encrypted.
                        display[field] = decrypt(user[field], user._id, field);
                    }
                } catch (error) {
                    // (10) Reject damaged ciphertext or unmigrated plaintext instead of displaying it.
                    return callback(error, null);
                }
                // (10) The old callback exposed the full stored user object.
                // callback(null, user);
                callback(null, display);
            }
        );
    };
}

module.exports = { ProfileDAO };
