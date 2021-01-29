import { GraphObject, HyperGraphDB, Vertex } from 'hyper-graphdb'
import { Corestore } from 'hyper-graphdb/lib/Core'
import { ICrypto } from 'certacrypt-crypto'
import { CryptoCore, generateKeyId } from './lib/CryptoCore'
import { Cipher } from 'certacrypt-crypto/lib/Key'

export class CertaCryptGraph extends HyperGraphDB {
   
    constructor(corestore: Corestore, key?: string | Buffer, crypto?: ICrypto) {
        super(corestore, key, undefined, new CryptoCore(corestore, key, crypto))
    }

    async put(vertex: Vertex<GraphObject>, feed?: string | Buffer, key?: Buffer) {
        if(key) {
            if(!feed) feed = await this.core.getDefaultFeedId()
                if(vertex.getId() >= 0) {
                    const keyId = generateKeyId(feed, vertex.getId())
                    this.crypto.registerKey(key, {id: keyId, type: Cipher.ChaCha20_Stream})
                }
        }
        return super.put(vertex, feed)
    }

    async get(id: number, feed?: string | Buffer, key?: Buffer) : Promise<Vertex<GraphObject>>{
        if(key) {
            if(!feed) feed = await this.core.getDefaultFeedId()
            const keyId = generateKeyId(feed, id)
            this.crypto.registerKey(key, {id: keyId, type: Cipher.ChaCha20_Stream})
        }

        const vertex = await super.get(id, feed)
        for(const edge of vertex.getEdges()) {
            const id = edge.ref
            const key = edge.metadata?.get('key')
            if(key) {
                const keyId = generateKeyId(<string>vertex.getFeed(), id)
                this.crypto.registerKey(key, {id: keyId, type: Cipher.ChaCha20_Stream})
            }
        }
        return vertex
    }

    private get crypto() {
        return (<CryptoCore>this.core).crypto
    }
}

