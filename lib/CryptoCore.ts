import { Core, Corestore, Vertex, Errors as HyperGraphErrors } from '@certacrypt/hyper-graphdb'
import { DefaultCrypto, ICrypto, Cipher, KeyDef } from '@certacrypt/certacrypt-crypto'
import { Transaction, BlockStorage } from 'hyperobjects'
import codecs from 'codecs'
import { NoAccessError } from './Errors'
import crc32 from 'buffer-crc32'

export class CryptoCore extends Core {
    readonly crypto: ICrypto

    constructor(corestore: Corestore, key?: string | Buffer, crypto?: ICrypto) {
        super(corestore, key)
        this.crypto = crypto || new DefaultCrypto()
    }

    async transaction(feed: string | Buffer, exec?: (tr: Transaction) => any, version?: number) {
        const store = await this.getStore(feed)
        await store.storage.ready()
        const head = version || await store.feed.length()
        const tr = new CryptoTransaction(this.crypto, store.storage, head)
        await tr.ready()

        if (exec) {
            const retval = await exec(tr)
            await tr.commit()
            for (const obj of tr.creates) {
                this.crypto.registerKey(obj.key, { feed: hex(feed), index: <number>obj.id, type: Cipher.ChaCha20_Stream })
            }
            return retval
        }

        return tr
    }

    async getInTransaction<T>(id: number | string, contentEncoding: string | codecs.BaseCodec<T>, tr: Transaction, feed: string): Promise<Vertex<T>> {
        const vertexId = typeof id === 'string' ? parseInt(id, 16) : <number>id
        const vertex = <Vertex<T>>await super.getInTransaction<T>(vertexId, contentEncoding, tr, feed)
            .catch(err => NoAccessError.detectAndThrow(vertexId, err))

        this.registerEdges(vertex)
        return vertex
    }

    registerEdges(vertex: Vertex<any>) {
        for (const edge of vertex.getEdges()) {
            const id = edge.ref
            const key = edge.metadata?.['key']
            const feed = edge.feed?.toString('hex') || <string>vertex.getFeed()
            if (key) {
                this.crypto.registerKey(key, { feed, index: id, type: Cipher.ChaCha20_Stream })
            }
        }
    }

    async setEdgeKeys<T>(vertex: Vertex<any>) {
        for (const edge of vertex.getEdges()) {
            const id = edge.ref
            const elemFeed = vertex.getFeed() ? Buffer.from(<string>vertex.getFeed(), 'hex') : undefined
            const feed = edge.feed || elemFeed || await this.getDefaultFeedId()
            const key = this.crypto.getKey(hex(feed), id)
            if (key && !edge.metadata?.['envelope']) {
                if (!edge.metadata) edge.metadata = { key }
                else (<{ key?: Buffer }>edge.metadata).key = key
            }
        }
    }
}

export type CryptoObj = { id?: number | undefined, key: Buffer }

class CryptoTransaction extends Transaction {
    private crypto: ICrypto
    private feed: string
    readonly creates = new Array<CryptoObj>()

    constructor(crypto: ICrypto, store: BlockStorage, head?: number) {
        super(store, head)
        this.crypto = crypto
        this.feed = store.feed.feed.key.toString('hex')
    }

    get(id: number) {
        return super.get(id, (index, data) => this.onRead(id, index, data))
            .catch(err => NoAccessError.detectAndThrow(id, err))
    }

    set(id: number, data: Buffer) {
        return super.set(id, data, true, (index, data) => this.onWrite(id, index, data))
    }

    async create(data: Buffer): Promise<CryptoObj> {
        const key = this.crypto.generateEncryptionKey(Cipher.ChaCha20_Stream)
        const obj = <CryptoObj>await super.create(data, true, (index, data) => this.onWrite(undefined, index, data, key))
        obj.key = key
        this.creates.push(obj)
        return obj
    }



    private onRead(id: number, index: number, data: Buffer): Buffer {
        const feed = hex(this.feed)
        if (this.crypto.hasKey(feed, id)) {
            const keydef: KeyDef = { feed, index: id, type: Cipher.ChaCha20_Stream, nonce: index }
            data = this.crypto.decrypt(data, keydef)
        }
        // in about 10% of the cases decoding encrypted data will not throw an error, so we need to detect missing keys somehow else
        const value = validateChecksum(data)
        if (!value) {
            throw new HyperGraphErrors.VertexDecodingError(id, new Error('checksum does not match'))
        }
        return value
    }

    private onWrite(id: number | undefined, index: number, data: Buffer, key?: Buffer): Buffer {
        data = appendChecksum(data)
        if (key) {
            const keydef = <KeyDef>{ type: Cipher.ChaCha20_Stream, nonce: index }
            return this.crypto.encrypt(data, keydef, key)
        } else if (id !== undefined && this.crypto.hasKey(hex(this.feed), id)) {
            const keydef: KeyDef = { feed: hex(this.feed), index: id, type: Cipher.ChaCha20_Stream, nonce: index }
            return this.crypto.encrypt(data, keydef)
        } else {
            return data
        }
    }
}

function hex(feed: string | Buffer) {
    if (typeof feed === 'string') return feed
    else return feed.toString('hex')
}

function appendChecksum(data: Buffer) {
    const crc = crc32.unsigned(data)
    return Buffer.concat([data, uint32ToBytes(crc)])
}

function validateChecksum(buf: Buffer) {
    if(buf.length < 4) {
        return false
    }
    const data = buf.slice(0, buf.length - 4)
    const rest = buf.slice(buf.length - 4)
    const crc = crc32.unsigned(data)
    const actual = uint32FromBytes(rest)
    if (crc === actual) {
        return data
    } else {
        return false
    }
}

function uint32ToBytes(x: number): Uint8Array {
    return Uint8Array.from([x, (x << 8), (x << 16), (x << 24)].map(z => z >>> 24))
}

function uint32FromBytes(byteArr: Uint8Array) {
    return byteArr.reduce((a, c, i) => a + c * 2 ** (24 - i * 8), 0)
}