import assert from "node:assert/strict";
import { isRvmFieldVisible, rvmSections } from "./spec";

function field(key: string) {
  const match = rvmSections.flatMap((section) => section.fields).find((item) => item.key === key);
  assert.ok(match, `Fält saknas i spec: ${key}`);
  return match;
}

assert.equal(isRvmFieldVisible(field("kitchen_notes"), {
  kitchen_sink_cabinet: "OK",
  dishwasher: "OK",
  water_alarm: "Finns",
}), false);

assert.equal(isRvmFieldVisible(field("kitchen_notes"), {
  kitchen_sink_cabinet: "Avvikelse",
}), true);

assert.equal(isRvmFieldVisible(field("bathroom_notes"), {
  bathroom_1_wc: "OK",
  bathroom_1_leak: "Nej",
}), false);

assert.equal(isRvmFieldVisible(field("bathroom_notes"), {
  bathroom_1_leak: "Ja, läckagespår vid golvbrunn",
}), true);

assert.equal(isRvmFieldVisible(field("history_notes"), {
  uneven_heat: "Nej",
  high_energy: "Nej",
  history_notes: "Gammal kommentar ska inte raderas när fältet döljs",
}), false);

assert.equal(isRvmFieldVisible(field("history_notes"), {
  uneven_heat: "Periodvis",
  history_notes: "Gammal kommentar ska visas igen vid relevant följdfråga",
}), true);

assert.equal(isRvmFieldVisible(field("customer_name"), {}), true);

console.log("husstatus-form spec tests passed");
