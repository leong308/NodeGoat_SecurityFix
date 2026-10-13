// (01) Move the login page's existing cookie check into a reusable browser file.
// (01) A cookie is a small browser value used by login sessions. This checks support
// (01) and displays a warning; it does not add session security or CSRF protection.
const areCookiesEnabled = () => {
    const cookieEnabled = navigator.cookieEnabled;

    // (01) If the browser reports cookies disabled, return false immediately.
    if (!cookieEnabled) return false;

    // (01) Preserve the baseline test-cookie branch.
    // (01) Moves this helper without correcting that inherited behaviour.
    if (!document.cookie && cookieEnabled === null) {
        document.cookie = "testcookie=1";

        // (01) Report cookies unavailable
        if (!document.cookie) return false;

        // (01) Remove the temporary test cookie by assigning an expiry
        document.cookie = "testcookie=; expires=" + new Date(0).toUTCString();

    }

    // (01) Otherwise report cookie support
    return true;
}

// (01) Wait for the page to load, then show the existing warning if needed
$(document).ready(() => {
    if (!areCookiesEnabled()) {
        $("#page-wrapper").prepend("<div class=\"row\"><div class=\"col-lg-12\"><div class=\"alert alert-danger\">Cookies are not enabled on your browser. Please enable cookies in your browser preferences to continue.</div></div></div>");
    }
});
