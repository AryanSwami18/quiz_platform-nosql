import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri =
  process.env.MONGO_URI ||
  'mongodb://root:rootpassword@localhost:27017/quiz_platform?authSource=admin';
const dbName = process.env.MONGO_DB || 'quiz_platform';

let client;
let database;

export async function connectMongo() {
  if (!client) {
    client = new MongoClient(uri);
  }

  if (!database) {
    await client.connect();
    database = client.db(dbName);
  }

  return database;
}

export async function getDb() {
  return connectMongo();
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    database = null;
  }
}

export function getMongoClient() {
  return client;
}
