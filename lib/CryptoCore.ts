import { Core, Corestore, Vertex } from 'hyper-graphdb'
import { DefaultCrypto, ICrypto, Cipher, KeyDef } from 'certacrypt-crypto'
import {Transaction, BlockStorage} from 'hyperobjects'
import codecs from 'codecs'

export class CryptoCore extends Core {
    readonly crypto: ICrypto

    constructor(corestore: Corestore, key?: string | Buffer, crypto?: ICrypto) {
        super(corestore, key)
        this.crypto = crypto || new DefaultCrypto()
    }

    async transaction(feed: string|Buffer, exec: (tr: Transaction) => any) {
        const store = await this.getStore(feed)
        await store.storage.ready()
        const head = await store.feed.length()
        const tr = new CryptoTransaction(this.crypto, store.storage, head)
        await tr.ready()

        if(exec) {
            const retval = await exec(tr)
            await tr.commit()
            for(const obj of tr.creates) {
                this.crypto.registerKey(obj.key, {id: generateKeyId(feed, <number>obj.id), type: Cipher.ChaCha20_Stream})
            }
            return retval
        }

        return tr
    }

    async getInTransaction<T>(id: number | string, contentEncoding : string | codecs.BaseCodec<T>, tr: Transaction, feed: string) : Promise<Vertex<T>> {
        const vertex = await super.getInTransaction<T>(id, contentEncoding, tr, feed)
        this.registerEdges(vertex)
        return vertex
    }

    registerEdges(vertex: Vertex<any>) {
        for(const edge of vertex.getEdges()) {
            const id = edge.ref
            const key = edge.metadata?.['key']
            if(key) {
                const keyId = generateKeyId(<string>vertex.getFeed(), id)
                this.crypto.registerKey(key, {id: keyId, type: Cipher.ChaCha20_Stream})
            }
        }
    }

    async setEdgeKeys<T>(vertex: Vertex<any>) {
        for(const edge of vertex.getEdges()) {
            const id = edge.ref
            const elemFeed = vertex.getFeed() ? Buffer.from(<string>vertex.getFeed(), 'hex') : undefined
            const feed = edge.feed || elemFeed || await this.getDefaultFeedId()
            const keyId = generateKeyId(feed, id)
            const key = this.crypto.getKey(keyId)
            if(key) {
                edge.metadata = Object.assign(edge.metadata || {}, {key})
            }
        }
    }
}

export type CryptoObj = {id?: number | undefined, key: Buffer}

export function generateKeyId(feed: string|Buffer, id: number) {
    return (Buffer.isBuffer(feed) ? feed.toString('hex') : feed) + '@' + id
}

class CryptoTransaction extends Transaction {
    private crypto: ICrypto
    private feed: string
    readonly creates = new Array<CryptoObj>()

    constructor (crypto: ICrypto, store: BlockStorage, head?: number) {
        super(store, head)
        this.crypto = crypto
        this.feed = store.feed.feed.key.toString('hex')
    }

    get (id: number) {
        return super.get(id, (index, data) => this.onRead(id, index, data))
    }

    set (id: number, data: Buffer) {
        return super.set(id, data, true,  (index, data) => this.onWrite(id, index, data))
    }

    async create(data: Buffer): Promise<CryptoObj> {
        const key = this.crypto.generateEncryptionKey(Cipher.ChaCha20_Stream)
        const obj = <CryptoObj>await super.create(data, true,  (index, data) => this.onWrite(undefined, index, data, key))
        obj.key = key
        this.creates.push(obj)
        return obj
    }

    

    private onRead(id: number, index: number, data: Buffer) : Buffer {
        const feedId = generateKeyId(this.feed, id)
        if(this.crypto.hasKey(feedId)) {
            const keydef: KeyDef = {id: feedId, type: Cipher.ChaCha20_Stream, nonce: index}
            return this.crypto.decrypt(data, keydef)
        } else {
            return data
        }  
    }

    private onWrite(id: number|undefined, index: number, data: Buffer, key?: Buffer) : Buffer {
        const feedId = generateKeyId(this.feed, id || 0)
        if(key) {
            const keydef: KeyDef = {id: feedId, type: Cipher.ChaCha20_Stream, nonce: index}
            return this.crypto.encrypt(data, keydef, key)
        } else if(id !== undefined && this.crypto.hasKey(feedId)) {
            const keydef: KeyDef = {id: feedId, type: Cipher.ChaCha20_Stream, nonce: index}
            return this.crypto.encrypt(data, keydef)
        } else {
            return data
        } 
    }
}
