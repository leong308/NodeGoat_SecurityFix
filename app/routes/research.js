const {
    environmentalScripts
} = require("../../config/config");

function ResearchHandler(db) {
    "use strict";

    // (14) Only allow valid stock symbols.
    const stockSymbolPattern = /^[A-Za-z0-9.^=-]{1,20}$/;

    // (14) Approved research destination controlled by the server.
    const approvedResearchBase = "https://finance.yahoo.com/quote/";

    this.displayResearch = (req, res) => {

        // (14) Reject user-supplied research destination URLs.
        if (Object.prototype.hasOwnProperty.call(req.query, "url")) {
            return res.status(400).send("Invalid research destination.");
        }

        const symbol = req.query.symbol;

        // (14) Display the research form when no symbol is supplied.
        if (symbol === undefined) {
            return res.render("research", {
                environmentalScripts
            });
        }

        // (14) Reject malformed or unexpected stock symbols.
        if (
            typeof symbol !== "string" ||
            !stockSymbolPattern.test(symbol)
        ) {
            return res.status(400).send("Invalid stock symbol.");
        }

        // (14) Construct a trusted URL without accepting a user-controlled host.
        const normalizedSymbol = symbol.toUpperCase();
        const quoteUrl =
            approvedResearchBase + encodeURIComponent(normalizedSymbol);

        // (14) Return an approved research link instead of
        // making a server-side request or embedding external HTML.
        return res.render("research", {
            environmentalScripts,
            symbol: normalizedSymbol,
            quoteUrl
        });
    };
}

module.exports = ResearchHandler;
