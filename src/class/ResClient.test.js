import { Server } from 'mock-socket';
import ResClient from './ResClient.js';

describe('ResClient', () => {

	const url = "ws://localhost:8080/";
	let client;

	jest.useFakeTimers();

	describe('connect', () => {

		it('connects on getResource', (done) => {

			const server = new Server(url);
			let connected = false;
			server.on('connection', server => {
				connected = true;
			});

			client = new ResClient(url);
			client.getResource('service.model');

			jest.runOnlyPendingTimers();

			expect(connected).toBe(true);
			server.stop(done);
		});
	});
});
