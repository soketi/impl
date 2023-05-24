import type * as FN from '@soketi/impl';

export class Webhook {
    batch: FN.Webhooks.WebhookPayload[] = [];
    batchHasLeader = false;
    static eventHandlers = new Map<string, ((payload: FN.Webhooks.WebhookPayload) => Promise<void>)[]>();

    static onEvent(event: string, cb: (payload: FN.Webhooks.WebhookPayload) => Promise<void>): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, [cb.bind(this)]);
        }

        this.eventHandlers.get(event).push(cb.bind(this));
    }

    protected async send(event: string, data: FN.Webhooks.WebhookPayload): Promise<void> {
        if (!Webhook.eventHandlers.has(event)) {
            return;
        }

        for await (let cb of Webhook.eventHandlers.get(event)) {
            await cb(data);
        }
    }

    async processWebhook(event: string, data: FN.Webhooks.WebhookPayload): Promise<void> {
        if (!Webhook.eventHandlers.has(event)) {
            return;
        }

        for await (let cb of Webhook.eventHandlers.get(event)) {
            await cb(data);
        }
    }
}
