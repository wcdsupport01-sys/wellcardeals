import test from "node:test";
import assert from "node:assert/strict";
import { lookupByRegistrationNumber } from "../src/api/rcLookupApi.js";

test("a plausible registration never returns invented vehicle details without a provider", async () => {
  await assert.rejects(
    lookupByRegistrationNumber("DL 4C AB 1234"),
    /lookup is unavailable.*manually/,
  );
});

test("invalid registration is rejected before lookup", async () => {
  for (const registration of ["", "INVALID", null]) {
    await assert.rejects(
      lookupByRegistrationNumber(registration),
      /valid registration number/,
    );
  }
});
