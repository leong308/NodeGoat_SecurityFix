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

    const authenticate = (req, res, next, user) => {
        req.session.regenerate(err => {
            if (err) return next(err);

            req.session.userId = user._id;

            req.session.save(error => {
                if (error) return next(error);
                return res.redirect(
                    user.isAdmin ? "/benefits" : "/dashboard"
                );
            });
        });
    };

    this.handleLoginRequest = (req, res, next) => {
        const { userName, password } = req.body;

        userDAO.validateLogin(userName, password, (err, user) => {
            if (err) {
                if (err.invalidPassword || err.noSuchUser) {
                    return res.status(401).render("login", {
                        loginError: "Invalid username and/or password",
                        userName: typeof userName === "string" ? userName : "",
                        password: "",
                        environmentalScripts
                    });
                }
                return next(err);
            }

            return authenticate(req, res, next, user);
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
        userDAO.getUserByUserName(userName, (e, user) => {
            if (e) return next(e); if (user) return res.status(409).render("signup", { userNameError: "Registration could not be completed with that username." });
            userDAO.addUser(userName, firstName, lastName, password, email, (error, doc) => {
                if (error) {
                    if (error.code === 11000) return res.status(409).render("signup", { userNameError: "Registration could not be completed with that username." });
                    return next(error);
                }
                allocationsDAO.update(doc._id, 30, 30, 40, err => err ? next(err) : authenticate(req, res, next, doc));
            });
        });
        /*
        //Fix for A2-2 - Broken Authentication -  requires stronger password
        //(at least 8 characters with numbers and both lowercase and uppercase letters.)
        const PASS_RE =/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
        */
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
