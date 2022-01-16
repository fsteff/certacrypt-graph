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
            if (json.revoked)
                this.revoked = !!json.revoked;
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
        if (this.revoked)
            json.revoked = true;
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
    // within a query getting the share vertex actually returns the one on the 'share' edge
    async get(edge, state) {
        var _a;
        const feed = edge.feed.toString('hex');
        const vertex = await this.getVertex(edge, state);
        if ((_a = vertex.getContent()) === null || _a === void 0 ? void 0 : _a.revoked)
            return Promise.reject(new Error('Share has been revoked'));
        const view = this.getView(hyper_graphdb_1.GRAPH_VIEW);
        const nextStates = await view.query(hyper_graphdb_1.Generator.from([new hyper_graphdb_2.QueryState(vertex, [], [], view)])).out('share').states();
        if (nextStates.length === 0)
            throw new Error('vertex has no share edge, cannot use ShareView');
        // duplicate state
        return nextStates.map(next => {
            const mergedState = next.mergeStates(next.value, state.path, next.rules, next.view);
            return Promise.resolve(this.toResult(next.value, edge, mergedState));
        });
    }
}
exports.ShareView = ShareView;
//# sourceMappingURL=Share.js.map