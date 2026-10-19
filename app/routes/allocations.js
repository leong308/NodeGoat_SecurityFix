const AllocationsDAO = require("../data/allocations-dao").AllocationsDAO;
const {
    environmentalScripts
} = require("../../config/config");

function AllocationsHandler(db) {
    "use strict";

    const allocationsDAO = new AllocationsDAO(db);

    this.displayAllocations = (req, res, next) => {
        /*
        // Fix for A4 Insecure DOR -  take user id from session instead of from URL param
        const { userId } = req.session;
        */
        const userId = req.session?.userId;

        if (userId === undefined || userId === null) {
            return res.status(401).send("Authentication required.");
        }

        if (String(userId) !== req.params.userId) {
            return res.status(403).send("Access denied.");
        }
        const {
            threshold
        } = req.query;

        allocationsDAO.getByUserIdAndThreshold(userId, threshold, (err, allocations) => {
            // (03) Return fixed message for invalid filters
            if (err && err.status === 400) return res.status(400).send("Invalid allocation threshold.");
            // (03) Retain existing handling for other errors / successful outcomes
            if (err) return next(err);
            return res.render("allocations", {
                userId,
                allocations,
                environmentalScripts
            });
        });
    };
}

module.exports = AllocationsHandler;
