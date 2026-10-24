// Run: node -r ts-node/register tests/donation-dummy.cjs
const assert = require("node:assert/strict");
const express = require("express");
const passport = require("passport");

const donations = [];
let failSave = false;
const repository = require.resolve("../src/repositories/donationRepository");
require.cache[repository] = {
  id: repository,
  filename: repository,
  loaded: true,
  exports: {
    createDonation: async (data) => {
      if (failSave) throw new Error("Database unavailable");
      const donation = { id: `donation-${donations.length}`, ...data };
      donations.push(donation);
      return donation;
    },
  },
};

// Replace only JWT lookup; exercise the real route, validators and controller.
passport.authenticate = (strategy, options) => {
  assert.equal(strategy, "jwt");
  assert.equal(options.session, false);
  return (req, res, next) => {
    if (req.headers.authorization !== "Bearer test") return res.sendStatus(401);
    req.user = { id: "authenticated-user" };
    next();
  };
};

async function main() {
  const app = express();
  app.use(express.json());
  app.use("/donation", require("../src/routes/donationRoutes").default);
  app.use((err, req, res, next) => res.status(500).json({ message: err.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const url = `http://127.0.0.1:${server.address().port}/donation`;
  const post = (body, authorization = "Bearer test", path = "") => fetch(url + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization },
    body: JSON.stringify(body),
  });
  try {
    for (const amount of [10000, "12.34", 0.01, 99999999.99]) {
      const response = await post({ amount, userId: "forged-user" });
      assert.equal(response.status, 200);
      const { transaction } = await response.json();
      assert.equal(transaction.status, "success");
      assert.equal(transaction.dummy, true);
      assert.equal(transaction.amount, Number(amount));
      assert.equal(transaction.orderId, donations.at(-1).orderId);
      assert.equal(donations.at(-1).userId, "authenticated-user");
      assert.equal(transaction.token, undefined);
      assert.equal(transaction.redirect_url, undefined);
    }
    assert.equal(new Set(donations.map((donation) => donation.orderId)).size, 4);
    for (const amount of [undefined, "", "abc", 0, -1, 100000000, "1.001", "1e3", [10], {}]) {
      assert.equal((await post({ amount })).status, 400, `Invalid amount: ${amount}`);
    }
    assert.equal((await post({ amount: 10 }, "")).status, 401);
    assert.equal((await post({ amount: 10 }, "Bearer test", "/webhook")).status, 404);
    assert.equal(donations.length, 4);
    failSave = true;
    assert.equal((await post({ amount: 10 })).status, 500);
    assert.equal(donations.length, 4);
    console.log("PASS: dummy success, exact amounts, authenticated ownership, validation, no webhook and save errors");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
