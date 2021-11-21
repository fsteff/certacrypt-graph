"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShareView = exports.SHARE_VIEW = exports.ShareGraphObject = exports.SHARE_GRAPHOBJECT = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const hyper_graphdb_2 = require("hyper-graphdb");
exports.SHARE_GRAPHOBJECT = 'Share';
class ShareGraphObject extends hyper_graphdb_1.GraphObject {
    constructor(serialized) {
        super();
        this.typeName = exports.SHARE_GRAPHOBJECT;
        if (serialized) {
            const json = JSON.parse(serialized.toString());
            if (json.version)
                this.version = json.version;
            if (json.info)
                this.info = json.info;
            if (json.owner)
                this.owner = json.owner;
        }
    }
    serialize() {
        let json = {};
        if (this.version)
            json.version = this.version;
        if (this.info)
            json.info = this.info;
        if (this.owner)
            json.owner = this.owner;
        return Buffer.from(JSON.stringify(json));
    }
}
exports.ShareGraphObject = ShareGraphObject;
exports.SHARE_VIEW = 'ShareView';
class ShareView extends hyper_graphdb_1.View {
    constructor() {
        super(...arguments);
        this.viewName = exports.SHARE_VIEW;
    }
    async out(state, label) {
        var _a;
        const vertex = state.value;
        if (!(vertex.getContent() instanceof ShareGraphObject)) {
            throw new Error('Vertex is not a a physical one, cannot use it for a ShareView');
        }
        const edges = vertex.getEdges(label);
        const vertices = [];
        for (const edge of edges) {
            const version = (_a = vertex.getContent()) === null || _a === void 0 ? void 0 : _a.version; // optional, might be undefined - TODO: test pinning
            const feed = edge.feed || Buffer.from(vertex.getFeed());
            vertices.push(this.get(Object.assign(Object.assign({}, edge), { feed }), state));
        }
        return vertices;
    }
    // within a query getting the share vertex actually returns the one on the 'share' edge
    async get(edge, state) {
        const feed = edge.feed.toString('hex');
        const tr = await this.getTransaction(feed);
        const vertex = await this.db.getInTransaction(edge.ref, this.codec, tr, feed);
        const view = this.getView(edge.view);
        const next = await view.query(hyper_graphdb_1.Generator.from([new hyper_graphdb_2.QueryState(vertex, [], [], view)])).out('share').vertices();
        if (next.length === 0)
            throw new Error('vertex has no share edge, cannot use ShareView');
        return this.toResult(next[0], edge, state);
    }
}
exports.ShareView = ShareView;
//# sourceMappingURL=Share.js.map