# (11) Create localhost TLS files without trusting a CA unless the switch is supplied.
param(
    [string]$CertificateDirectory = (Join-Path $PSScriptRoot "../certs"),
    [string]$OpenSslPath = "",
    [switch]$TrustCurrentUser
)
$ErrorActionPreference = "Stop"
if ($env:OS -ne "Windows_NT") { throw "This certificate setup script requires Windows PowerShell or PowerShell on Windows." }
if (-not $env:LOCALAPPDATA) { throw "LOCALAPPDATA is required to keep the CA private key outside the project." }

# (11) Find OpenSSL on PATH or use the copy supplied by Git for Windows.
if ($OpenSslPath) {
    $opensslCommand = Get-Command -Name $OpenSslPath -CommandType Application -ErrorAction Stop
} else {
    $opensslCommand = Get-Command openssl -CommandType Application -ErrorAction SilentlyContinue
    if (-not $opensslCommand) {
        $gitOpenSsl = Join-Path $env:ProgramFiles "Git/usr/bin/openssl.exe"
        if (-not (Test-Path -LiteralPath $gitOpenSsl -PathType Leaf)) { throw "OpenSSL was not found. Install Git for Windows or supply -OpenSslPath." }
        $opensslCommand = Get-Command -Name $gitOpenSsl -CommandType Application -ErrorAction Stop
    }
}
$script:OpenSslExecutable = $opensslCommand.Source

function Invoke-OpenSsl {
    param([string[]]$Arguments)
    # (11) Capture native diagnostics without printing file contents or private keys.
    $savedPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $result = & $script:OpenSslExecutable @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $savedPreference }
    if ($exitCode -ne 0) { throw "OpenSSL certificate validation or generation failed. Existing certificate files were kept." }
    return (($result | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine)
}

function Protect-PrivatePath {
    param([string]$Path)
    # (11) Limit private files to this user and Windows system administrators.
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
    # (11) Build an access-only ACL so private files do not need audit privileges.
    $isDirectory = Test-Path -LiteralPath $Path -PathType Container
    if ($isDirectory) { $acl = New-Object Security.AccessControl.DirectorySecurity }
    else { $acl = New-Object Security.AccessControl.FileSecurity }
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @($identity, (New-Object Security.Principal.SecurityIdentifier "S-1-5-18"), (New-Object Security.Principal.SecurityIdentifier "S-1-5-32-544"))) {
        if ($isDirectory) {
            $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, "FullControl", "ContainerInherit, ObjectInherit", "None", "Allow")
        } else {
            $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, "FullControl", "Allow")
        }
        $acl.AddAccessRule($rule)
    }
    # (11) Write only changed access rules.
    if ($PSVersionTable.PSEdition -eq "Core") {
        if ($isDirectory) { [IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]$Path, $acl) }
        else { [IO.FileSystemAclExtensions]::SetAccessControl([IO.FileInfo]$Path, $acl) }
    } else {
        if ($isDirectory) { [IO.Directory]::SetAccessControl($Path, $acl) }
        else { [IO.File]::SetAccessControl($Path, $acl) }
    }
}

function Get-CertificateInfo {
    param([string]$CertificatePath)
    $fingerprint = Invoke-OpenSsl -Arguments @("x509", "-in", $CertificatePath, "-noout", "-fingerprint", "-sha256")
    $dates = Invoke-OpenSsl -Arguments @("x509", "-in", $CertificatePath, "-noout", "-dates")
    $dateValues = @{}
    foreach ($line in ($dates -split "`r?`n")) {
        if ($line -match "^(notBefore|notAfter)=(.+)$") {
            $dateText = [regex]::Replace($Matches[2].Trim(), "\s+", " ")
            $dateValues[$Matches[1]] = [datetime]::ParseExact($dateText, "MMM d HH:mm:ss yyyy 'GMT'", [Globalization.CultureInfo]::InvariantCulture,
                ([Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal))
        }
    }
    if (-not $dateValues.ContainsKey("notBefore") -or -not $dateValues.ContainsKey("notAfter") -or
        [datetime]::UtcNow -lt $dateValues["notBefore"] -or [datetime]::UtcNow -ge $dateValues["notAfter"]) {
        throw "A local certificate is not currently valid. Renew it deliberately; existing files were kept."
    }
    return [pscustomobject]@{ Fingerprint = $fingerprint; Dates = $dates; NotAfter = $dateValues["notAfter"] }
}

function Confirm-CertificatePair {
    param([string]$CertificatePath, [string]$KeyPath, [bool]$IsCa)
    $info = Get-CertificateInfo -CertificatePath $CertificatePath
    $certificateKey = Invoke-OpenSsl -Arguments @("x509", "-in", $CertificatePath, "-noout", "-pubkey")
    $privatePublicKey = Invoke-OpenSsl -Arguments @("pkey", "-in", $KeyPath, "-passin", "pass:", "-pubout")
    if ($certificateKey.Trim() -ne $privatePublicKey.Trim()) { throw "A local certificate does not match its private key. Existing files were kept." }
    $description = Invoke-OpenSsl -Arguments @("x509", "-in", $CertificatePath, "-noout", "-text")
    if ($IsCa) {
        if ($description -notmatch "CA:TRUE") { throw "The existing local CA certificate is not a CA certificate." }
        Invoke-OpenSsl -Arguments @("verify", "-check_ss_sig", "-CAfile", $CertificatePath, $CertificatePath) | Out-Null
    } else {
        if ($description -notmatch "CA:FALSE" -or $description -notmatch "TLS Web Server Authentication") {
            throw "The existing localhost certificate must be a leaf certificate for server authentication."
        }
        # (11) Require SAN entries even if the common name happens to be localhost.
        $sans = Invoke-OpenSsl -Arguments @("x509", "-in", $CertificatePath, "-noout", "-ext", "subjectAltName")
        if ($sans -notmatch "(?:^|[\s,])DNS:localhost(?:,|\s|$)") { throw "The localhost certificate is missing its localhost DNS SAN." }
        Invoke-OpenSsl -Arguments @("x509", "-in", $CertificatePath, "-noout", "-checkip", "127.0.0.1") | Out-Null
        Invoke-OpenSsl -Arguments @("x509", "-in", $CertificatePath, "-noout", "-checkip", "::1") | Out-Null
        Invoke-OpenSsl -Arguments @("verify", "-purpose", "sslserver", "-verify_hostname", "localhost", "-CAfile", $script:CaCertificatePath, $CertificatePath) | Out-Null
    }
    return $info
}

function New-PrivateTemporaryDirectory {
    param([string]$Parent)
    $temporary = Join-Path $Parent (".fix11-" + [guid]::NewGuid().ToString("N"))
    [IO.Directory]::CreateDirectory($temporary) | Out-Null
    Protect-PrivatePath -Path $temporary
    return $temporary
}

function Remove-PrivateTemporaryDirectory {
    param([string]$Path, [string]$Parent)
    # (11) Remove only a temporary child directory created by this script.
    $resolved = [IO.Path]::GetFullPath($Path)
    $expectedParent = [IO.Path]::GetDirectoryName((Join-Path ([IO.Path]::GetFullPath($Parent)) ".marker"))
    if ([IO.Path]::GetDirectoryName($resolved) -ne $expectedParent -or [IO.Path]::GetFileName($resolved) -notmatch "^\.fix11-[a-f0-9]{32}$") {
        throw "Refusing certificate cleanup outside the expected temporary directory."
    }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}

$workspaceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$certificateDirectory = [IO.Path]::GetFullPath($CertificateDirectory)
$caDirectory = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "NodeGoat-Fix11-CA"))
$workspacePrefix = $workspaceDirectory.TrimEnd([char[]]"\/") + [IO.Path]::DirectorySeparatorChar
if ($caDirectory.Equals($workspaceDirectory, [StringComparison]::OrdinalIgnoreCase) -or
    $caDirectory.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "The CA private key must be outside the project directory."
}
[IO.Directory]::CreateDirectory($caDirectory) | Out-Null
Protect-PrivatePath -Path $caDirectory
[IO.Directory]::CreateDirectory($certificateDirectory) | Out-Null
$caKeyPath = Join-Path $caDirectory "localhost-ca.key"
$script:CaCertificatePath = Join-Path $caDirectory "localhost-ca.crt"
$leafKeyPath = Join-Path $certificateDirectory "localhost.key"
$leafCertificatePath = Join-Path $certificateDirectory "localhost.crt"
$publicCaPath = Join-Path $certificateDirectory "localhost-ca.crt"

$hasCaKey = Test-Path -LiteralPath $caKeyPath -PathType Leaf
$hasCaCertificate = Test-Path -LiteralPath $script:CaCertificatePath -PathType Leaf
if ($hasCaKey -ne $hasCaCertificate) { throw "The local CA setup is incomplete. Restore its matching files; nothing will be overwritten." }
if (-not $hasCaKey) {
    $caTemporary = New-PrivateTemporaryDirectory -Parent $caDirectory
    try {
        $temporaryKey = Join-Path $caTemporary "ca.key"
        $temporaryCertificate = Join-Path $caTemporary "ca.crt"
        Invoke-OpenSsl -Arguments @("req", "-x509", "-newkey", "rsa:3072", "-nodes", "-sha256", "-days", "1825",
            "-subj", "/CN=NodeGoat Fix11 Local Development CA", "-addext", "basicConstraints=critical,CA:TRUE,pathlen:0",
            "-addext", "keyUsage=critical,keyCertSign,cRLSign", "-addext", "subjectKeyIdentifier=hash",
            "-keyout", $temporaryKey, "-out", $temporaryCertificate) | Out-Null
        Confirm-CertificatePair -CertificatePath $temporaryCertificate -KeyPath $temporaryKey -IsCa $true | Out-Null
        # (11) File.Move fails if a destination already exists; it never replaces a key.
        [IO.File]::Move($temporaryKey, $caKeyPath)
        [IO.File]::Move($temporaryCertificate, $script:CaCertificatePath)
        Write-Output "Created the local CA certificate."
    } finally { Remove-PrivateTemporaryDirectory -Path $caTemporary -Parent $caDirectory }
}
$caInfo = Confirm-CertificatePair -CertificatePath $script:CaCertificatePath -KeyPath $caKeyPath -IsCa $true
Protect-PrivatePath -Path $caKeyPath
if ($hasCaKey) { Write-Output "Reusing the existing local CA certificate after validation." }

# (11) Put only the public CA certificate in the project; never copy its private key.
if (Test-Path -LiteralPath $publicCaPath) {
    $publicInfo = Get-CertificateInfo -CertificatePath $publicCaPath
    if ($publicInfo.Fingerprint -ne $caInfo.Fingerprint) { throw "The public CA copy belongs to another CA. Existing files were kept." }
} else { [IO.File]::Copy($script:CaCertificatePath, $publicCaPath, $false) }

$hasLeafKey = Test-Path -LiteralPath $leafKeyPath -PathType Leaf
$hasLeafCertificate = Test-Path -LiteralPath $leafCertificatePath -PathType Leaf
if ($hasLeafKey -ne $hasLeafCertificate) { throw "The localhost certificate setup is incomplete. Restore its matching files; nothing will be overwritten." }
if (-not $hasLeafKey) {
    if ($caInfo.NotAfter -le [datetime]::UtcNow.AddDays(90)) { throw "The local CA expires too soon to issue a 90-day certificate. Renew the CA deliberately." }
    $leafTemporary = New-PrivateTemporaryDirectory -Parent $certificateDirectory
    try {
        $temporaryKey = Join-Path $leafTemporary "localhost.key"
        $temporaryRequest = Join-Path $leafTemporary "localhost.csr"
        $temporaryCertificate = Join-Path $leafTemporary "localhost.crt"
        $extensionsFile = Join-Path $leafTemporary "server.cnf"
        $extensions = @"
[server_cert]
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
"@
        [IO.File]::WriteAllText($extensionsFile, $extensions, (New-Object Text.UTF8Encoding $false))
        Invoke-OpenSsl -Arguments @("req", "-new", "-newkey", "rsa:2048", "-nodes", "-sha256", "-subj", "/CN=localhost",
            "-keyout", $temporaryKey, "-out", $temporaryRequest) | Out-Null
        $serialBytes = New-Object byte[] 16
        $random = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $random.GetBytes($serialBytes) } finally { $random.Dispose() }
        $serialBytes[0] = $serialBytes[0] -band 127
        $serial = "0x" + (($serialBytes | ForEach-Object { $_.ToString("x2") }) -join "")
        Invoke-OpenSsl -Arguments @("x509", "-req", "-in", $temporaryRequest, "-CA", $script:CaCertificatePath, "-CAkey", $caKeyPath,
            "-passin", "pass:", "-set_serial", $serial, "-days", "90", "-sha256", "-extfile", $extensionsFile,
            "-extensions", "server_cert", "-out", $temporaryCertificate) | Out-Null
        Confirm-CertificatePair -CertificatePath $temporaryCertificate -KeyPath $temporaryKey -IsCa $false | Out-Null
        [IO.File]::Move($temporaryKey, $leafKeyPath)
        [IO.File]::Move($temporaryCertificate, $leafCertificatePath)
        Write-Output "Created the 90-day localhost server certificate."
    } finally { Remove-PrivateTemporaryDirectory -Path $leafTemporary -Parent $certificateDirectory }
}
$leafInfo = Confirm-CertificatePair -CertificatePath $leafCertificatePath -KeyPath $leafKeyPath -IsCa $false
Protect-PrivatePath -Path $leafKeyPath
if ($hasLeafKey) { Write-Output "Reusing the existing localhost server certificate after validation." }

Write-Output "Local CA public certificate:"
Write-Output $caInfo.Fingerprint
Write-Output $caInfo.Dates
Write-Output "Localhost public certificate:"
Write-Output $leafInfo.Fingerprint
Write-Output $leafInfo.Dates

if ($TrustCurrentUser) {
    # (11) Trust only the public CA and only when this switch is explicitly requested.
    $trustTemporary = New-PrivateTemporaryDirectory -Parent $caDirectory
    try {
        $derFile = Join-Path $trustTemporary "public-ca.der"
        Invoke-OpenSsl -Arguments @("x509", "-in", $script:CaCertificatePath, "-outform", "DER", "-out", $derFile) | Out-Null
        $publicCertificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList $derFile
        $store = New-Object Security.Cryptography.X509Certificates.X509Store -ArgumentList "Root", "CurrentUser"
        try {
            $store.Open([Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
            $existing = $store.Certificates.Find([Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint, $publicCertificate.Thumbprint, $false)
            if ($existing.Count -eq 0) { $store.Add($publicCertificate) }
            Write-Output "The public local CA is trusted in this user's Root store."
        } finally { $store.Close(); $publicCertificate.Dispose() }
    } finally { Remove-PrivateTemporaryDirectory -Path $trustTemporary -Parent $caDirectory }
} else { Write-Output "No trust store was changed. Review the public CA fingerprint before using -TrustCurrentUser." }
