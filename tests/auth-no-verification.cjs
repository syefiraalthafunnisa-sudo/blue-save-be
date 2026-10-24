// Run: node -r ts-node/register tests/auth-no-verification.cjs
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

// This auth-only check does not need a live Redis server.
const redisConfig = require.resolve("../src/config/redis");
require.cache[redisConfig] = {
  id: redisConfig,
  filename: redisConfig,
  loaded: true,
  exports: { __esModule: true, default: { call: async () => "test-script-sha" } },
};

let user;
const tokens = [];
const repository = require.resolve("../src/repositories/authRepository");
require.cache[repository] = {
  id: repository,
  filename: repository,
  loaded: true,
  exports: {
    findUserByEmail: async () => user,
    createUser: async (data) => {
      assert.equal(data.otp, undefined);
      assert.equal(data.otpExpiresAt, undefined);
      user = { id: "test-user", verified: false, ...data };
      return user;
    },
    getUserRefreshTokens: async () => tokens,
    addRefreshToken: async (userId, token) => tokens.push({ userId, token }),
  },
};

async function main() {
  const { registerUser, loginUser } = require("../src/services/authService");
  const result = await registerUser("test@example.com", "Password1!", "Test");
  assert.equal(await bcrypt.compare("Password1!", user.password), true);
  assert.equal(jwt.verify(result.accessToken, process.env.JWT_SECRET).id, user.id);
  assert.equal(tokens[0].token, result.refreshToken);
  await loginUser(user.email, "Password1!");
  await assert.rejects(loginUser(user.email, "wrong"), { statusCode: 401 });
  await assert.rejects(registerUser(user.email, "Password1!", "Test"), { statusCode: 409 });

  const router = require("../src/routes/authRoutes").default;
  assert.deepEqual(router.stack.filter((layer) => layer.route).map((layer) => layer.route.path),
    ["/register", "/login", "/refresh-token", "/logout"]);

  const cron = require.resolve("node-cron");
  const jobs = [];
  require.cache[cron] = {
    id: cron,
    filename: cron,
    loaded: true,
    exports: { schedule: (schedule, callback) => jobs.push(callback) },
  };
  const database = require.resolve("../src/config/database");
  require.cache[database] = {
    id: database,
    filename: database,
    loaded: true,
    exports: {
      __esModule: true,
      default: {
        user: { deleteMany: () => assert.fail("Must not delete unverified users") },
        report: { updateMany: async () => ({ count: 0 }) },
      },
    },
  };
  require("../src/utils/cronJob");
  assert.equal(jobs.length, 1);
  await jobs[0]();
  console.log("PASS: registration, unverified login, auth guards, removed OTP route and user cleanup");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
