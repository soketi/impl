export interface Connection<
    ID = string,
    Message = any,
    NativeConnection = NativeWebsocket,
> {
    id: ID;
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
    readonly connections: Map<string, C>;

    newConnection(conn: C): Promise<void>;
    removeConnection(conn: C): Promise<void>;
    drainConnections(timeout: number, message?: string, code?: number): Promise<void>;
    getConnection(id: C['id']): Promise<C|undefined>;
    close(id: C['id'], code?: number, reason?: string): Promise<void>;
    closeAll(code?: number, reason?: string): Promise<void>;
    send(id: C['id'], message: Message): Promise<void>;
    sendJson(id: C['id'], message: Message): Promise<void>;
    sendError(id: C['id'], message: Message, code?: number, reason?: string): Promise<void>;
    broadcastMessage(message: Message, exceptions?: C['id'][]): Promise<void>;
    broadcastJsonMessage(message: Message, exceptions?: C['id'][]): Promise<void>;
    broadcastError(message: Message, code?: number, reason?: string, exceptions?: C['id'][]): Promise<void>;
}
