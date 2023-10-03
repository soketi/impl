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
    send<M>(message: M): Promise<void>;
    sendJson<M>(message: M): Promise<void>;
    sendError<M>(message: M, code?: number, reason?: string): Promise<void>;
    close(code?: number, reason?: string): Promise<void>;
    sendThenClose<M>(message: M, code?: number, reason?: string): Promise<void>;
    sendJsonThenClose<M>(message: M, code?: number, reason?: string): Promise<void>;
    sendErrorThenClose<M>(message: M, code?: number, reason?: string): Promise<void>;
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
    send: <Message = M>(message: Message) => Promise<void>;
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
    send<M = Message>(namespace: string, id: C['id'], message: M): Promise<void>;
    sendJson<M = Message>(namespace: string, id: C['id'], message: M): Promise<void>;
    sendError<M = Message>(namepsace: string, id: C['id'], message: M, code?: number, reason?: string): Promise<void>;
    broadcastMessage<M = Message>(namespace: string, message: M, exceptions?: C['id'][]): Promise<void>;
    broadcastJsonMessage<M = Message>(namespace: string, message: M, exceptions?: C['id'][]): Promise<void>;
    broadcastError<M = Message>(namespace: string, message: M, code?: number, reason?: string, exceptions?: C['id'][]): Promise<void>;
}
