import { Brain } from '../../brain';
import { BrainMetrics } from '../../metrics';
import { PusherConnections } from '../ws';

export class PusherBrainMetrics extends BrainMetrics {
    constructor(
        readonly brain: Brain,
        readonly connections: PusherConnections,
    ) {
        super(brain, connections);
    }

    async snapshot(namespace: string): Promise<void> {
        this.snapshotInProgress = true;

        await this.brain.set(`metrics:${namespace}`, {
            total_connections: this.connections.connections.size,
            channels: [...this.connections.channels].map(([channel, connections]) => ({
                channel,
                connections: connections.size,
            })),
            users: [...this.connections.users].map(([user, connections]) => ({
                user,
                connections,
            })),
            started: this.connections.started.toISOString(),
            ...this.metrics[namespace] || {},
        });

        this.snapshotInProgress = false;
    }
}
