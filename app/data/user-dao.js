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
            usersCol.insert(doc, error => {
                if (error) return cb(error);
                return cb(null, doc);
            });
        }), cb);
    };

    this.getRandomFutureDate = () => {
        const today = new Date();
        const day = (Math.floor(Math.random() * 10) + today.getDay()) % 29;
        const month = (Math.floor(Math.random() * 10) + today.getMonth()) % 12;
        const year = Math.ceil(Math.random() * 30) + today.getFullYear();
        return `${year}-${("0" + month).slice(-2)}-${("0" + day).slice(-2)}`;
    };

    this.validateLogin = (userName, password, callback) => {
        const invalidCredentials = () => Object.assign(
            new Error("Invalid credentials"),
            { invalidPassword: true }
        );

        if (
            typeof userName !== "string" ||
            !/^[A-Za-z0-9_]{3,20}$/.test(userName) ||
            typeof password !== "string" ||
            password.length > 128
        ) {
            return callback(invalidCredentials());
        }

        usersCol.findOne({ userName }, (err, user) => {
            if (err) return callback(err);

            const dummy = "scrypt$32768$8$3$" +
                "0".repeat(32) + "$" + "0".repeat(128);

            verifyPassword(password, user ? user.password : dummy).then(
                valid => {
                    if (!valid || !user) {
                        return callback(invalidCredentials());
                    }
                    return callback(null, user);
                },
                err => callback(err)
            );
        });
    };


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
};
module.exports = { UserDAO };
