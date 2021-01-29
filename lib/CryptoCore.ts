import { Core, Corestore } from 'hyper-graphdb/lib/Core'
import { DefaultCrypto, ICrypto } from 'certacrypt-crypto'
import { Cipher, KeyDef } from 'certacrypt-crypto/lib/Key'
import Transaction from 'hyperobjects/lib/Transaction'
import BlockStorage from 'hyperobjects/lib/BlockStorage'
import { ConstructorOpts } from 'hyperobjects/lib/Transaction'

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
            tr.commit()
            return retval
        }

        return tr
    }
}

export type CryptoObj = {id?: number | undefined, key: Buffer}

export function generateKeyId(feed: string|Buffer, id: number) {
    return (Buffer.isBuffer(feed) ? feed.toString('hex') : feed) + '@' + id
}

class CryptoTransaction extends Transaction {
    private crypto: ICrypto
    private feed: string

    constructor (crypto: ICrypto, store: BlockStorage, head?: number, opts?: ConstructorOpts) {
        super(store, head, opts)
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