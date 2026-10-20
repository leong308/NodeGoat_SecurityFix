// (04) Import the safeWebsite helper to validate website URLs before displaying them
const ProfileDAO = require("../data/profile-dao").ProfileDAO;
const { safeWebsite } = require("../lib/output");
const {
    environmentalScripts
} = require("../../config/config");

/* The ProfileHandler must be constructed with a connected db */
function ProfileHandler(db) {
    "use strict";

    const profile = new ProfileDAO(db);

    this.displayProfile = (req, res, next) => {
        const {
            userId
        } = req.session;



        profile.getByUserId(parseInt(userId), (err, doc) => {
            if (err) return next(err);
            doc.userId = userId;

            // @TODO @FIXME
            // while the developer intentions were correct in encoding the user supplied input so it
            // doesn't end up as an XSS attack, the context is incorrect as it is encoding the firstname for HTML
            // while this same variable is also used in the context of a URL link element
            // (04) Keep the first name available for display in the profile template
            doc.firstNameSafeString = doc.firstName;
            // (04) URL-encode the first name before adding it to the Google search URL
            // to prevent special characters from altering the URL query structure
            doc.profileSearchUrl = "https://www.google.com/search?q=" + encodeURIComponent(doc.firstName || "");
            // (04) Validate the website URL and allow only safe HTTPS links before rendering
            doc.website = safeWebsite(doc.website);
            // fix it by replacing the above with another template variable that is used for 
            // the context of a URL in a link header
            // doc.website = ESAPI.encoder().encodeForURL(doc.website)

            return res.render("profile", {
                ...doc,
                environmentalScripts
            });
        });
    };

    this.handleProfileUpdate = (req, res, next) => {

        const {
            firstName,
            lastName,
            ssn,
            dob,
            address,
            bankAcc,
            bankRouting,
            website
        } = req.body;

        // Fix for Section: ReDoS attack
        // The following regexPattern that is used to validate the bankRouting number is insecure and vulnerable to
        // catastrophic backtracking which means that specific type of input may cause it to consume all CPU resources
        // with an exponential time until it completes
        // --
        // The Fix: Instead of using greedy quantifiers the same regex will work if we omit the second quantifier +
        // const regexPattern = /([0-9]+)\#/;
        // const regexPattern = /([0-9]+)+\#/;
        // // Allow only numbers with a suffix of the letter #, for example: 'XXXXXX#'
        // const testComplyWithRequirements = regexPattern.test(bankRouting);
        // (09) Validate input types and lengths before evaluating regex.
        const limits = {firstName: 100, lastName: 100, ssn: 32, dob: 10, address: 300, bankAcc: 34, bankRouting: 20, website: 2048};
        const invalidFields = Object.entries(limits).some(
            ([key, max]) =>
                typeof req.body[key] !== "string" ||
                req.body[key].length > max
        );
        // (09) Use a bounded regex without nested quantifiers.
        // Never evaluate it against invalid or oversized input.
        const testComplyWithRequirements =
            !invalidFields &&
            /^[0-9]{1,18}#$/.test(bankRouting) &&
            (!dob || /^\d{4}-\d{2}-\d{2}$/.test(dob)) &&
            (!website || Boolean(safeWebsite(website)));
        // if the regex test fails we do not allow saving
        if (testComplyWithRequirements !== true) {
            // (09) Only pass bounded string values to the template.
            // Never render malformed objects or oversized input.
            const safeFormValue = (key) => {
                const value = req.body[key];

                return typeof value === "string" &&
                    value.length <= limits[key]
                    ? value
                    : "";
            };

            const safeFirstName = safeFormValue("firstName");
            const safeWebsiteValue = safeFormValue("website");

            return res.status(400).render("profile", {
                updateError: invalidFields
                    ? "One or more profile fields are invalid."
                    : "Bank Routing number does not comply with requirements for format specified",

                // (04) Preserve safe URL construction.
                profileSearchUrl:
                    "https://www.google.com/search?q=" +
                    encodeURIComponent(safeFirstName),

                firstNameSafeString: safeFirstName,
                lastName: safeFormValue("lastName"),
                ssn: safeFormValue("ssn"),
                dob: safeFormValue("dob"),
                address: safeFormValue("address"),
                bankAcc: safeFormValue("bankAcc"),
                bankRouting: safeFormValue("bankRouting"),

                website: safeWebsiteValue
                    ? (safeWebsite(safeWebsiteValue) || "")
                    : "",

                environmentalScripts
            });
        }


        const {
            userId
        } = req.session;

        profile.updateUser(
            parseInt(userId),
            firstName,
            lastName,
            ssn,
            dob,
            address,
            bankAcc,
            bankRouting,
            website,
            (err, user) => {

                if (err && err.status === 400) return res.status(400).send(err.message);
                if (err) return next(err);

                // WARN: Applying any sting specific methods here w/o checking type of inputs could lead to DoS by HPP
                //firstName = firstName.trim();
                // (04) Preserve the first name for display after the profile update
                user.firstNameSafeString = user.firstName;
                // (04) URL-encode the updated first name before constructing the Google search URL
                user.profileSearchUrl = "https://www.google.com/search?q=" + encodeURIComponent(user.firstName || "");
                user.website = safeWebsite(user.website);
                user.updateSuccess = true;
                user.userId = userId;

                return res.render("profile", {
                    ...user,
                    environmentalScripts
                });
            }
        );

    };

}

module.exports = ProfileHandler;
