RetireEasy setup on Windows

Use PowerShell for the commands below. Run one command at a time and stop if it reports an error. Paste the .env creation block as one complete block. This guide follows the remediated project checked at b5feac1.

Install these first

Install [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) and [Git for Windows](https://git-scm.com/install/windows). Open Docker Desktop and wait for its engine to start. Use Linux containers with the WSL 2 backend.

If WSL is missing, run this once in PowerShell as administrator, then restart Windows:

```powershell
wsl --install
```

Open a normal PowerShell window after restarting. Check Docker:

```powershell
docker version
docker compose version
```

Continue when Docker shows both Client and Server information. You do not need to install Node.js or MongoDB separately on Windows.

Get the project

Open PowerShell where you want to keep the project:

```powershell
git clone https://github.com/leong308/NodeGoat_SecurityFix.git
Set-Location .\NodeGoat_SecurityFix
```

Already have the project? Open PowerShell in its folder instead. You should see compose.yaml there. To reproduce the report version in a fresh clone, optionally run `git checkout --detach b5feac1`.

Set these options once in this PowerShell window:

```powershell
$composeArgs = @('-p', 'retireeasy', '-f', 'compose.yaml')
```

Every later `@composeArgs` inserts these options. Keep the same project name. For an existing installation, use its original name instead of retireeasy, otherwise Docker selects a different database volume. Repeat this line whenever you open a new PowerShell window.

Create your local settings

For a fresh installation, paste this whole block. It creates .env with separate random values for the session secret, data key and three passwords. It stops if .env already exists.

```powershell
& {
  if (Test-Path -LiteralPath .env) {
    throw '.env already exists. Keep it instead of replacing it.'
  }
  function New-LabSecret {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace('-','').ToLower()
  }
  @(
    "SESSION_SECRET=$(New-LabSecret)"
    "DATA_KEY=$(New-LabSecret)"
    "ADMIN_PASSWORD=$(New-LabSecret)"
    "USER1_PASSWORD=$(New-LabSecret)"
    "USER2_PASSWORD=$(New-LabSecret)"
    'PUBLIC_ORIGIN=https://localhost:4000'
    'HTTPS_ONLY=true'
    'TLS_KEY_FILE=certs/localhost.key'
    'TLS_CERT_FILE=certs/localhost.crt'
  ) | Set-Content -LiteralPath .env -Encoding ascii
}
```

Keep .env private and save a protected recovery copy. DATA_KEY must stay the same for existing encrypted records. Do not push .env, private keys or database backups.

Prepare HTTPS before starting or seeding

```powershell
$tlsScript = '.\scripts\setup-tls.ps1'
powershell -NoProfile -ExecutionPolicy RemoteSigned -File $tlsScript
```

The helper uses OpenSSL, normally included with Git for Windows. Review the public certificate fingerprints it prints. To trust your own reviewed local CA for your Windows account, run this optional command:

```powershell
powershell -NoProfile -ExecutionPolicy RemoteSigned -File $tlsScript -TrustCurrentUser
```

Restart the browser afterwards. If your computer is managed, follow its administrator's certificate policy. Resolve certificate errors instead of bypassing them.

Start the database

```powershell
docker compose @composeArgs config --quiet
docker compose @composeArgs up -d mongo
docker compose @composeArgs ps -a
```

Wait until mongo shows healthy, then check the connection:

```powershell
$ping = 'JSON.stringify(db.adminCommand({ping:1}))'
docker compose @composeArgs exec -T mongo mongosh --quiet --eval $ping
```

You should see `{"ok":1}`.

Build, create the accounts and start RetireEasy

```powershell
docker compose @composeArgs build web
docker compose @composeArgs run --rm --no-deps web npm run seed
docker compose @composeArgs up -d web
docker compose @composeArgs ps -a
docker compose @composeArgs logs --tail 30 web
```

The seed should report `Seeded admin, user1, user2`. If it says users already exist, it preserves them. The web log should say `NodeGoat HTTPS lab listening`.

Open https://localhost:4000/login on the same computer. Read your passwords locally if needed:

```powershell
notepad .env
```

Use admin with the ADMIN_PASSWORD value, user1 with USER1_PASSWORD, or user2 with USER2_PASSWORD. Enter the value after `=`, not the variable name. Admin opens Benefits; employees open Dashboard. Use separate browser profiles when checking different roles.

Next time

Open Docker Desktop, return to this project folder and set $composeArgs again. Start the services:

```powershell
docker compose @composeArgs up -d
```

When finished:

```powershell
docker compose @composeArgs stop
```

After changing application code, rebuild:

```powershell
docker compose @composeArgs up -d --build web
```

After changing .env, recreate the web container:

```powershell
docker compose @composeArgs up -d --force-recreate web
```

Restart alone does not load new environment values. Editing .env also does not change passwords already stored in the database.

Run the project checks:

```powershell
docker compose @composeArgs exec -T web npm test
docker compose @composeArgs exec -T web npm run verify
```

At b5feac1, the recorded run passed four tests and syntax-checked 44 files. These checks do not cover every feature.

If something goes wrong

Cannot connect to Docker? Start Docker Desktop and wait. Missing compose.yaml or .env? Check your current folder and make sure the file is not named .env.txt.

Port 4000 or 27017 occupied? Check for another RetireEasy project or a local MongoDB service. Missing certs folder? Complete HTTPS setup first. An expired or mismatched certificate needs deliberate repair; rerunning the helper does not automatically renew it.

Login fails? Use the password originally seeded for that account. Reseeding does not reset existing passwords. If records look missing, check the original Compose project name.

The retained-database b5feac1 test returned HTTP 500 on /profile. If you encounter it, keep the support reference and inspect the web logs. Do not delete records or regenerate DATA_KEY to hide the error.

Existing data needs a planned upgrade. Keep the original keys and volume, stop web writers and back up outside the project folder first. Ask the maintainer which migration is needed; do not run migrations as a general error fix. Avoid down -v, volume pruning and the old database-reset script.

For an optional database view, install [MongoDB Compass](https://www.mongodb.com/products/tools/compass) and connect to `mongodb://127.0.0.1:27017/nodegoat` while mongo is running.
