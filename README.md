# Blue Save (Nautikara) Backend

This is the backend API for Blue Save (Nautikara), an environmental platform for reporting, news, events, and donations. Built with Node.js, TypeScript, Express, Prisma, and MySQL.

## Features

- **User Authentication**: Register and log in with JWT tokens. Registration immediately returns access and refresh tokens; email verification is not required.
- **Reports**: Submit and view environmental reports with media uploads.
- **News**: Browse news articles by category.
- **Events**: View and register for environmental events.
- **Donations**: Dummy payments immediately succeed and record the donation. No real money is charged and no payment gateway is used.
- **Rate Limiting**: Prevent abuse on sensitive endpoints.
- **Scheduled Jobs**: Automatic report status updates.

The application does not require external service accounts, APIs, CDNs, or hosted storage. Authentication, dummy payments, uploads, and sample images run locally with your MySQL database. npm libraries remain dependencies installed during setup.

Prisma 6 is retained for compatibility. A scoped npm override upgrades its `deepmerge-ts` dependency to patched version 8; remove the override when Prisma's own dependency is patched. Prisma CLI configuration and the seed command are defined in `prisma.config.ts`.

## Tech Stack

- Node.js, Express, TypeScript
- MySQL, Prisma ORM
- Passport.js (JWT)
- Local disk storage (user-uploaded report media)
- Bundled local sample image at `/images/placeholder.svg`

## Getting Started

### Prerequisites

- Node.js 22 LTS (22.13+) or 24+, and npm
- MySQL 8.0+ database and an application user with access to it
- Redis running locally (default `127.0.0.1:6379`)

### Installation

1. **Open the project directory**

   ```sh
   cd /path/to/blue-save-be
   ```

2. **Install dependencies**

   ```sh
   npm install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env` and configure the MySQL connection and JWT secrets:

   ```
   DB_HOST=127.0.0.1
   DB_USER=blue_save
   DB_PASSWORD=your_password
   DB_NAME=blue_save
   DB_PORT=3306
   JWT_SECRET=your_jwt_secret
   JWT_REFRESH_SECRET=your_jwt_refresh_secret
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   REDIS_DB=0
   REDIS_PASSWORD=
   ```

4. **Create the database and run migrations**

   ```sh
   # Create an empty MySQL database (run as a database administrator):
   mysql -u root -p -e "CREATE DATABASE blue_save CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

   # Grant your application user access to blue_save, then run:
   npx prisma migrate deploy
   npx prisma generate
   ```

   The active migrations target a new, empty MySQL database. Previous PostgreSQL migrations are archived in `prisma/postgresql-migrations` and are not executed. Existing PostgreSQL records are not automatically transferred; keep that database and its backups if its data is needed.

   The local-media migration replaces absolute HTTP(S) and protocol-relative report, news, and event image links with the bundled placeholder. Back up existing data before applying it if you need to retain the original links. Local upload paths are preserved. Any data imported after migration must also use local media paths.

5. **Seed the database (optional)**

   ```sh
   npx ts-node prisma/seeders/reportSeeder.ts
   npx ts-node prisma/seeders/newsSeeder.ts
   npx ts-node prisma/seeders/eventSeeder.ts
   ```

6. **Start the development server**
   ```sh
   npm run dev
   ```

## API Endpoints

### Redis

`REDIS_DB` selects the Redis logical database (default `0`); it must exist in your Redis server configuration. Host, port, and optional password are also configurable through the environment. Restart the application after changing them.

Global, registration, login, refresh-token, and event-registration rate limits use Redis counters, shared across application instances and preserved across application restarts. Each limiter has its own key prefix. Redis is required for rate limiting: requests fail if the store is unavailable rather than bypassing abuse protection.

Successful GET news and event list/detail responses are cached for 60 seconds under `blue-save:v1:cache:*`. Pagination and IDs have separate keys. Event authentication and all input validation still run before cache lookup. Cache failures fall back to the database; errors and private user reports are not cached. News/event changes made by seeders or direct SQL can take up to 60 seconds to appear. Event registrations do not change the cached event fields.

Run the Redis integration check against your local server:

```sh
node -r ts-node/register tests/redis.cjs
```

All endpoints are prefixed with `/api/v1`.

- `GET /health` - Check API availability

- `POST /auth/register` - Register a new user and receive access and refresh tokens
- `POST /auth/login` - Login
- `POST /auth/refresh-token` - Refresh JWT token
- `POST /auth/logout` - Logout

- `POST /reports` - Create a report (requires authentication)
- `GET /reports/user-reports` - Get reports by user (requires authentication)

- `GET /news` - Get all news
- `GET /news/:id` - Get news by ID

- `GET /events` - Get all events (requires authentication)
- `GET /events/:eventId` - Get event by ID (requires authentication)
- `POST /events/register/:eventId` - Register for event (requires authentication)

- `POST /donation` - Record a successful dummy donation (requires authentication)

### Dummy donations

Send `POST /api/v1/donation` with a bearer access token and a JSON body:

```json
{ "amount": 10000 }
```

The amount must be positive, have at most two decimal places, and be between `0.01` and `99999999.99`. Phone numbers are not required and no additional fee is added.

Successful requests return HTTP 200 after saving the donation:

```json
{
  "message": "Donation successful",
  "transaction": {
    "id": "donation-id",
    "orderId": "ORDER-generated-uuid",
    "amount": 10000,
    "status": "success",
    "dummy": true
  }
}
```

There is no checkout token, redirect URL, or webhook. Clients should display success directly. Authentication, validation, and database errors still return errors.

---
