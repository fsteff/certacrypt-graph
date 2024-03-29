import { Generator, GraphObject, View, Vertex, Edge, GRAPH_VIEW, QueryResult, QueryState  } from '@certacrypt/hyper-graphdb'
export const SHARE_GRAPHOBJECT = 'Share'

export class ShareGraphObject extends GraphObject {
    readonly typeName = SHARE_GRAPHOBJECT
    public version?: number
    public info?: string
    public owner?: string
    public revoked?: boolean

    constructor(serialized?: Uint8Array) {
        super()
        if(serialized) {
            const json: {version?: number, info?: string, owner?: string, revoked?: boolean} = JSON.parse(serialized.toString())
            if(json.version) this.version = json.version
            if(json.info) this.info = json.info
            if(json.owner) this.owner = json.owner
            if(json.revoked) this.revoked = !!json.revoked
        }
    }

    public serialize() {
        let json: {version?: number, info?: string, owner?: string, revoked?: boolean} = {}
        if(this.version) json.version = this.version
        if(this.info) json.info = this.info
        if(this.owner) json.owner = this.owner
        if(this.revoked) json.revoked = true
        return Buffer.from(JSON.stringify(json))
    }
}

export const SHARE_VIEW = 'ShareView'
export class ShareView extends View<GraphObject> {
    public readonly viewName = SHARE_VIEW;

    // within a query getting the share vertex actually returns the one on the 'share' edge
    public async get(edge: Edge & {feed: Buffer}, state: QueryState<GraphObject>): Promise<QueryResult<GraphObject>> {
        const feed = edge.feed.toString('hex')

        const vertex = await this.getVertex(edge, state)
        if((<Vertex<ShareGraphObject>>vertex).getContent()?.revoked) return Promise.reject(new Error('Share has been revoked'))

        const view = this.getView(GRAPH_VIEW) 
        const nextStates = await view.query(Generator.from([new QueryState<GraphObject>(vertex, [], [], view)])).out('share').states()
        if(nextStates.length === 0) throw new Error('vertex has no share edge, cannot use ShareView')
        // duplicate state
        return nextStates.map(next => {
            const mergedState = next.mergeStates(next.value, state.path, next.rules, next.view)
            return Promise.resolve(this.toResult(next.value, edge, mergedState))
        })
    }

}