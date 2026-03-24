# Monitoring Project

A Node.js + Express + Electron based monitoring application with a backend server and local database.

The app allows managing devices and logging actions.

---

## Features

- Device management (add / edit / delete)
- Local SQLite database
- Web-based UI served by Express
- Backend API with Express with server-side logging
- Admin tools to open database and logs directly from the app
- Desktop wrapper using Electron

---

## Tech Stack

- **Backend / Web Server:** Node.js, Express
- **Frontend:** Server-served HTML/CSS/JS
- **Database:** SQLite
- **Desktop Wrapper:** Electron
- **Logging:** Sqlite + File-based logs

---

**Project Structure**

`monitoring_proj_server/`
 - `app.js`                     : Express web/server entry (starts API + site)
 - `main.js`                    : Electron main process (desktop wrapper)
 - `package.json`               : npm metadata and scripts
 - `readme.md`                  : Project documentation (this file)

 - `backend/`
	 - `api.js`                  : Express API routes
	 - `server_functions.js`     : Database helper logic

 - `public/`                    : Static web UI served by Express
	 - `blocked.html`            : Shown when access is denied
	 - `clients.html`            : Clients management page
	 - `devices.html`            : Devices management page (default index)
	 - `logs.html`               : Logs / auditing page
	 - `assets/`                 : Images, icons, fonts
	 - `javascript/`             : Client-side JS
		 - `clients.js`
		 - `devices.js`
		 - `functions.js`
		 - `logs.js`
	 - `stylesheets/`            : CSS files
		 - `input.css`, `menu.css`, `style.css`, `tables.css`

 - `resources/`
	 - `certificates/`         : TLS assets
		 - `server.cert`         : Server certificate used for HTTPS mode
	 - `database.db`             : (packaged) SQLite database — used in production/dev paths

 - `DB.Browser.for.SQLite-v3.13.1-win64/` : Bundled SQLite browser (optional)

**Key Files**
- `app.js` : Hosts the Express server, sets up middleware, routes (`/api`) and static site. Handles IP whitelist checks.
- `main.js`: Electron launcher. Loads `.env`, validates `PROTOCOL`/`PORT`, ensures port is free, starts `app.js`, and creates the tray/menu.
- `backend/api.js` / `backend/server_functions.js`: API endpoints and core server-side logic (DB access, logging, whitelist checks).
- `public/`: The front-end pages and JS used by the Electron window or a browser.

**Run (development)**
- Install deps:  

```powershell
npm install
```

- Start the app (dev):

```powershell
npm start
```

- The Electron app reads `.env` from project root in development; in packaged builds it reads from the resources path. Check `envPath` in `main.js` and `basePath` in `app.js`.

**Environment & .env file**

This project reads configuration from a `.env` file (in development it is loaded from the project root; packaged apps load from the `resources` path). Below are the variables the app uses, what to put there, and examples.

- **`PROTOCOL`**: Protocol used by the server.
	- Values: `HTTP` or `HTTPS`
	- Example: `PROTOCOL=HTTP`
	- Notes: When `HTTPS` the server expects TLS files under `resources/certificates/` and will start an HTTPS listener.

- **`HOST`**: IP or hostname used by the Electron UI and treated as a trusted host for whitelist checks.
	- Example (local dev): `HOST=192.168.100.200` or `HOST=192.168.100.201`
	- Example (LAN): `HOST=192.168.100.200`
	- Notes: `main.js` uses this to build the app URL (`PROTOCOL://HOST:PORT`) and `app.js` allows requests matching this value.

- **`PORT`**: TCP port the Express server listens on.
	- Example: `PORT=3001`
	- Notes: Choose an unused port. The Electron wrapper uses this port.

Sample `.env` (replace values for your environment):

```dotenv
PROTOCOL=HTTP
HOST=192.168.100.200
PORT=3001
```

**Security & packaging notes**
- If you use `HTTPS`, ensure `resources/certificates/server.key` and `server.cert` exist and match what's configured in `app.js`.

**Creating an HTTPS Certificate**

To enable HTTPS, you need a server certificate and private key. For development or testing, you can create a self-signed certificate using OpenSSL (install OpenSSL if not already available).

1. Open a terminal or command prompt.
2. Run the following command to generate a self-signed certificate valid for 36500 days (100 years):

```bash
openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.cert -days 36500 -nodes
```

3. When prompted, enter details like country, organization, etc. (you can leave most fields blank for self-signed).
4. Place the generated `server.key` and `server.cert` files in the `resources/certificates/` directory.

Note: Self-signed certificates will cause browser warnings; for production, obtain a certificate from a trusted CA.

**Notes & Tips**
- The default served page is `public/devices.html` (routes in `app.js`).
- To inspect the local SQLite DB during development, use the bundled DB Browser or open the `database.db` path via the app menu (the Electron menu has an `Open Database` action).