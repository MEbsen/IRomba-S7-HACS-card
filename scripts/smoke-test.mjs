import fs from "node:fs";
const file = process.argv[2] || "dist/iroomba-s7-card.js";
const source = fs.readFileSync(file, "utf8");
for (const value of ["iroomba-s7-card", "iroomba-s7-card-editor", "IROOMBA S7 CARD", "0.2.0-dev.8", "filter_interval", "maintenanceIcons", "serviceIcon", "floorFlow", "dustFlow", "dockInvite", "_lastCommands"]) {
  if (!source.includes(value)) throw new Error(`Missing bundled capability: ${value}`);
}
if (/import\s*\(/.test(source) || /^\s*import\s/m.test(source)) throw new Error("Bundle contains unresolved import");
const registry = new Map();
globalThis.HTMLElement = class {};
globalThis.window = globalThis;
globalThis.customCards = [];
globalThis.customElements = {
  define(name, type) { if (registry.has(name)) throw new Error(`Duplicate custom element ${name}`); registry.set(name, type); },
  get(name) { return registry.get(name); }
};
globalThis.document = { createElement() { return {}; } };
new Function(source)();
if (!registry.has("iroomba-s7-card") || !registry.has("iroomba-s7-card-editor")) throw new Error("Card registration failed");
if (!globalThis.customCards.some(item => item.type === "iroomba-s7-card")) throw new Error("Card picker registration failed");
console.log("Bundle smoke test OK");
