// (01) Replace obsolete bcrypt-nodejs with bcryptjs, a JavaScript bcrypt package
// (01) that avoids native compilation during installation. Changing this import
// (01) alone does not hash passwords: creation and login still use plaintext until
// (01) the authentication changes in Fix 05.
//const bcrypt = require("bcryptjs");
// (05) Import functions to hash passwords before saving and verify password hashes during login.
const { hashPassword, verifyPassword } = require("../lib/password");

/* The UserDAO must be constructed with a connected database object */
function UserDAO(db) {

    "use strict";

    /* If this constructor is called without the "new" operator, "this" points
     * to the global object. Log a warning and call it correctly. */
    if (false === (this instanceof UserDAO)) {
        console.log("Warning: UserDAO constructor called without 'new' operator");
        return new UserDAO(db);
    }

    const usersCol = db.collection("users");

    // (04) Hash the password before saving it, generate a new user ID, and store the user details in the database.
    this.addUser = (userName, firstName, lastName, password, email, cb) => {
        hashPassword(password).then(hash => this.getNextSequence("userId", (e, id) => {
            if (e) return cb(e);
            const doc = { _id: id, userName, firstName, lastName, password: hash, email, isAdmin: false, benefitStartDate: "2030-01-10" };
            users.insert(doc, (error) => error ? cb(error) : cb(null, doc));
        }), cb);
    };

    // Add email if set
    if (email) {
        user.email = email;
    }

    this.getNextSequence("userId", (err, id) => {
        if (err) {
            return callback(err, null);
        }
        console.log(typeof (id));

        user._id = id;
    });
};

this.getRandomFutureDate = () => {
    const today = new Date();
    const day = (Math.floor(Math.random() * 10) + today.getDay()) % 29;
    const month = (Math.floor(Math.random() * 10) + today.getMonth()) % 12;
    const year = Math.ceil(Math.random() * 30) + today.getFullYear();
    return `${year}-${("0" + month).slice(-2)}-${("0" + day).slice(-2)}`;
};

this.validateLogin = (userName, password, callback) => {

    // Helper function to compare passwords
    const comparePassword = (fromDB, fromUser) => {
        // (05) Validate the username and password, then verify the password hash 
        // and return the user only if the credentials are correct.
        this.validateLogin = (name, password, cb) => {
            if (typeof name !== "string" || !/^[A-Za-z0-9_]{3,20}$/.test(name) || typeof password !== "string" || password.length > 128)
                return cb(Object.assign(new Error("Invalid credentials"), { invalidPassword: true }));
            users.findOne({ userName: name }, (e, user) => {
                if (e) return cb(e);
                // Absent users still run the same scrypt work to reduce username timing disclosure.
                const dummy = "scrypt$32768$8$3$" + "0".repeat(32) + "$" + "0".repeat(128);
                verifyPassword(password, user ? user.password : dummy).then(ok => ok && user ? cb(null, user) : cb(Object.assign(new Error("Invalid credentials"),
                    { invalidPassword: true })), cb);
            });
        };
    }        /*
        // Fix for A2-Broken Auth
        // compares decrypted password stored in this.addUser()
        return bcrypt.compareSync(fromDB, fromUser);
        */
};

// Callback to pass to MongoDB that validates a user document
const validateUserDoc = (err, user) => {

    if (err) return callback(err, null);

    if (user) {
        if (comparePassword(password, user.password)) {
            callback(null, user);
        } else {
            const invalidPasswordError = new Error("Invalid password");
            // Set an extra field so we can distinguish this from a db error
            invalidPasswordError.invalidPassword = true;
            callback(invalidPasswordError, null);
        }
    } else {
        const noSuchUserError = new Error("User: " + user + " does not exist");
        // Set an extra field so we can distinguish this from a db error
        noSuchUserError.noSuchUser = true;
        callback(noSuchUserError, null);
    }
};

usersCol.findOne({
    userName: userName
}, validateUserDoc);


// This is the good one, see the next function
this.getUserById = (userId, callback) => {
    usersCol.findOne({
        _id: parseInt(userId)
    }, callback);
};

this.getUserByUserName = (userName, callback) => {
    usersCol.findOne({
        userName: userName
    }, callback);
};

this.getNextSequence = (name, callback) => {
    db.collection("counters").findAndModify({
        _id: name
    }, [], {
        $inc: {
            seq: 1
        }
    }, {
        new: true
    },
        (err, data) => err ? callback(err, null) : callback(null, data.value.seq));
};

module.exports = { UserDAO };
