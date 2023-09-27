export interface Connection<
    ID = string,
    Message = any,
    NativeConnection = NativeWebsocket,
> {
    id: ID;
    namespace: string;
    connection: NativeConnection;
    closed: boolean;
    handlers: NativeConnectionHandlers<Message>;
    send(message: Message): Promise<void>;
    sendJson(message: Message): Promise<void>;
    sendError(message: Message, code?: number, reason?: string): Promise<void>;
    close(code?: number, reason?: string): Promise<void>;
    toRemote(remoteInstanceId?: ID): RemoteConnection<ID>;
    clearTimeout(): Promise<void>;
    updateTimeout(): Promise<void>;
}

export type RemoteConnection<ID = string> = {
    id: ID;
    namespace?: string;
}

export type NativeConnectionHandlers<M = any> = {
    close: (code?: number, reason?: string) => Promise<void>;
    send: (message: M) => Promise<void>;
}

export type NativeWebsocket = {
    send?(...args: any[]): void;
    close?(code?: number, reason?: string): void;
}

export interface Connections<
    C extends Connection = Connection,
    Message = any
> {
    readonly connections: Map<string, Map<C['id'], C>>;

    namespace(namespace: string): Map<string, C>;
    hasNamespace(namespace: string): boolean;

    newConnection(conn: C): Promise<void>;
    removeConnection(conn: C, onEmptyNamespace?: () => Promise<void>): Promise<void>;
    drainConnections(timeout: number, message?: string, code?: number): Promise<void>;
    getConnection(namespace: string, id: C['id']): Promise<C|undefined>;
    close(namespace: string, id: C['id'], code?: number, reason?: string): Promise<void>;
    closeAll(namespace: string, code?: number, reason?: string): Promise<void>;
    send(namespace: string, id: C['id'], message: Message): Promise<void>;
    sendJson(namespace: string, id: C['id'], message: Message): Promise<void>;
    sendError(namepsace: string, id: C['id'], message: Message, code?: number, reason?: string): Promise<void>;
    broadcastMessage(namespace: string, message: Message, exceptions?: C['id'][]): Promise<void>;
    broadcastJsonMessage(namespace: string, message: Message, exceptions?: C['id'][]): Promise<void>;
    broadcastError(namespace: string, message: Message, code?: number, reason?: string, exceptions?: C['id'][]): Promise<void>;
}
