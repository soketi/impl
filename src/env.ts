import type * as FN from '@soketi/impl/types';

export class Env {
    static env: FN.JSON.Object = {};

    static resolveFrom(entity: FN.JSON.Object) {
        this.env = entity;
    }

    static get(key: string, defaultValue: any = null): FN.JSON.Object {
        return this.env[key] || defaultValue;
    }
}
