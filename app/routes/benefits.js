const {
    BenefitsDAO
} = require("../data/benefits-dao");
const {
    environmentalScripts
} = require("../../config/config");

function BenefitsHandler(db) {
    "use strict";

    const benefitsDAO = new BenefitsDAO(db);

    this.displayBenefits = (req, res, next) => {

        benefitsDAO.getAllNonAdminUsers((error, users) => {

            if (error) return next(error);

            return res.render("benefits", {
                users,
                user: {
                    isAdmin: true
                },
                environmentalScripts
            });
        });
    };

    this.updateBenefits = (req, res, next) => {
        const {
            userId,
            benefitStartDate
        } = req.body;

        // (07) Validate the user ID before database access.
        const validUserId =
            typeof userId === "string" &&
            /^[1-9]\d{0,8}$/.test(userId);

        // (07) Validate the date format.
        const validDateFormat =
            typeof benefitStartDate === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(benefitStartDate);

        // (07) Reject impossible calendar dates.
        const parsedDate = validDateFormat
            ? new Date(`${benefitStartDate}T00:00:00.000Z`)
            : null;

        const validDate =
            parsedDate !== null &&
            !Number.isNaN(parsedDate.getTime()) &&
            parsedDate.toISOString().slice(0, 10) === benefitStartDate;

        if (!validUserId || !validDate) {
            return res.status(400).send("Invalid benefit fields.");
        }

        benefitsDAO.updateBenefits(userId, benefitStartDate, (error) => {

            if (error) return next(error);

            benefitsDAO.getAllNonAdminUsers((error, users) => {
                if (error) return next(error);

                const data = {
                    users,
                    user: {
                        isAdmin: true
                    },
                    updateSuccess: true,
                    environmentalScripts
                };

                return res.render("benefits", data);
            });
        });
    };
}

module.exports = BenefitsHandler;
