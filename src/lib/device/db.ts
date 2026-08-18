// The on-device database. One idb instance, opened lazily and only in the
// browser: importing this module on the server (a route handler, a test
// running under node:test) must not throw just from being imported, since
// several pure modules import types from ./schema.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CatalogueIndexRow, DraftEntry, MetaRow, OutboxOp, StoredPhoto, UserCopy } from "./schema";

const DB_NAME = "vitrine";
const DB_VERSION = 1;

interface VitrineDB extends DBSchema {
  catalogueIndex: {
    key: string;
    value: CatalogueIndexRow;
    indexes: { byItem: string; byIdentifier: string };
  };
  meta: {
    key: string;
    value: MetaRow;
  };
  userCopies: {
    key: string;
    value: UserCopy;
    indexes: { byVariant: string; byCreatedAt: string };
  };
  photos: {
    key: string;
    value: StoredPhoto;
  };
  outbox: {
    key: string;
    value: OutboxOp;
  };
  draftEntries: {
    key: string;
    value: DraftEntry;
  };
}

let dbPromise: Promise<IDBPDatabase<VitrineDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<VitrineDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment."));
  }
  if (!dbPromise) {
    dbPromise = openDB<VitrineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const catalogue = db.createObjectStore("catalogueIndex", { keyPath: "variantPublicId" });
        catalogue.createIndex("byItem", "itemPublicId");
        catalogue.createIndex("byIdentifier", "normalizedIdentifiers", { multiEntry: true });

        db.createObjectStore("meta", { keyPath: "key" });

        const copies = db.createObjectStore("userCopies", { keyPath: "id" });
        copies.createIndex("byVariant", "variantPublicId");
        copies.createIndex("byCreatedAt", "createdAt");

        db.createObjectStore("photos", { keyPath: "id" });
        db.createObjectStore("outbox", { keyPath: "opId" });
        db.createObjectStore("draftEntries", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export type { VitrineDB };
