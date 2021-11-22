import { Generator, GraphObject, View, Vertex, Edge  } from 'hyper-graphdb'
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
    public readonly viewName = SHARE_VIEW;

    // within a query getting the share vertex actually returns the one on the 'share' edge
    public async get(edge: Edge & {feed: Buffer}, state: QueryState<GraphObject>): Promise<QueryResult<GraphObject>> {
        const feed = edge.feed.toString('hex')

        const tr = await this.getTransaction(feed)
        const vertex = await this.db.getInTransaction<GraphObject>(edge.ref, this.codec, tr, feed)

        const view = this.getView(edge.view) 
        const nextStates = await view.query(Generator.from([new QueryState<GraphObject>(vertex, [], [], view)])).out('share').states()
        if(nextStates.length === 0) throw new Error('vertex has no share edge, cannot use ShareView')
        // duplicate state
        return nextStates.map(next => {
            const mergedState = next.mergeStates(next.value, state.path, state.rules, next.view)
            return Promise.resolve(this.toResult(next.value, edge, mergedState))
        })
    }

}