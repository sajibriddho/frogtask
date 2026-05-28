/**
 * Database Backup API — downloads the entire MongoDB database as a single
 * Extended-JSON file that can be re-imported into MongoDB.
 *
 * GET /api/settings/backup
 *   Response: application/json attachment (MongoDB Extended JSON v2,
 *             canonical mode) so `ObjectId`, `Date`, `Decimal128`, etc.
 *             round-trip faithfully when re-imported.
 *
 * How to restore the downloaded file
 * ----------------------------------
 *   1. Using `mongorestore` (preferred). Convert each collection's array
 *      into BSON first via `bsondump` or a small script, or simply:
 *
 *        node -e "
 *          const fs=require('fs'); const {EJSON}=require('bson');
 *          const {MongoClient}=require('mongodb');
 *          (async () => {
 *            const dump = EJSON.parse(fs.readFileSync('backup.json','utf8'));
 *            const client = await MongoClient.connect('mongodb://…');
 *            const db = client.db('<target-db>');
 *            for (const [coll, docs] of Object.entries(dump.data)) {
 *              if (!docs.length) continue;
 *              await db.collection(coll).deleteMany({});
 *              await db.collection(coll).insertMany(docs);
 *            }
 *            await client.close();
 *          })();
 *        "
 *
 *   2. Or use `mongoimport --jsonArray --collection <name>` per collection
 *      after splitting the file.
 */

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { EJSON } from "bson";
import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";

export async function GET() {
  const { error } = await requirePermission("settings.backup");
  if (error) return error;

  try {
    await connectDB();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection is not ready");

    const collections = await db.listCollections().toArray();
    const dump: Record<string, unknown[]> = {};
    let totalDocs = 0;

    for (const c of collections) {
      if (c.name.startsWith("system.")) continue; // skip Mongo internals
      const docs = await db.collection(c.name).find({}).toArray();
      dump[c.name] = docs;
      totalDocs += docs.length;
    }

    const payload = {
      meta: {
        backedUpAt: new Date(),
        schemaVersion: 1,
        format: "mongodb-extended-json-v2",
        database: db.databaseName,
        collectionCount: Object.keys(dump).length,
        totalDocuments: totalDocs,
      },
      data: dump,
    };

    // Canonical Extended JSON preserves ObjectId, Date, Decimal128, Long,
    // BinData, etc. in a form MongoDB tooling understands on re-import.
    const json = EJSON.stringify(payload, undefined, 2, {
      relaxed: false,
    });

    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = `${db.databaseName}-backup-${stamp}.json`;

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/settings/backup", err);
    return NextResponse.json(
      { success: false, error: "Backup failed" },
      { status: 500 },
    );
  }
}
