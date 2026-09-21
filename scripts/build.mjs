import fs from "node:fs";
fs.mkdirSync("dist", { recursive: true });
fs.copyFileSync("src/iroomba-s7-card.js", "dist/iroomba-s7-card.js");
console.log("Built dist/iroomba-s7-card.js");
