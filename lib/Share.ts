import { Generator, GraphObject, View, IVertex, Vertex, VertexQueries, SimpleGraphObject, GRAPH_VIEW  } from 'hyper-graphdb'

export class ShareGraphObject extends GraphObject {
    readonly typeName = 'Share'
    public version?: number
    public info?: string

    constructor(serialized?: Uint8Array) {
        super()
        if(serialized) {
            const json: {version?: number, info?: string} = JSON.parse(serialized.toString())
            if(json.version) this.version = json.version
        }
    }

    public serialize() {
        let json: {version?: number, info?: string} = {}
        if(this.version) json.version = this.version
        if(this.info) json.info = this.info
        return Buffer.from(JSON.stringify(json))
    }
}

export const SHARE_VIEW = 'ShareView'
export class ShareView extends View<GraphObject> {
    public viewName = SHARE_VIEW;

    public async out(vertex: Vertex<ShareGraphObject>, label?: string):  Promise<VertexQueries<GraphObject>> {
        if(!(vertex.getContent() instanceof ShareGraphObject)) {
            throw new Error('Vertex is not a a physical one, cannot use it for a ShareView')
        }
        const edges = vertex.getEdges(label)
        const vertices = new Array<Promise<IVertex<GraphObject>>>()
        for(const edge of edges) {
            const version = vertex.getContent()?.version // optional, might be undefined - TODO: test pinning
            const feed =  edge.feed?.toString('hex') || <string>vertex.getFeed()
            vertices.push(this.get(feed, edge.ref, version, edge.view))
        }
        
        return Generator.from(vertices)
    }

    // within a query getting the share vertex actually returns the one on the 'share' edge
    public async get(feed: string|Buffer, id: number, version?: number, viewDesc?: string) : Promise<IVertex<GraphObject>>{
        feed = Buffer.isBuffer(feed) ? feed.toString('hex') : feed
        viewDesc = viewDesc || GRAPH_VIEW

        const tr = await this.getTransaction(feed, version)
        const vertex = await this.db.getInTransaction<GraphObject>(id, this.codec, tr, feed)

        const view = this.getView(viewDesc) 
        const next = await (await view.out(vertex, 'share')).destruct()
        if(next.length === 0) throw new Error('vertex has no share edge, cannot use ShareView')
        return next[0]
    }

}