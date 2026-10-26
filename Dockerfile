# (01) Node.js used to run server's JavaScript.
# (01) Old Node 12 image replaced with Node 24 image
# (01) sha256 digest fixes the exact image contents
FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
# (01) Run build steps inside /app in container
WORKDIR /app
# (01) Copy package.json and package-lock.json
COPY package*.json ./
# (01) npm ci installs the exact dependency tree recorded in the lockfile
# (01) --omit=dev leaves development packages out
# (01) --ignore-scripts prevents dependency installation scripts from running.
RUN npm ci --omit=dev --ignore-scripts
# (01) Copy application files after installing packages, excludes local secrets
COPY . .
# (01) Keep baseline's non-root execution: server runs as node account, having fewer permission than root
USER node
# (11) This port now carries native HTTPS instead of plain HTTP.
# (01) HTTP port
# (01) compose.yaml controls PC access from this port setting
EXPOSE 4000
# (01) Start only the web server，database seeding is a separate
CMD ["node", "server.js"]
