"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const random_access_memory_1 = __importDefault(require("random-access-memory"));
const corestore_1 = __importDefault(require("corestore"));
const tape_1 = __importDefault(require("tape"));
const __1 = require("..");
const hyper_graphdb_1 = require("hyper-graphdb");
const certacrypt_crypto_1 = require("certacrypt-crypto");
const Errors_1 = require("../lib/Errors");
const Share_1 = require("../lib/Share");
tape_1.default('db', async (t) => {
    var _a, _b;
    const store = new corestore_1.default(random_access_memory_1.default);
    await store.ready();
    const db = new __1.CertaCryptGraph(store);
    const v1 = db.create(), v2 = db.create();
    v1.setContent(new hyper_graphdb_1.SimpleGraphObject().set('greeting', 'hello'));
    v2.setContent(new hyper_graphdb_1.SimpleGraphObject().set('greeting', 'hola'));
    await db.put([v1, v2]);
    let c1 = await db.get(v1.getId());
    let c2 = await db.get(v2.getId());
    t.same('hello', (_a = c1.getContent()) === null || _a === void 0 ? void 0 : _a.get('greeting'));
    t.same('hola', (_b = c2.getContent()) === null || _b === void 0 ? void 0 : _b.get('greeting'));
});
tape_1.default('manual access', async (t) => {
    var _a, _b, _c;
    const store = new corestore_1.default(random_access_memory_1.default);
    await store.ready();
    const crypto = new certacrypt_crypto_1.DefaultCrypto();
    const db = new __1.CertaCryptGraph(store, undefined, crypto);
    const feed = (await db.core.getDefaultFeedId()).toString('hex');
    const v1 = db.create(), v2 = db.create();
    v1.setContent(new hyper_graphdb_1.SimpleGraphObject().set('greeting', 'hello'));
    v2.setContent(new hyper_graphdb_1.SimpleGraphObject().set('greeting', 'hola'));
    await db.put([v1, v2]);
    v1.addEdgeTo(v2, 'next');
    await db.put(v1);
    const v1Key = db.getKey(v1);
    t.ok(Buffer.isBuffer(v1Key));
    crypto.unregisterKey(feed, v1.getId());
    crypto.unregisterKey(feed, v2.getId());
    // by calling get() with a key that is the entry point to the graph, all furher keys are stored in the edges
    let c1 = await db.get(v1.getId(), feed, v1Key);
    let c2 = await db.get(v2.getId());
    t.same('hello', (_a = c1.getContent()) === null || _a === void 0 ? void 0 : _a.get('greeting'));
    t.same('hola', (_b = c2.getContent()) === null || _b === void 0 ? void 0 : _b.get('greeting'));
    // same has to work with a query
    crypto.unregisterKey(feed, v2.getId());
    for (const v of await db.queryAtVertex(v1).out('next').vertices()) {
        t.same('hola', (_c = v.getContent()) === null || _c === void 0 ? void 0 : _c.get('greeting'));
    }
});
tape_1.default('no access', async (t) => {
    const store = new corestore_1.default(random_access_memory_1.default);
    await store.ready();
    const crypto = new certacrypt_crypto_1.DefaultCrypto();
    const db = new __1.CertaCryptGraph(store, undefined, crypto);
    const feed = (await db.core.getDefaultFeedId()).toString('hex');
    const v1 = db.create(), v2 = db.create();
    v1.setContent(new hyper_graphdb_1.SimpleGraphObject().set('greeting', 'hello'));
    await db.put(v1);
    crypto.unregisterKey(feed, v1.getId());
    try {
        const res = await db.get(v1.getId());
        t.fail('should throw, but got res: ' + res.getId());
    }
    catch (e) {
        t.ok(e instanceof Errors_1.NoAccessError);
    }
});
tape_1.default('share', async (t) => {
    const store = new corestore_1.default(random_access_memory_1.default);
    await store.ready();
    const db = new __1.CertaCryptGraph(store);
    const v1 = db.create(), v2 = db.create();
    v1.setContent(new hyper_graphdb_1.SimpleGraphObject().set('greeting', 'hello'));
    v2.setContent(new hyper_graphdb_1.SimpleGraphObject().set('greeting', 'hola'));
    await db.put([v1, v2]);
    const v3 = db.create();
    const share = new Share_1.ShareGraphObject();
    share.version = v2.getVersion();
    v3.setContent(share);
    v3.addEdgeTo(v2, 'share');
    await db.put(v3);
    v1.addEdgeTo(v3, 'link', undefined, undefined, Share_1.SHARE_VIEW);
    await db.put(v1);
    const shared = await db.queryAtVertex(v1).out('link').vertices();
    t.ok(shared[0].equals(v2));
});
//# sourceMappingURL=basic.js.map