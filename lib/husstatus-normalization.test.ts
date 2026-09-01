import assert from "node:assert/strict";
import { calculateHusstatusScore } from "./husstatus-scoring";
import { measuredNumber, measurementStatusFor, normalizeHusstatus } from "./husstatus-normalization";

const rehnSommarstuga = {
  customer_name: "Testkund",
  property_address: "Teststugan, Testvägen 1",
  build_year: "1974",
  scope: "Full husstatus",
  water_source: "Egen brunn",
  well_type_depth: "Borrad brunn",
  hydropress: "Hydrofor",
  filter_type: "Partikelfilter",
  hot_water_type: "Panna",
  hot_water_product: "Dalatank",
  mixing_valve: "ESBE VTA323",
  hot_water_out_c__measurement_status: "Mätt",
  hot_water_out_c: "71",
  nearest_tap_c__measurement_status: "Mätt",
  nearest_tap_c: "55",
  furthest_tap_c__measurement_status: "Mätt",
  furthest_tap_c: "52",
  time_to_50_sec__measurement_status: "Mätt",
  time_to_50_sec: "8",
  heat_source_type: "Elpanna",
  heat_source_product: "CTC Total värmepanna",
  energy_source_type: "Ej aktuellt",
  brine_in_c__measurement_status: "Ej aktuellt",
  brine_in_c: "0",
  brine_out_c__measurement_status: "Ej aktuellt",
  brine_out_c: "0",
  brine_pressure_bar__measurement_status: "Ej aktuellt",
  brine_pressure_bar: "0",
  circulation_pump: "Grundfos Alpha2 25-40",
  expansion_vessel: "Watts Industries 18 l",
  safety_valve: "Säkerhetsventil 10 bar DN15",
  supply_temp_c__measurement_status: "Mätt",
  supply_temp_c: "71",
  return_temp_c__measurement_status: "Mätt",
  return_temp_c: "60",
  heat_pressure_bar__measurement_status: "Mätt",
  heat_pressure_bar: "3",
  radiators_total: "6",
  valve_type: "MMA radiatorventiler",
  pipe_in_pipe: "OK",
  sewer_type: "Enskilt avlopp",
  floor_drain: "Purus Oden",
  known_stops: "Nej",
  sewer_film: "Nej",
  kitchen_sink_cabinet: "OK",
  kitchen_waterproof_base: "Saknas",
  water_alarm: "Saknas",
  kitchen_notes: "Fördelare under kök om läckage uppstår är det svårt att märka",
  annual_control: "Ja",
  quarterly_control: "Erbjuds",
};

const normalized = normalizeHusstatus(rehnSommarstuga);

assert.equal(measurementStatusFor(rehnSommarstuga, "brine_in_c"), "Ej aktuellt");
assert.equal(measuredNumber(rehnSommarstuga, "brine_in_c"), undefined);
assert.equal(normalized.measurements.find((item) => item.key === "brine_in_c")?.value, undefined);
assert.equal(normalized.measurements.find((item) => item.key === "hot_water_out_c")?.value, 71);

const components = normalized.components.map((row) => `${row.typeName}|${row.brand}|${row.model}`);
assert.equal(components.filter((item) => item.includes("Blandningsventil|ESBE|VTA323")).length, 1);
assert.equal(components.filter((item) => item.includes("Cirkulationspump|Grundfos|ALPHA2 25-40")).length, 1);
assert.equal(components.filter((item) => item.includes("Golvbrunn|Purus|Oden")).length, 1);
assert.ok(components.some((item) => item.includes("Expansionskärl|Watts|Industries 18 l")));

const componentWithUnknownYear = normalized.components.find((row) => row.brand === "ESBE");
assert.equal(componentWithUnknownYear?.installedYear, "");
assert.equal(componentWithUnknownYear?.yearSource, "Okänt");
assert.ok(!normalized.components.some((row) => row.installedYear === "1974"));

assert.ok(normalized.observations.some((item) => item.controlPointId === "kitchen_notes" && item.type === "Förebyggande förbättring"));
assert.ok(!normalized.observations.some((item) => item.controlPointId === "sewer_film"));
assert.equal(normalized.salesAnswers.annual_control, "Ja");
assert.equal(normalized.technicalAnswers.annual_control, undefined);

const scoringInput = {
  ...normalized.technicalAnswers,
  brine_in_c: measuredNumber(rehnSommarstuga, "brine_in_c"),
  brine_out_c: measuredNumber(rehnSommarstuga, "brine_out_c"),
};
const scoring = calculateHusstatusScore(scoringInput, normalized.components, { currentYear: 2026, totalControlPoints: 40 });
assert.ok(scoring.dataSufficient);
assert.ok(scoring.riskIndex > 0);
assert.ok(scoring.houseScore > 0);
assert.ok(scoring.counts.urgent === 0);

console.log("husstatus normalization golden test passed");
