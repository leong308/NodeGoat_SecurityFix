const UserDAO = require("./user-dao").UserDAO;

/* The AllocationsDAO must be constructed with a connected database object */
const AllocationsDAO = function(db){

    "use strict";

    /* If this constructor is called without the "new" operator, "this" points
     * to the global object. Log a warning and call it correctly. */
    if (false === (this instanceof AllocationsDAO)) {
        console.log("Warning: AllocationsDAO constructor called without 'new' operator");
        return new AllocationsDAO(db);
    }

    const allocationsCol = db.collection("allocations");
    const userDAO = new UserDAO(db);

    this.update = (userId, stocks, funds, bonds, callback) => {
        const parsedUserId = parseInt(userId);

        // Create allocations document
        const allocations = {
            userId: userId,
            stocks: stocks,
            funds: funds,
            bonds: bonds
        };

        allocationsCol.update({
            userId: parsedUserId
        }, allocations, {
            upsert: true
        }, err => {

            if (!err) {

                console.log("Updated allocations");

                userDAO.getUserById(userId, (err, user) => {

                    if (err) return callback(err, null);

                    // add user details
                    allocations.userId = userId;
                    allocations.userName = user.userName;
                    allocations.firstName = user.firstName;
                    allocations.lastName = user.lastName;

                    return callback(null, allocations);
                });
            }

            // (03) success branch supplies the result
            if (err) return callback(err, null);
        });
    };

    this.getByUserIdAndThreshold = (userId, threshold, callback) => {
        const parsedUserId = parseInt(userId);

        // (03) Reject identifiers outside positive safe-integer range
        if (!Number.isSafeInteger(parsedUserId) || parsedUserId < 1) return callback(new Error("Invalid user identifier"));
        // (03) Match numeric user ID through MongoDB's query
        const criteria={userId:parsedUserId};
        // (03) Missing or empty thresholds mean no stocks filter
        if (threshold !== undefined && threshold !== "") {
            // (03) Reuse (02)'s decimal policy, allocation thresholds allow 0 - 100
            const value=require("../lib/validation").decimal(threshold,100);
            // (03) Reject invalid input before sending query to MongoDB
            if(value===null) return callback(Object.assign(new Error("Invalid allocation threshold"),{status:400}));
            // (03) compares numeric data
            criteria.stocks={$gt:value};
        }
                /*
                // Fix for A1 - 2 NoSQL Injection - escape the threshold parameter properly
                // Fix this NoSQL Injection which doesn't sanitze the input parameter 'threshold' and allows attackers
                // to inject arbitrary javascript code into the NoSQL query:
                // 1. 0';while(true){}'
                // 2. 1'; return 1 == '1
                // Also implement fix in allocations.html for UX.                             
                const parsedThreshold = parseInt(threshold, 10);
                
                if (parsedThreshold >= 0 && parsedThreshold <= 99) {
                    return {$where: `this.userId == ${parsedUserId} && this.stocks > ${parsedThreshold}`};
                }
                throw `The user supplied threshold: ${parsedThreshold} was not valid.`;
                */
        // (03) The old active $where string was removed; no JavaScript query is built.

        allocationsCol.find(criteria).toArray((err, allocations) => {
            if (err) return callback(err, null);
            if (!allocations.length) return callback(null, []);

            let doneCounter = 0;
            const userAllocations = [];

            allocations.forEach( alloc => {
                userDAO.getUserById(alloc.userId, (err, user) => {
                    if (err) return callback(err, null);

                    alloc.userName = user.userName;
                    alloc.firstName = user.firstName;
                    alloc.lastName = user.lastName;

                    doneCounter += 1;
                    userAllocations.push(alloc);

                    if (doneCounter === allocations.length) {
                        callback(null, userAllocations);
                    }
                });
            });
        });
    };

};

module.exports.AllocationsDAO = AllocationsDAO;
