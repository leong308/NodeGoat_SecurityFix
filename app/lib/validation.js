// (02) Use strict mode to catch accidental JavaScript mistakes
"use strict";

// (02) Validate a percentage as data, never as executable JavaScript 
// (02) value is text received, max is the largest permitted numeric value
function decimal(value, max = 100) {
    // (02) Require a primitive string, NOT (arrays, objects, numbers, missing)
    // (02) The regular expression describes an allowed decimal:
    // (02) \d{1,3} permits 1 to 3 digits
    // (02) (?:\.\d{1,2})? permits an optional decimal point and 1 or 2 digits.
    // (02) Reject expressions, signs, spaces, exponent notation
    // (02) Final newline also rejected
    if (typeof value !== "string" || !/^\d{1,3}(?:\.\d{1,2})?$/.test(value)) return null;

    // (02) Convert only the accepted decimal text with Number
    // (02) Number.isFinite excludes NaN and Infinity
    // (02) Numeric range enforced and null rejection
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= max ? number : null;
}

module.exports = {decimal};
