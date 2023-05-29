import type * as FN from '../../types';
import { Gossiper } from '../../src/gossiper';
import { describe, test, expect, beforeEach } from 'vitest';

type NodeGossipPayload = {
    from: string;
} & FN.Gossip.Payload;

type NodeType = {
    id: string;
    otherNodes: string[];
    randomNumber: number;
    gossiper: NodesGossiper;

    getRandomNumbersOfOtherNodes(): Promise<number[]>;
}

let nodes: { [peer: string]: NodeType }  = {};

class Node implements NodeType {
    id: string;
    otherNodes: string[];
    randomNumber: number;
    gossiper: NodesGossiper;

    constructor(init) {
        this.id = init.id;
        this.otherNodes = init.otherNodes;
        this.randomNumber = init.randomNumber;
        this.gossiper = new NodesGossiper();

        this.gossiper.registerProtocol({
            protocol: 'getRandomNumber',
            responseResolver: (async (payload) => {
                return { randomNumber: this.randomNumber };
            }) as FN.Gossip.Response,
        });
    }

    async getRandomNumbersOfOtherNodes(): Promise<number[]> {
        const responses = Promise.all(await this.gossiper.sendRequestToPeers(
            'getRandomNumber',
            this.otherNodes,
            { from: this.id },
        ));

        return responses;
    }
}

class NodesGossiper extends Gossiper {
    async sendRequestToPeers(
        protocol: string,
        peers: string[],
        message: NodeGossipPayload,
    ): Promise<FN.Gossip.Response[]> {
        return peers.map(async (peer) => nodes[peer].gossiper.resolveResponse(protocol, message));
    }
}

beforeEach(() => {
    nodes = {};

    nodes.node1 = new Node({
        id: 'node1',
        otherNodes: ['node2', 'node3'],
        randomNumber: Math.random() * 1e5,
    });

    nodes.node2 = new Node({
        id: 'node2',
        otherNodes: ['node1', 'node3'],
        randomNumber: Math.random() * 1e5,
    });

    nodes.node3 = new Node({
        id: 'node3',
        otherNodes: ['node1', 'node2'],
        randomNumber: Math.random() * 1e5,
    });
});

describe('gossiper/distributed', () => {
    test('distribute', async () => {
        const responses = await nodes.node1.getRandomNumbersOfOtherNodes();

        expect(responses).toEqual([
            { randomNumber: nodes.node2.randomNumber },
            { randomNumber: nodes.node3.randomNumber },
        ]);
    });
});
