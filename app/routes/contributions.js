const ContributionsDAO = require("../data/contributions-dao").ContributionsDAO;
const {
    environmentalScripts
} = require("../../config/config");

/* The ContributionsHandler must be constructed with a connected db */
function ContributionsHandler(db) {
    "use strict";

    const contributionsDAO = new ContributionsDAO(db);

    this.displayContributions = (req, res, next) => {
        const {
            userId
        } = req.session;

        contributionsDAO.getByUserId(userId, (error, contrib) => {
            if (error) return next(error);

            contrib.userId = userId; //set for nav menu items
            return res.render("contributions", {
                ...contrib,
                environmentalScripts
            });
        });
    };

    this.handleContributionsUpdate = (req, res, next) => {
        // (02) eval implementation removed from the active code.
        /*jslint evil: true */
        // Insecure use of eval() to parse inputs
        // (02) Load a strict decimal validator, treats each field as numeric data
        const {decimal}=require("../lib/validation");
        // (02) Validate all three percentages independently in the range 0-30.
        // (02) "12.50" becomes 12.5
        const preTax=decimal(req.body.preTax,30);
        const afterTax=decimal(req.body.afterTax,30);
        const roth=decimal(req.body.roth,30);

        /*
        //Fix for A1 -1 SSJS Injection attacks - uses alternate method to eval
        const preTax = parseInt(req.body.preTax);
        const afterTax = parseInt(req.body.afterTax);
        const roth = parseInt(req.body.roth);
        */
        const {
            userId
        } = req.session;

        //validate contributions
        // (02) Check validator's explicit null rejection & range rejection result
        const validations = [preTax === null, afterTax === null, roth === null, preTax < 0, afterTax < 0, roth < 0];
        const isInvalid = validations.some(validation => validation);
        if (isInvalid) {
            // (02) Return the existing error page before calling DAO (database writer)
            // (02) Invalid input cannot execute code or update records
            return res.render("contributions", {
                updateError: "Invalid contribution percentages",
                userId,
                environmentalScripts
            });
        }
        // Prevent more than 30% contributions
        if (preTax + afterTax + roth > 30) {
            return res.render("contributions", {
                updateError: "Contribution percentages cannot exceed 30 %",
                userId,
                environmentalScripts
            });
        }

        // (02) Only validated numbers - sum passes the existing rule reach this database update
        contributionsDAO.update(userId, preTax, afterTax, roth, (err, contributions) => {

            if (err) return next(err);

            contributions.updateSuccess = true;
            return res.render("contributions", {
                ...contributions,
                environmentalScripts
            });
        });

    };

}

module.exports = ContributionsHandler;
