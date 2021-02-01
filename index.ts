import { GraphObject, HyperGraphDB, Vertex, Corestore, Errors as HyperGraphErrors } from 'hyper-graphdb'
import {Errors as HyperObjectsErrors } from 'hyperobjects'
import { ICrypto, Cipher } from 'certacrypt-crypto'
import { CryptoCore, generateKeyId } from './lib/CryptoCore'
import { NoAccessError } from './lib/Errors'


export class CertaCryptGraph extends HyperGraphDB {
   
    constructor(corestore: Corestore, key?: string | Buffer, crypto?: ICrypto) {
        super(corestore, key, undefined, new CryptoCore(corestore, key, crypto))
    }

    async put(vertex: Vertex<GraphObject> | Array<Vertex<GraphObject>>, feed?: string | Buffer) {
        const vertices = Array.isArray(vertex) ? vertex : [vertex]
        
        for(const elem of vertices) {
            await (<CryptoCore>this.core).setEdgeKeys(elem)      
        }
        return super.put(vertex, feed)
    }

    async get(id: number, feed?: string | Buffer, key?: Buffer) : Promise<Vertex<GraphObject>>{
        if(key) {
            if(!feed) feed = await this.core.getDefaultFeedId()
            const keyId = generateKeyId(feed, id)
            this.crypto.registerKey(key, {id: keyId, type: Cipher.ChaCha20_Stream})
        }

        const vertex = <Vertex<GraphObject>> await super.get(id, feed)
        .catch(err => NoAccessError.detectAndThrow(id, err))
        // damn semicolon has cost me nerves XD (else it syntactically would be a method call)
        ;(<CryptoCore>this.core).registerEdges(vertex)
        return vertex
    }

    getKey(vertex: Vertex<GraphObject>) {
        if(vertex.getId() < 0 || !vertex.getFeed()) throw new Error('vertex has to be persisted to get its key')
        const keyId = generateKeyId(<string>vertex.getFeed(), vertex.getId())
        return this.crypto.getKey(keyId)
    }

    private get crypto() {
        return (<CryptoCore>this.core).crypto
    }
}
