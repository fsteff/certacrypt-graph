import RAM from 'random-access-memory'
import Corestore from 'corestore'
import tape from 'tape'
import { CertaCryptGraph } from '..'
import { SimpleGraphObject, Vertex } from '@certacrypt/hyper-graphdb'
import { DefaultCrypto } from '@certacrypt/certacrypt-crypto'
import { NoAccessError } from '../lib/Errors'
import { ShareGraphObject, SHARE_VIEW } from '../lib/Share'

tape('db', async t => {
    const store = new Corestore(RAM)
    await store.ready()
    const db = new CertaCryptGraph(store)

    const v1 = db.create<SimpleGraphObject>(), v2 = db.create<SimpleGraphObject>()
    v1.setContent(new SimpleGraphObject().set('greeting', 'hello'))
    v2.setContent(new SimpleGraphObject().set('greeting', 'hola'))
    await db.put([v1, v2])

    let c1 = <Vertex<SimpleGraphObject>> await db.get(v1.getId())
    let c2 = <Vertex<SimpleGraphObject>> await db.get(v2.getId())
    t.same('hello', c1.getContent()?.get('greeting'))
    t.same('hola', c2.getContent()?.get('greeting'))
})

tape('manual access', async t => {
    const store = new Corestore(RAM)
    await store.ready()
    const crypto = new DefaultCrypto()
    const db = new CertaCryptGraph(store, undefined, crypto)
    const feed = (await db.core.getDefaultFeedId()).toString('hex')

    const v1 = db.create<SimpleGraphObject>(), v2 = db.create<SimpleGraphObject>()
    v1.setContent(new SimpleGraphObject().set('greeting', 'hello'))
    v2.setContent(new SimpleGraphObject().set('greeting', 'hola'))
    await db.put([v1, v2])

    v1.addEdgeTo(v2, 'next')
    await db.put(v1)

    const v1Key = <Buffer> db.getKey(v1)
    t.ok(Buffer.isBuffer(v1Key))
    crypto.unregisterKey(feed, v1.getId())
    crypto.unregisterKey(feed, v2.getId())

    // by calling get() with a key that is the entry point to the graph, all furher keys are stored in the edges
    let c1 = <Vertex<SimpleGraphObject>> await db.get(v1.getId(), feed, v1Key)
    let c2 = <Vertex<SimpleGraphObject>> await db.get(v2.getId())
    t.same('hello', c1.getContent()?.get('greeting'))
    t.same('hola', c2.getContent()?.get('greeting'))

    // same has to work with a query
    crypto.unregisterKey(feed, v2.getId())
    for (const v of await db.queryAtVertex(v1).out('next').vertices()) {
        t.same('hola', (<Vertex<SimpleGraphObject>>v).getContent()?.get('greeting'))
    }
})

tape('no access', async t => {
    const store = new Corestore(RAM)
    await store.ready()
    const crypto = new DefaultCrypto()
    const db = new CertaCryptGraph(store, undefined, crypto)
    const feed = (await db.core.getDefaultFeedId()).toString('hex')

    const v1 = db.create<SimpleGraphObject>(), v2 = db.create<SimpleGraphObject>()
    v1.setContent(new SimpleGraphObject().set('greeting', 'hello'))
    await db.put(v1)

    crypto.unregisterKey(feed, v1.getId())
    try {
        const res = await db.get(v1.getId())
        t.fail('should throw, but got res: ' + res.getId())
    } catch(e) {
        t.ok(e instanceof NoAccessError)
    }
})

tape('share', async t => {
    const store = new Corestore(RAM)
    await store.ready()
    const db = new CertaCryptGraph(store)

    const v1 = db.create<SimpleGraphObject>(), v2 = db.create<SimpleGraphObject>()
    v1.setContent(new SimpleGraphObject().set('greeting', 'hello'))
    v2.setContent(new SimpleGraphObject().set('greeting', 'hola'))
    await db.put([v1, v2])

    const v3 = db.create<ShareGraphObject>()
    const share = new ShareGraphObject()
    share.version = v2.getVersion()
    v3.setContent(share)
    v3.addEdgeTo(v2, 'share')
    await db.put(v3)

    v1.addEdgeTo(v3, 'link', {view: SHARE_VIEW})
    await db.put(v1)

    const shared = await db.queryAtVertex(v1).out('link').vertices()
    t.ok(shared[0].equals(v2))
})