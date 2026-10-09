const { MongoClient } = require("mongodb");

let clientPromise = null;
let indexesReady = false;

function getClient() {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not configured");
    const client = new MongoClient(uri, { maxPoolSize: 5 });
    clientPromise = client.connect();
  }
  return clientPromise;
}

async function getDb() {
  const client = await getClient();
  const db = client.db();
  if (!indexesReady) {
    indexesReady = true;
    // Fire-and-forget; safe to call repeatedly, Mongo no-ops if it already exists.
    db.collection("users")
      .createIndex({ email: 1 }, { unique: true })
      .catch(function () {});
  }
  return db;
}

module.exports = { getDb };
