import assert from "node:assert/strict";
import { rvmSections } from "../app/admin/husstatus-form/spec";
import { extractHusstatusImages } from "./husstatus-images";
import { emptyCustomerPreInspectionPayload, mapPreInspectionToHusstatusAnswers } from "./customer-preinspection";

const dataUrl = "data:image/jpeg;base64,ZmFrZQ==";
const payload = {
  ...emptyCustomerPreInspectionPayload,
  firstName: "Karin",
  lastName: "Larsson",
  email: "karin@example.se",
  phone: "0701234567",
  address: "Testvägen 1",
  postalCode: "861 31",
  city: "Timrå",
  heating: ["Bergvärme"],
  heatingBrand: "NIBE",
  heatingModel: "F1245-8",
  heatingInstallationYear: "2016",
  heatingPhotos: [
    {
      id: "shared-photo-id",
      name: "varmepump-typplat.jpg",
      mimeType: "image/jpeg",
      size: 1200,
      dataUrl,
      createdAt: "2026-09-08T09:00:00.000Z",
      category: "värme",
      imageType: "NAMEPLATE" as const,
      ocrCandidate: true,
    },
  ],
  hotWaterType: "Separat varmvattenberedare",
  waterHeaterBrand: "NIBE",
  waterHeaterModel: "VPB 200",
  waterHeaterInstallationYear: "2018",
  waterHeaterPhotos: [
    {
      id: "shared-photo-id",
      name: "vvb.jpg",
      mimeType: "image/jpeg",
      size: 900,
      dataUrl,
      createdAt: "2026-09-08T09:05:00.000Z",
      category: "varmvatten",
      imageType: "NAMEPLATE" as const,
      ocrCandidate: true,
    },
  ],
  otherInformation: "Kunden vill att diskbänksskåpet kontrolleras extra.",
  otherPhotos: [
    {
      id: "shared-photo-id",
      name: "diskbank.jpg",
      mimeType: "image/jpeg",
      size: 800,
      dataUrl,
      createdAt: "2026-09-08T09:10:00.000Z",
      category: "övrigt",
      imageType: "DOCUMENTATION" as const,
    },
  ],
};

const answers = mapPreInspectionToHusstatusAnswers(payload);

assert.equal(JSON.stringify(answers.customer_self_declaration).includes("data:image/"), false);

const images = extractHusstatusImages([
  {
    id: "submission-token-flow",
    inspection: {
      property: {
        id: "property-token-flow",
        propertyNo: "Testvägen 1",
        address: "Testvägen 1, 861 31, Timrå",
        customer: { id: "customer-token-flow", name: "Karin Larsson" },
      },
    },
    answers: Object.entries(answers).map(([fieldKey, value]) => ({
      fieldKey,
      value: Array.isArray(value) ? { values: value } : { value },
    })),
  },
], rvmSections);

assert.equal(images.length, 3);
assert.equal(new Set(images.map((image) => image.id)).size, 3);
assert.equal(images.every((image) => image.customerId === "customer-token-flow"), true);
assert.equal(images.every((image) => image.propertyId === "property-token-flow"), true);
assert.equal(images.every((image) => image.visibility === "CUSTOMER"), true);

const heatPump = images.find((image) => image.fileName === "varmepump-typplat.jpg");
assert.equal(heatPump?.sectionId, 19);
assert.equal(heatPump?.fieldLabel, "Värmepump / panna");

const waterHeater = images.find((image) => image.fileName === "vvb.jpg");
assert.equal(waterHeater?.sectionId, 19);
assert.equal(waterHeater?.fieldLabel, "Varmvattenberedare");

const other = images.find((image) => image.fileName === "diskbank.jpg");
assert.equal(other?.sectionId, 25);
assert.equal(other?.sectionTitle, "Övrig information och bilder");
assert.equal(other?.fieldLabel, "Övrig information");

console.log("customer preinspection image flow tests passed");
