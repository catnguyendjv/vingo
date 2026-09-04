import { afterAll, beforeAll, expect, it } from "vitest";
import { getKnownWords } from "./knownWords.js";
import { cleanupUser, createTestUser, ctxFor, userClient } from "./_testutil.js";

let userId: string;
beforeAll(async () => {
  userId = await createTestUser();
});
afterAll(async () => {
  await cleanupUser(userId);
});

it("getKnownWords lọc theo lang, chỉ trả từ của user", async () => {
  const supa = userClient(userId);
  await supa.from("known_words").insert([
    { user_id: userId, lang: "ja", term: "既知", reading: "きち", meaning: "đã biết" },
    { user_id: userId, lang: "en", term: "known", meaning: "known" },
  ]);

  const ja = await getKnownWords(ctxFor(userId), "ja");
  expect(ja).toHaveLength(1);
  expect(ja[0]).toMatchObject({ term: "既知", reading: "きち", meaning: "đã biết" });

  const en = await getKnownWords(ctxFor(userId), "en");
  expect(en.map((w) => w.term)).toEqual(["known"]);
});
