"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertaCryptGraph = exports.NoAccessError = exports.SHARE_GRAPHOBJECT = exports.SHARE_VIEW = exports.ShareView = exports.CryptoCore = exports.ShareGraphObject = void 0;
const hyper_graphdb_1 = require("@certacrypt/hyper-graphdb");
const certacrypt_crypto_1 = require("@certacrypt/certacrypt-crypto");
const CryptoCore_1 = require("./lib/CryptoCore");
Object.defineProperty(exports, "CryptoCore", { enumerable: true, get: function () { return CryptoCore_1.CryptoCore; } });
const Errors_1 = require("./lib/Errors");
Object.defineProperty(exports, "NoAccessError", { enumerable: true, get: function () { return Errors_1.NoAccessError; } });
const Share_1 = require("./lib/Share");
Object.defineProperty(exports, "ShareGraphObject", { enumerable: true, get: function () { return Share_1.ShareGraphObject; } });
Object.defineProperty(exports, "ShareView", { enumerable: true, get: function () { return Share_1.ShareView; } });
Object.defineProperty(exports, "SHARE_VIEW", { enumerable: true, get: function () { return Share_1.SHARE_VIEW; } });
Object.defineProperty(exports, "SHARE_GRAPHOBJECT", { enumerable: true, get: function () { return Share_1.SHARE_GRAPHOBJECT; } });
class CertaCryptGraph extends hyper_graphdb_1.HyperGraphDB {
    constructor(corestore, key, crypto) {
        super(corestore, key, undefined, new CryptoCore_1.CryptoCore(corestore, key, crypto));
        this.codec.registerImpl(serialized => new Share_1.ShareGraphObject(serialized));
        this.factory.register(Share_1.SHARE_VIEW, (db, codec, tr) => new Share_1.ShareView(db, codec, this.factory, tr));
    }
    async put(vertex, feed) {
        const vertices = Array.isArray(vertex) ? vertex : [vertex];
        for (const elem of vertices) {
            await this.core.setEdgeKeys(elem);
        }
        return super.put(vertex, feed);
    }
    async get(id, feed, key) {
        if (key) {
            if (!feed)
                feed = await this.core.getDefaultFeedId();
            feed = Buffer.isBuffer(feed) ? feed.toString('hex') : feed;
            this.crypto.registerKey(key, { feed, index: id, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream });
        }
        const vertex = await super.get(id, feed)
            .catch(err => Errors_1.NoAccessError.detectAndThrow(id, err));
        this.core.registerEdges(vertex);
        return vertex;
    }
    getKey(vertex) {
        if (vertex.getId() < 0 || !vertex.getFeed())
            throw new Error('vertex has to be persisted to get its key');
        return this.crypto.getKey(vertex.getFeed(), vertex.getId());
    }
    registerVertexKey(id, feed, key) {
        feed = Buffer.isBuffer(feed) ? feed.toString('hex') : feed;
        this.crypto.registerKey(key, { index: id, feed, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream });
    }
    get crypto() {
        return this.core.crypto;
    }
    async createShare(vertex, opts = {}) {
        const share = new Share_1.ShareGraphObject();
        share.info = opts === null || opts === void 0 ? void 0 : opts.info;
        share.owner = opts === null || opts === void 0 ? void 0 : opts.owner;
        share.version = opts === null || opts === void 0 ? void 0 : opts.version;
        const edge = {
            label: 'share',
            ref: vertex.getId(),
            view: opts === null || opts === void 0 ? void 0 : opts.view,
            version: vertex.getVersion(),
            feed: Buffer.from(vertex.getFeed(), 'hex'),
            metadata: {
                key: this.getKey(vertex)
            },
        };
        const shareVertex = this.create();
        shareVertex.setContent(share);
        shareVertex.addEdge(edge);
        await this.put(shareVertex);
        return shareVertex;
    }
}
exports.CertaCryptGraph = CertaCryptGraph;
//# sourceMappingURL=index.js.map