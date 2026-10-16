import assert from "node:assert/strict";
import {
  isImageChecklistItemComplete,
  summarizeImageChecklist,
  type ImageChecklistItem,
} from "./image-checklist";

const requiredOverview: ImageChecklistItem = {
  id: "heat-source-overview",
  title: "Värmepump - översiktsbild",
  componentId: "heat-source",
  componentName: "Värmepump",
  imageType: "OVERVIEW",
  level: "REQUIRED",
  sectionId: 7,
  reason: "Dokumentation",
};

assert.equal(isImageChecklistItemComplete("MISSING", 0, "OVERVIEW"), false);
assert.equal(isImageChecklistItemComplete("DONE", 0, "OVERVIEW"), true);
assert.equal(isImageChecklistItemComplete("DONE", 1, "OVERVIEW"), true);
assert.equal(isImageChecklistItemComplete("NO_VISIBLE_NAMEPLATE", 0, "NAMEPLATE"), true);
assert.equal(isImageChecklistItemComplete("NO_VISIBLE_NAMEPLATE", 0, "OVERVIEW"), false);

const confirmedExisting = summarizeImageChecklist(
  [requiredOverview],
  { [requiredOverview.id]: "DONE" },
  () => 0,
);
assert.equal(confirmedExisting.missingRequired.length, 0);
assert.equal(confirmedExisting.complete, 1);
assert.equal(confirmedExisting.imageProgress, 100);

const missing = summarizeImageChecklist([requiredOverview], {}, () => 0);
assert.equal(missing.missingRequired.length, 1);

console.log("image-checklist tests passed");
