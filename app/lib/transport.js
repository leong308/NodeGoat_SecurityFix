"use strict";

// (11) Read HTTPS settings without trusting request headers.
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const tls = require("node:tls");
const { X509Certificate } = require("node:crypto");
const projectRoot = path.resolve(__dirname, "../..");

function getTransportConfig(env = process.env) {
    // (11) Accept only a real TCP port written as decimal digits.
    const rawPort = env.PORT === undefined ? "4000" : env.PORT;
    if (typeof rawPort !== "string" || rawPort.length < 1 || rawPort.length > 5 || /[^0-9]/.test(rawPort)) {
        throw new Error("PORT must contain decimal digits from 1 to 65535.");
    }
    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("PORT must contain decimal digits from 1 to 65535.");
    }

    // (11) The configured origin may use a different published Docker port.
    const value = env.PUBLIC_ORIGIN === undefined ? "https://localhost:4000" : env.PUBLIC_ORIGIN;
    let origin;
    try {
        if (typeof value !== "string" || /[\s\\\u0000-\u001f\u007f]/.test(value)
            || !/^https:\/\/[^/?#]+\/?$/i.test(value)) throw new Error();
        origin = new URL(value);
        const authority = value.slice(value.indexOf("://") + 3).replace(/\/$/, "");
        if (origin.protocol !== "https:" || !origin.hostname || authority.includes("@") || authority.endsWith(":")
            || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error();
    } catch (_) {
        throw new Error("PUBLIC_ORIGIN must be an HTTPS origin without credentials, a path, query or fragment.");
    }
    // (11) A final DNS root dot keeps the same SAN hostname and local HSTS policy.
    const hostname = origin.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
    const local = hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "::1"
        || (net.isIP(hostname) === 4 && hostname.split(".")[0] === "127");
    return { port, publicOrigin: origin.origin, hostname, hsts: !local };
}

function loadTlsOptions(env = process.env) {
    const config = getTransportConfig(env);
    let key, cert;
    try {
        const keyFile = env.TLS_KEY_FILE === undefined ? "certs/localhost.key" : env.TLS_KEY_FILE;
        const certFile = env.TLS_CERT_FILE === undefined ? "certs/localhost.crt" : env.TLS_CERT_FILE;
        if (typeof keyFile !== "string" || !keyFile.trim() || typeof certFile !== "string" || !certFile.trim()) throw new Error();
        key = fs.readFileSync(path.resolve(projectRoot, keyFile));
        cert = fs.readFileSync(path.resolve(projectRoot, certFile));
    } catch (_) {
        throw new Error("TLS certificate or private key file is missing or unreadable.");
    }
    const options = { key, cert, minVersion: "TLSv1.2" };
    let leaf;
    try {
        // (11) Validate the PEM files and matching private key before connecting to MongoDB.
        tls.createSecureContext(options);
        leaf = new X509Certificate(cert);
    } catch (_) {
        throw new Error("TLS certificate and private key are invalid or do not match.");
    }
    if (leaf.ca) throw new Error("TLS server certificate must be a leaf certificate, not a CA certificate.");
    const starts = Date.parse(leaf.validFrom), ends = Date.parse(leaf.validTo), now = Date.now();
    if (!Number.isFinite(starts) || !Number.isFinite(ends) || now < starts || now >= ends) {
        throw new Error("TLS server certificate is not currently valid.");
    }
    let match;
    try {
        // (11) Match the origin against SAN entries; never fall back to the certificate common name.
        match = net.isIP(config.hostname) ? leaf.checkIP(config.hostname) : leaf.checkHost(config.hostname, { subject: "never" });
    } catch (_) {
        throw new Error("TLS server certificate must contain a matching Subject Alternative Name.");
    }
    if (!match) throw new Error("TLS server certificate must contain a matching Subject Alternative Name.");
    return { options, config };
}

module.exports = { getTransportConfig, loadTlsOptions };
