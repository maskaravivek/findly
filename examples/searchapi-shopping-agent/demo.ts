// CLI: pnpm demo "battery powered drill under $150"
import { runShoppingAgent } from "./agent.js";

const query = process.argv.slice(2).join(" ") || "battery powered drill under $150";
const { shortlist, reasoning, trace } = await runShoppingAgent(query);

console.log("\nTool calls:");
for (const call of trace) console.log(`  ${call.tool} ${JSON.stringify(call.input)} -> ${call.summary}`);
console.table(shortlist.map(o => ({
  retailer: o.retailer, title: o.title.slice(0, 50), price: `${o.price} ${o.currency}`,
  rating: o.rating ?? "", reviews: o.reviews ?? "", fulfilment: o.pickup ? "pickup" : o.delivery ?? "",
})));
console.log(`\n${reasoning}`);
