const SessionHandler = require("./session");
const ProfileHandler = require("./profile");
const BenefitsHandler = require("./benefits");
const ContributionsHandler = require("./contributions");
const AllocationsHandler = require("./allocations");
const MemosHandler = require("./memos");
const ResearchHandler = require("./research");
const tutorialRouter = require("./tutorial");
const ErrorHandler = require("./error").errorHandler;

const index = (app, db) => {

    "use strict";

    const sessionHandler = new SessionHandler(db);
    const profileHandler = new ProfileHandler(db);
    const benefitsHandler = new BenefitsHandler(db);
    const contributionsHandler = new ContributionsHandler(db);
    const allocationsHandler = new AllocationsHandler(db);
    const memosHandler = new MemosHandler(db);
    const researchHandler = new ResearchHandler(db);

    // Middleware to check if a user is logged in
    const isLoggedIn = sessionHandler.isLoggedInMiddleware;

    //Middleware to check if user has admin rights
    const isAdmin = sessionHandler.isAdminUserMiddleware;

    // The main page of the app
    app.get("/", sessionHandler.displayWelcomePage);

    // Login form
    app.get("/login", sessionHandler.displayLoginPage);
    app.post("/login", sessionHandler.handleLoginRequest);

    // Signup form
    app.get("/signup", sessionHandler.displaySignupPage);
    app.post("/signup", sessionHandler.handleSignup);

    // Logout page
    // (08) Protect logout with POST and CSRF verification
    app.post("/logout", isLoggedIn, sessionHandler.displayLogoutPage);

    // The main page of the app
    app.get("/dashboard", isLoggedIn, sessionHandler.displayWelcomePage);

    // Profile page
    app.get("/profile", isLoggedIn, profileHandler.displayProfile);
    app.post("/profile", isLoggedIn, profileHandler.handleProfileUpdate);

    // Contributions Page
    app.get("/contributions", isLoggedIn, contributionsHandler.displayContributions);
    app.post("/contributions", isLoggedIn, contributionsHandler.handleContributionsUpdate);

    // Benefits Page
    app.get("/benefits", isLoggedIn, isAdmin, benefitsHandler.displayBenefits);
    app.post("/benefits", isLoggedIn, isAdmin, benefitsHandler.updateBenefits);
    /* Fix for A7 - checks user role to implement  Function Level Access Control
     app.get("/benefits", isLoggedIn, isAdmin, benefitsHandler.displayBenefits);
     app.post("/benefits", isLoggedIn, isAdmin, benefitsHandler.updateBenefits);
     */

    // Allocations Page
    app.get("/allocations/:userId", isLoggedIn, allocationsHandler.displayAllocations);

    // Memos Page
    app.get("/memos", isLoggedIn, memosHandler.displayMemos);
    app.post("/memos", isLoggedIn, memosHandler.addMemos);

    // Handle redirect for learning resources link
    
    // (13) Only allow redirects to explicitly approved learning resources.
    const allowedLearningUrls = new Set([
        "https://www.khanacademy.org/economics-finance-domain/core-finance/investment-vehicles-tutorial/ira-401ks/v/traditional-iras"
    ]);

    // (13) Validate the destination before redirecting.
    app.get("/learn", isLoggedIn, (req, res) => {
        const destination = req.query.url;

        // (13) Reject missing, malformed, or unapproved destinations.
        if (
            typeof destination !== "string" ||
            !allowedLearningUrls.has(destination)
        ) {
            return res.status(400).send("Invalid learning resource URL.");
        }

        // (13) Redirect only to the approved HTTPS destination.
        return res.redirect(302, destination);
    });


    // Research Page
    app.get("/research", isLoggedIn, researchHandler.displayResearch);

    // Mount tutorial router
    app.use("/tutorial", tutorialRouter);

    // Error handling middleware
    app.use(ErrorHandler);
    
    // (12) Security Analytics Dashboard - accessible only by administrators.
    app.get("/security-dashboard", isLoggedIn, isAdmin, (req, res, next) => {

        // (12) Retrieve audit events from MongoDB, newest first.
        db.collection("auditEvents")
            .find({})
            .sort({ at: -1 })
            .toArray((err, rows) => {

                if (err) return next(err);

                // (12) Count different HTTP response outcomes.
                const counts = {
                    success: 0,
                    denied: 0,
                    errors: 0
                };

                for (const row of rows) {
                    if (row.status >= 500) {
                        counts.errors++;
                    } else if (row.status >= 400) {
                        counts.denied++;
                    } else {
                        counts.success++;
                    }
                }

                // (12) Show the newest 100 audit events.
                return res.render("security-dashboard", {
                    user: { isAdmin: true },
                    counts,
                    events: rows.slice(0, 100),
                    total: rows.length
                });
            });
    });



};

module.exports = index;
