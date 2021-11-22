import { Generator, GraphObject, View, IVertex, Vertex, VertexQueries, SimpleGraphObject, GRAPH_VIEW, Edge, ViewGetResult  } from 'hyper-graphdb'
import { QueryState } from 'hyper-graphdb'
import { QueryResult } from 'hyper-graphdb'

export const SHARE_GRAPHOBJECT = 'Share'

export class ShareGraphObject extends GraphObject {
    readonly typeName = SHARE_GRAPHOBJECT
    public version?: number
    public info?: string
    public owner?: string

    constructor(serialized?: Uint8Array) {
        super()
        if(serialized) {
            const json: {version?: number, info?: string, owner?: string} = JSON.parse(serialized.toString())
            if(json.version) this.version = json.version
            if(json.info) this.info = json.info
            if(json.owner) this.owner = json.owner
        }
    }

    public serialize() {
        let json: {version?: number, info?: string, owner?: string} = {}
        if(this.version) json.version = this.version
        if(this.info) json.info = this.info
        if(this.owner) json.owner = this.owner
        return Buffer.from(JSON.stringify(json))
    }
}

export const SHARE_VIEW = 'ShareView'
export class ShareView extends View<GraphObject> {
    public viewName = SHARE_VIEW;

    public async out(state: QueryState<GraphObject>, label?: string):  Promise<QueryResult<GraphObject>> {
        const vertex = <Vertex<ShareGraphObject>> state.value
        if(!(vertex.getContent() instanceof ShareGraphObject)) {
            throw new Error('Vertex is not a a physical one, cannot use it for a ShareView')
        }
        const edges = vertex.getEdges(label)
        const vertices: QueryResult<GraphObject> = []
        for(const edge of edges) {
            const version = vertex.getContent()?.version // optional, might be undefined - TODO: test pinning
            const feed =  edge.feed || Buffer.from(<string>vertex.getFeed())
            vertices.push(this.get({...edge, feed}, state))
        }
        
        return vertices
    }

    // within a query getting the share vertex actually returns the one on the 'share' edge
    public async get(edge: Edge & {feed: Buffer}, state: QueryState<GraphObject>): ViewGetResult<GraphObject> {
        const feed = edge.feed.toString('hex')

        const tr = await this.getTransaction(feed)
        const vertex = await this.db.getInTransaction<GraphObject>(edge.ref, this.codec, tr, feed)

        const view = this.getView(edge.view) 
        const next = await view.query(Generator.from([new QueryState<GraphObject>(vertex, [], [], view)])).out('share').states()
        if(next.length === 0) throw new Error('vertex has no share edge, cannot use ShareView')
        // duplicate state
        const mergedState = next[0].mergeStates(next[0].value, state.path, state.rules, next[0].view)
        return this.toResult(next[0].value, edge, mergedState)
    }

}