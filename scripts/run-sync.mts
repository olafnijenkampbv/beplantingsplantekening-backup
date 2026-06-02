import { syncPlantFeed } from "../src/lib/db/feedSync";

console.log("Feed sync gestart...");
const result = await syncPlantFeed();
console.log(JSON.stringify(result, null, 2));
