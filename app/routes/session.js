const UserDAO = require("../data/user-dao").UserDAO;
const AllocationsDAO = require("../data/allocations-dao").AllocationsDAO;
const {
    environmentalScripts
} = require("../../config/config");

/* The SessionHandler must be constructed with a connected db */
function SessionHandler(db) {
    "use strict";

    const userDAO = new UserDAO(db);
    const allocationsDAO = new AllocationsDAO(db);

    const prepareUserData = (user, next) => {
        // Generate random allocations
        const stocks = Math.floor((Math.random() * 40) + 1);
        const funds = Math.floor((Math.random() * 40) + 1);
        const bonds = 100 - (stocks + funds);

        allocationsDAO.update(user._id, stocks, funds, bonds, (err) => {
            if (err) return next(err);
        });
    };

    this.isAdminUserMiddleware = (req, res, next) => {
        if (req.session.userId) {
            return userDAO.getUserById(req.session.userId, (err, user) => {
                return user && user.isAdmin ? next() : res.redirect("/login");
            });
        }
        console.log("redirecting to login");
        return res.redirect("/login");

    };

    this.isLoggedInMiddleware = (req, res, next) => {
        if (req.session.userId) {
            return next();
        }
        console.log("redirecting to login");
        return res.redirect("/login");
    };

    this.displayLoginPage = (req, res, next) => {
        return res.render("login", {
            userName: "",
            password: "",
            loginError: "",
            environmentalScripts
        });
    };

    this.handleLoginRequest = (req, res, next) => {
        const {
            userName,
            password
        } = req.body;
        userDAO.validateLogin(userName, password, (err, user) => {
            const errorMessage = "Invalid username and/or password";
            // (05) Regenerate the session after login, save the user ID,
            // and redirect the user to the appropriate page.
            function SessionHandler(db) {
                const users = new UserDAO(db), allocations = new AllocationsDAO(db);
                const authenticate = (req, res, next, user) => req.session.regenerate(e => {
                    if (e) return next(e); req.session.userId = user._id;
                    req.session.save(err => err ? next(err) : res.redirect(user.isAdmin ? "/benefits" : "/dashboard"));
                });
                if (err) {
                    if (err.noSuchUser) {
                        console.log("Error: attempt to login with invalid user: ", userName);

                        // Fix for A1 - 3 Log Injection - encode/sanitize input for CRLF Injection
                        // that could result in log forging:
                        // - Step 1: Require a module that supports encoding
                        // const ESAPI = require('node-esapi');
                        // - Step 2: Encode the user input that will be logged in the correct context
                        // following are a few examples:
                        // console.log('Error: attempt to login with invalid user: %s',
                        //     ESAPI.encoder().encodeForHTML(userName));
                        // console.log('Error: attempt to login with invalid user: %s',
                        //     ESAPI.encoder().encodeForJavaScript(userName));
                        // console.log('Error: attempt to login with invalid user: %s',
                        //     ESAPI.encoder().encodeForURL(userName));
                        // or if you know that this is a CRLF vulnerability you can target this specifically as follows:
                        // console.log('Error: attempt to login with invalid user: %s',
                        //     userName.replace(/(\r\n|\r|\n)/g, '_'));

                        return res.render("login", {
                            userName: userName,
                            password: "",
                            loginError: invalidUserNameErrorMessage,
                            //Fix for A2-2 Broken Auth - Uses identical error for both username, password error
                            // loginError: errorMessage
                            environmentalScripts
                        });
                    } else if (err.invalidPassword) {
                        return res.render("login", {
                            userName: userName,
                            password: "",
                            loginError: invalidPasswordErrorMessage,
                            //Fix for A2-2 Broken Auth - Uses identical error for both username, password error
                            // loginError: errorMessage
                            environmentalScripts
                        });
                    } else {
                        return next(err);
                    }
                }

                // A2-Broken Authentication and Session Management
                // Upon login, a security best practice with regards to cookies session management
                // would be to regenerate the session id so that if an id was already created for
                // a user on an insecure medium (i.e: non-HTTPS website or otherwise), or if an
                // attacker was able to get their hands on the cookie id before the user logged-in,
                // then the old session id will render useless as the logged-in user with new privileges
                // holds a new session id now.

                // Fix the problem by regenerating a session in each login
                // by wrapping the below code as a function callback for the method req.session.regenerate()
                // i.e:
                // `req.session.regenerate(() => {})`
                // (05) Validate login credentials and show a generic error for invalid login attempts.
                // Regenerate the session after successful authentication.
                this.handleLoginRequest = (req, res, next) => users.validateLogin(req.body.userName, req.body.password, (e, user) => {
                    if (e) {
                        if (e.invalidPassword || e.noSuchUser) return res.status(401).render("login", {
                            loginError: "Invalid username and/or password",
                            password: "", userName: typeof req.body.userName === "string" ? req.body.userName : ""
                        }); return next(e);
                    }
                    authenticate(req, res, next, user);
                });
            }
        });
    };

    // (05) Destroy the session on logout and clear the session cookie.
    // Check the user's session before displaying the dashboard.
    this.displayLogoutPage = (req, res, next) => req.session.destroy(e => {
        if (e) return next(e);
        res.clearCookie("retire.sid"); res.redirect("/login");
    });

    this.displaySignupPage = (req, res) => {
        res.render("signup", {
            userName: "",
            password: "",
            passwordError: "",
            email: "",
            userNameError: "",
            emailError: "",
            verifyError: "",
            environmentalScripts
        });
    };

    // (05) Validate signup details, check for duplicate usernames,
    // create the user account, and initialize the user's allocations.
    this.handleSignup = (req, res, next) => {
        const { userName, firstName, lastName, password, verify, email = "" } = req.body;
        const text = (v, min, max) => typeof v === "string" && v.length >= min && v.length <= max;
        if (!text(userName, 3, 20) || !/^[A-Za-z0-9_]+$/.test(userName) || !text(firstName, 1, 100) || !text(lastName, 1, 100)
            || !text(password, 15, 128) || password !== verify || !text(email, 0, 254) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
            return res.status(400).render("signup", { passwordError: "Use a 15–128 character passphrase, matching confirmation, and valid profile fields." });
        users.getUserByUserName(userName, (e, user) => {
            if (e) return next(e); if (user) return res.status(409).render("signup", { userNameError: "Registration could not be completed with that username." });
            users.addUser(userName, firstName, lastName, password, email, (error, doc) => {
                if (error) {
                    if (error.code === 11000) return res.status(409).render("signup", { userNameError: "Registration could not be completed with that username." });
                    return next(error);
                }
                allocations.update(doc._id, 30, 30, 40, err => err ? next(err) : authenticate(req, res, next, doc));
            });
        });
        /*
        //Fix for A2-2 - Broken Authentication -  requires stronger password
        //(at least 8 characters with numbers and both lowercase and uppercase letters.)
        const PASS_RE =/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
        */

        errors.userNameError = "";
        errors.firstNameError = "";
        errors.lastNameError = "";

        errors.passwordError = "";
        errors.verifyError = "";
        errors.emailError = "";

        if (!USER_RE.test(userName)) {
            errors.userNameError = "Invalid user name.";
            return false;
        }
        if (!FNAME_RE.test(firstName)) {
            errors.firstNameError = "Invalid first name.";
            return false;
        }
        if (!LNAME_RE.test(lastName)) {
            errors.lastNameError = "Invalid last name.";
            return false;
        }
        if (!PASS_RE.test(password)) {
            errors.passwordError = "Password must be 8 to 18 characters" +
                " including numbers, lowercase and uppercase letters.";
            return false;
        }
        if (password !== verify) {
            errors.verifyError = "Password must match";
            return false;
        }
        if (email !== "") {
            if (!EMAIL_RE.test(email)) {
                errors.emailError = "Invalid email address";
                return false;
            }
        }
        return true;
    };

    this.handleSignup = (req, res, next) => {

        const {
            email,
            userName,
            firstName,
            lastName,
            password,
            verify
        } = req.body;

        // set these up in case we have an error case
        const errors = {
            "userName": userName,
            "email": email
        };

        if (validateSignup(userName, firstName, lastName, password, verify, email, errors)) {

            userDAO.getUserByUserName(userName, (err, user) => {

                if (err) return next(err);

                if (user) {
                    errors.userNameError = "User name already in use. Please choose another";
                    return res.render("signup", {
                        ...errors,
                        environmentalScripts
                    });
                }

                userDAO.addUser(userName, firstName, lastName, password, email, (err, user) => {

                    if (err) return next(err);

                    //prepare data for the user
                    prepareUserData(user, next);
                    /*
                    sessionDAO.startSession(user._id, (err, sessionId) => {
                        if (err) return next(err);
                        res.cookie("session", sessionId);
                        req.session.userId = user._id;
                        return res.render("dashboard", { ...user, environmentalScripts });
                    });
                    */
                    req.session.regenerate(() => {
                        req.session.userId = user._id;
                        // Set userId property. Required for left nav menu links
                        user.userId = user._id;

                        return res.render("dashboard", {
                            ...user,
                            environmentalScripts
                        });
                    });

                });
            });
        } else {
            console.log("user did not validate");
            return res.render("signup", {
                ...errors,
                environmentalScripts
            });
        }
    };

    this.displayWelcomePage = (req, res, next) => {
        let userId;

        if (!req.session.userId) {
            console.log("welcome: Unable to identify user...redirecting to login");
            return res.redirect("/login");
        }

        userId = req.session.userId;

        userDAO.getUserById(userId, (err, doc) => {
            if (err) return next(err);
            doc.userId = userId;
            return res.render("dashboard", {
                ...doc,
                environmentalScripts
            });
        });
    };
}

module.exports = SessionHandler;
