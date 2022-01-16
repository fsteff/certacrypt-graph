import { Errors as HyperGraphErrors } from '@certacrypt/hyper-graphdb'
import { Errors as HyperObjectsErrors } from 'hyperobjects'

export class NoAccessError extends Error {
    readonly cause: HyperObjectsErrors.DecodingError | HyperGraphErrors.VertexDecodingError

    constructor(objectId: number, err: HyperObjectsErrors.DecodingError | HyperGraphErrors.VertexDecodingError) {
        super(`Cannot access object ${objectId}`)
        this.cause = err
    }

    static detectAndThrow(id: number, err: Error) {
        if (err instanceof HyperObjectsErrors.DecodingError || err instanceof HyperGraphErrors.VertexDecodingError) throw new NoAccessError(id, err)
        else throw err
    }
}