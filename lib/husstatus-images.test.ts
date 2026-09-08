import assert from "node:assert/strict";
import { extractHusstatusImages } from "./husstatus-images";

const sections = [
  {
    id: 13,
    title: "Kök",
    fields: [{ key: "kitchen_sink_cabinet", label: "Diskbänksskåp" }],
  },
  {
    id: 25,
    title: "Övrig information och bilder",
    fields: [{ key: "other_information", label: "Övrig information" }],
  },
];

const dataUrl = "data:image/jpeg;base64,ZmFrZQ==";

const images = extractHusstatusImages([
  {
    id: "sub-a",
    inspection: {
      property: {
        id: "prop-a",
        propertyNo: "Sommarstugan",
        address: "Skillinge 694",
        customer: { id: "cust-a", name: "Kenneth Rehn" },
      },
    },
    answers: [
      {
        fieldKey: "kitchen_sink_cabinet__photos",
        value: {
          values: [
            { id: "same-photo-id", name: "diskbank.jpg", mimeType: "image/jpeg", size: 12, dataUrl, createdAt: "2026-09-08T10:00:00.000Z" },
          ],
        },
      },
      {
        fieldKey: "component_register_rows",
        value: {
          values: [
            {
              typeName: "Värmepump",
              brand: "NIBE",
              model: "F1245-8",
              photos: [
                { id: "same-photo-id", name: "nibe.jpg", mimeType: "image/jpeg", size: 20, dataUrl, createdAt: "2026-09-08T11:00:00.000Z" },
              ],
            },
          ],
        },
      },
      {
        fieldKey: "technician_inspection",
        value: {
          value: {
            photos: [
              { id: "same-photo-id", name: "teknikrum.jpg", mimeType: "image/jpeg", size: 30, dataUrl, createdAt: "2026-09-08T12:00:00.000Z", areaId: "technical", category: "Översikt" },
            ],
          },
        },
      },
    ],
  },
], sections);

assert.equal(images.length, 3);
assert.equal(new Set(images.map((image) => image.id)).size, 3, "bilder ska få unika id även om källfotot har samma id");

const kitchen = images.find((image) => image.fileName === "diskbank.jpg");
assert.equal(kitchen?.customerId, "cust-a");
assert.equal(kitchen?.propertyId, "prop-a");
assert.equal(kitchen?.sectionTitle, "Kök");
assert.equal(kitchen?.fieldLabel, "Diskbänksskåp");
assert.equal(kitchen?.visibility, "INTERNAL");

const component = images.find((image) => image.fileName === "nibe.jpg");
assert.equal(component?.sectionId, 19);
assert.equal(component?.fieldLabel, "Värmepump");
assert.equal(component?.visibility, "CUSTOMER");

const technician = images.find((image) => image.fileName === "teknikrum.jpg");
assert.equal(technician?.sectionTitle, "Teknikrum");
assert.equal(technician?.visibility, "CUSTOMER");

console.log("husstatus image extraction tests passed");
