import assert from "node:assert/strict";
import { stripEmbeddedImageData } from "./browser-draft-storage";

const draft = {
  customerName: "Test Kund",
  photos: [{
    id: "photo-1",
    name: "typplåt.jpg",
    mimeType: "image/jpeg",
    dataUrl: "data:image/jpeg;base64,ZmFrZQ==",
  }],
  nested: {
    rows: [{ photos: [{ id: "photo-2", mimeType: "image/png", dataUrl: "data:image/png;base64,ZmFrZQ==" }] }],
  },
};

const fallback = stripEmbeddedImageData(draft);

assert.equal(fallback.customerName, "Test Kund");
assert.equal(fallback.photos[0].id, "photo-1");
assert.equal(fallback.photos[0].dataUrl, "");
assert.equal(fallback.nested.rows[0].photos[0].dataUrl, "");
assert.equal(draft.photos[0].dataUrl.startsWith("data:image/"), true);

console.log("browser draft storage tests passed");
