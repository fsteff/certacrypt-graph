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
    // within a query getting the share vertex actually returns the one on the 'share' edge
    async get(edge, state) {
        const feed = edge.feed.toString('hex');
        const tr = await this.getTransaction(feed);
        const vertex = await this.db.getInTransaction(edge.ref, this.codec, tr, feed);
        const view = this.getView(edge.view);
        const nextStates = await view.query(hyper_graphdb_1.Generator.from([new hyper_graphdb_2.QueryState(vertex, [], [], view)])).out('share').states();
        if (nextStates.length === 0)
            throw new Error('vertex has no share edge, cannot use ShareView');
        // duplicate state
        return nextStates.map(next => {
            const mergedState = next.mergeStates(next.value, state.path, state.rules, next.view);
            return Promise.resolve(this.toResult(next.value, edge, mergedState));
        });
    }
}
exports.ShareView = ShareView;
//# sourceMappingURL=Share.js.map