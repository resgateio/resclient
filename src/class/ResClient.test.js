import { Server } from 'mock-socket';
import ResClient from './ResClient.js';
import ResModel from './ResModel.js';
import ResCollection from './ResCollection.js';

class ResServer extends Server {
	constructor(url) {
		super(url);

		this.error = null;
		this.requests = [];
		this.usedRequestIds = {};
		this.on('message', this._onMessage.bind(this));
	}

	isConnected() {
		return this.clients().length > 0;
	}

	getNextRequest() {
		return this.requests.shift();
	}

	pendingRequests() {
		return this.requests.length;
	}

	sendResponse(req, result) {
		let json = JSON.stringify({ id: req.id, result });
		this.send(json);
	}

	sendError(req, code, message, data) {
		let obj = { id: req.id, error: { code, message }};
		if (data) {
			obj.error.data = data;
		}
		let json = JSON.stringify(obj);
		this.send(json);
	}

	sendEvent(rid, event, data) {
		let json = JSON.stringify({ event: rid + '.' + event, data });
		this.send(json);
	}

	_onMessage(msg) {
		let req;
		try {
			req = JSON.parse(msg);
		} catch (ex) {
			this.error = new Error("Invalid request: " + msg);
			return;
		}

		if (!req.hasOwnProperty('id')) {
			this.error = new Error("Request missing id property: " + msg);
			return;
		}

		if (!req.hasOwnProperty('method')) {
			this.error = new Error("Request missing method property: " + msg);
			return;
		}

		if (this.usedRequestIds[req.id]) {
			this.error = new Error("Multiple request with the same id property: " + msg);
		}
		this.usedRequestIds[req.id] = true;

		this.requests.push(req);
	}
}

describe("ResClient", () => {

	let port = 1000;
	let server;
	let client;
	let cb;
	let cb2;
	const modelData = {
		foo: "bar",
		int: 42
	};
	const collectionData = [
		{ rid: 'service.item.10', data: { id: 10, name: "Ten" }},
		{ rid: 'service.item.20', data: { id: 20, name: "Twenty" }},
		{ rid: 'service.item.30', data: { id: 30, name: "Thirty" }}
	];

	function flushPromises(depth = 2) {
		return new Promise(resolve => setImmediate(() => {
			depth--;
			if (depth) {
				flushPromises(depth).then(resolve);
			} else {
				resolve();
			}
		}));
	}

	function flushRequests(depth = 2, time = 10) {
		jest.advanceTimersByTime(time);
		return new Promise(resolve => setImmediate(() => {
			depth--;
			if (depth) {
				flushRequests(depth).then(resolve);
			} else {
				resolve();
			}
		}));
	}

	function waitAWhile(time = 10000) {
		jest.advanceTimersByTime(time);
		return flushPromises();
	}

	function getServerResource(rid, data, collectionFactory) {
		let promise = client.getResource(rid, collectionFactory);

		return flushRequests().then(() => {
			expect(server.error).toBe(null);
			let req = server.getNextRequest();
			expect(req).not.toBe(undefined);
			expect(req.method).toBe('subscribe.' + rid);
			server.sendResponse(req, data);
			return flushRequests().then(() => promise);
		});
	}

	jest.useFakeTimers();

	beforeEach(() => {
		let url = "ws://localhost:" + port;
		port++;
		server = new ResServer(url);
		client = new ResClient(url);
		cb = jest.fn();
		cb2 = jest.fn();
	});

	afterEach(() => {
		server.stop();
	});

	describe("connect", () => {

		it("resolves relative url paths", () => {
			client = new ResClient('/ws');
			// a.href doesn't work the same in jest as in a browser
			// Cannot validate the result
		});

		it("connects on connect", (done) => {
			client.connect();
			jest.runAllTimers();
			expect(server.isConnected()).toBe(true);
			done();
		});

		it("connects on getResource", () => {
			client.getResource('service.test');

			return flushPromises().then(() => {
				expect(server.isConnected()).toBe(true);
			});
		});

		it("disconnects on disconnect", () => {
			let promise = client.connect().then(() => {
				client.disconnect();
				jest.runAllTimers();
				expect(server.isConnected()).toBe(false);
			});
			jest.runOnlyPendingTimers();
			return promise;
		});
	});

	describe("getResource model", () => {

		it("gets model resource from server", () => {
			let promise = client.getResource('service.model').then(model => {
				expect(model.foo).toBe("bar");
			});

			return flushRequests().then(() => {
				expect(server.error).toBe(null);
				let req = server.getNextRequest();
				expect(req).not.toBe(undefined);
				expect(req.method).toBe('subscribe.service.model');
				server.sendResponse(req, modelData);
				jest.runOnlyPendingTimers();
				expect(server.error).toBe(null);
				expect(server.pendingRequests()).toBe(0);

				return promise;
			});
		});

		it("gets model resource from cache on second request", () => {
			return getServerResource('service.model', modelData).then(model => {
				return client.getResource('service.model').then(modelSecond => {
					expect(model).toBe(modelSecond);

					return flushRequests().then(() => {
						let req = server.getNextRequest();
						expect(req).toBe(undefined);
					});
				});
			});
		});

		it("unsubscribes model not listened to, removing it from cache", () => {
			return getServerResource('service.model', modelData).then(model => {
				// Cause unsubscribe by waiting
				return waitAWhile().then(flushRequests).then(() => {
					expect(server.error).toBe(null);
					let req = server.getNextRequest();
					expect(req).not.toBe(undefined);
					expect(req.method).toBe('unsubscribe.service.model');
					server.sendResponse(req, null);

					// Wait for the unsubscribe response
					return flushRequests().then(() => {
						expect(server.error).toBe(null);

						return getServerResource('service.model', modelData).then(modelSecond => {
							expect(model).not.toBe(modelSecond);

							let req = server.getNextRequest();
							expect(req).toBe(undefined);
						});
					});
				});
			});
		});

		it("rejects the promise on error", () => {
			let promise = client.getResource('service.model');

			return flushRequests().then(() => {
				let req = server.getNextRequest();
				server.sendError(req, 'system.notFound', "Not found");
				jest.runOnlyPendingTimers();
				expect(server.error).toBe(null);
				expect(server.pendingRequests()).toBe(0);

				return expect(promise).rejects.toEqual(expect.objectContaining({
					code: 'system.notFound',
					message: "Not found"
				}));
			});
		});
	});

	describe("getResource collection", () => {

		it("gets collection resource from server", () => {
			let promise = client.getResource('service.collection').then(collection => {
				expect(server.error).toBe(null);
				expect(server.pendingRequests()).toBe(0);

				expect(collection.length).toBe(3);
				expect(collection.atIndex(0).name).toBe("Ten");
				expect(collection.atIndex(1).name).toBe("Twenty");
				expect(collection.atIndex(2).name).toBe("Thirty");
			});

			return flushRequests().then(() => {
				let req = server.getNextRequest();
				expect(req).not.toBe(undefined);
				expect(req.method).toBe('subscribe.service.collection');
				server.sendResponse(req, collectionData);

				return flushRequests().then(() => promise);
			});
		});

		it("gets collection resource and collection models from cache on second request", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				return client.getResource('service.collection').then(collectionSecond => {
					expect(collection).toBe(collectionSecond);

					// Test that collection models are also taken from cache
					return client.getResource(collectionData[0].rid).then(model => {
						expect(model.name).toBe("Ten");

						return flushRequests().then(() => {
							let req = server.getNextRequest();
							expect(req).toBe(undefined);
						});
					});
				});
			});
		});

		it("gets collection model from cache if already loaded", () => {
			return getServerResource(collectionData[0].rid, collectionData[0].data).then(model => {
				return getServerResource('service.collection', [
					{ rid: collectionData[0].rid },
					collectionData[1],
					collectionData[2]
				]).then(collection => {
					expect(collection.atIndex(0)).toBe(model);
					return flushRequests().then(() => {
						let req = server.getNextRequest();
						expect(req).toBe(undefined);
					});
				});
			});
		});

		it("unsubscribes collection and its models not listened to, removing it from cache", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				let model = collection.atIndex(0);

				// Cause unsubscribe by waiting
				return waitAWhile().then(flushRequests).then(() => {
					expect(server.error).toBe(null);
					let req = server.getNextRequest();
					expect(req).not.toBe(undefined);
					expect(req.method).toBe('unsubscribe.service.collection');
					server.sendResponse(req, null);

					// Wait for the unsubscribe response
					return flushRequests().then(() => {
						expect(server.error).toBe(null);

						// Get model again
						return getServerResource(collectionData[0].rid, collectionData[0].data).then(modelSecond => {
							expect(model).not.toBe(modelSecond);

							// Get collection again
							return getServerResource('service.collection', [
								{ rid: collectionData[0].rid },
								collectionData[1],
								collectionData[2]
							]).then(collectionSecond => {
								expect(collection).not.toBe(collectionSecond);
								expect(collectionSecond.atIndex(0)).toBe(modelSecond);

								return flushRequests().then(() => {
									let req = server.getNextRequest();
									expect(req).toBe(undefined);
								});
							});
						});
					});
				});
			});
		});
	});

	describe("model.on", () => {

		it("does not unsubscribe to model being listened to", () => {
			return getServerResource('service.model', modelData).then(model => {
				model.on('change', cb);

				return waitAWhile().then(flushRequests).then(() => {
					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("unsubscribes to model after it is no longer listened to", () => {
			return getServerResource('service.model', modelData).then(model => {
				model.on('change', cb);
				model.on('change', cb2);

				return waitAWhile().then(flushRequests).then(() => {
					model.off('change', cb);

					return waitAWhile().then(flushRequests).then(() => {
						let req = server.getNextRequest();
						expect(req).toBe(undefined);
						model.off('change', cb2);

						return waitAWhile().then(flushRequests).then(() => {
							expect(server.error).toBe(null);
							let req = server.getNextRequest();
							expect(req).not.toBe(undefined);
							expect(req.method).toBe('unsubscribe.service.model');
							server.sendResponse(req, null);

							// Wait for the unsubscribe response
							return flushRequests().then(() => {
								expect(server.error).toBe(null);

								return getServerResource('service.model', modelData).then(modelSecond => {
									expect(model).not.toBe(modelSecond);

									let req = server.getNextRequest();
									expect(req).toBe(undefined);
								});
							});
						});
					});
				});
			});
		});

		it("emits a change event on change", () => {
			return getServerResource('service.model', modelData).then(model => {
				model.on('change', cb);

				server.sendEvent('service.model', 'change', { foo: 'baz' });
				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(1);
					expect(cb.mock.calls[0][0]).toEqual({ foo: 'bar' });
					expect(cb.mock.calls[0][1]).toBe(model);
					expect(model.foo).toBe('baz');

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("emits a custom event", () => {
			return getServerResource('service.model', modelData).then(model => {
				model.on('custom', cb);

				server.sendEvent('service.model', 'custom', { foo: 'baz' });
				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(1);
					expect(cb.mock.calls[0][0]).toEqual({ foo: 'baz' });
					expect(cb.mock.calls[0][1]).toBe(model);
					expect(model.foo).toBe('bar');

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});
	});

	describe("collection.on", () => {

		it("does not unsubscribe to collection being listened to", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				collection.on('add', cb);

				return waitAWhile().then(flushRequests).then(() => {
					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("subscribes to listened models before unsubscribing to the collection", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				let model = collection.atIndex(0);
				model.on('change', cb);

				// Cause unsubscribe by waiting
				return waitAWhile().then(flushRequests).then(() => {
					expect(server.error).toBe(null);
					let subReq = server.getNextRequest();
					expect(subReq).not.toBe(undefined);
					expect(subReq.method).toBe('subscribe.' + collectionData[0].rid);
					server.sendResponse(subReq, null);

					let unsubReq = server.getNextRequest();
					expect(unsubReq).not.toBe(undefined);
					expect(unsubReq.method).toBe('unsubscribe.service.collection');
					server.sendResponse(unsubReq, null);

					// Wait for the subscribe and unsubscribe response
					return flushRequests().then(() => {
						expect(server.error).toBe(null);

						// Get model from cache
						return client.getResource(collectionData[0].rid).then(modelSecond => {
							expect(model).toBe(modelSecond);

							return flushRequests().then(() => {
								let req = server.getNextRequest();
								expect(req).toBe(undefined);
							});
						});
					});
				});
			});
		});

		it("unsubscribes to previously subscribed model while included in collection", () => {
			// Get model
			return getServerResource(collectionData[0].rid, collectionData[0].data).then(model => {
				// Get collection
				return getServerResource('service.collection', [
					{ rid: collectionData[0].rid },
					collectionData[1],
					collectionData[2]
				]).then(collection => {
					expect(collection.atIndex(0)).toBe(model);

					return waitAWhile().then(flushRequests).then(() => {
						expect(server.error).toBe(null);
						let modelOrCollection = [ 'unsubscribe.service.collection', 'unsubscribe.' + collectionData[0].rid ];

						let req1 = server.getNextRequest();
						expect(req1).not.toBe(undefined);
						expect(modelOrCollection).toContain(req1.method);
						server.sendResponse(req1, null);

						let req2 = server.getNextRequest();
						expect(req2).not.toBe(undefined);
						expect(modelOrCollection).toContain(req2.method);
						server.sendResponse(req2, null);

						expect(req1.method).not.toBe(req2.method);

						let req = server.getNextRequest();
						expect(req).toBe(undefined);
					});
				});
			});
		});

		it("emits an add event on add", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				collection.on('add', cb);

				server.sendEvent('service.collection', 'add', { rid: 'service.item.35', data: { id: 35, name: "Thirtyfive" }, idx: 3 });
				server.sendEvent('service.collection', 'add', { rid: 'service.item.15', data: { id: 15, name: "Fifteen" }, idx: 1 });
				server.sendEvent('service.collection', 'add', { rid: 'service.item.5', data: { id: 5, name: "Five" }, idx: 0 });

				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(3);
					expect(collection.length).toBe(6);

					expect(cb.mock.calls[0][0]).toEqual({ idx: 3, item: collection.atIndex(5) });
					expect(cb.mock.calls[0][1]).toBe(collection);

					expect(cb.mock.calls[1][0]).toEqual({ idx: 1, item: collection.atIndex(2) });
					expect(cb.mock.calls[1][1]).toBe(collection);

					expect(cb.mock.calls[2][0]).toEqual({ idx: 0, item: collection.atIndex(0) });
					expect(cb.mock.calls[2][1]).toBe(collection);

					expect(collection.atIndex(0).name).toBe("Five");
					expect(collection.atIndex(1).name).toBe("Ten");
					expect(collection.atIndex(2).name).toBe("Fifteen");
					expect(collection.atIndex(3).name).toBe("Twenty");
					expect(collection.atIndex(4).name).toBe("Thirty");
					expect(collection.atIndex(5).name).toBe("Thirtyfive");

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("emits a remove event on remove", () => {
			return getServerResource('service.collection', [
				collectionData[0],
				{ rid: 'service.item.15', data: { id: 15, name: "Fifteen" }},
				collectionData[1],
				{ rid: 'service.item.25', data: { id: 25, name: "Twentyfive" }},
				collectionData[2]
			]).then(collection => {
				collection.on('remove', cb);

				let model10 = collection.atIndex(0);
				let model20 = collection.atIndex(2);
				let model30 = collection.atIndex(4);

				server.sendEvent('service.collection', 'remove', { rid: 'service.item.10', idx: 0 });
				server.sendEvent('service.collection', 'remove', { rid: 'service.item.20', idx: 1 });
				server.sendEvent('service.collection', 'remove', { rid: 'service.item.30', idx: 2 });

				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(3);
					expect(collection.length).toBe(2);

					expect(cb.mock.calls[0][0]).toEqual({ idx: 0, item: model10 });
					expect(cb.mock.calls[0][1]).toBe(collection);

					expect(cb.mock.calls[1][0]).toEqual({ idx: 1, item: model20 });
					expect(cb.mock.calls[1][1]).toBe(collection);

					expect(cb.mock.calls[2][0]).toEqual({ idx: 2, item: model30 });
					expect(cb.mock.calls[2][1]).toBe(collection);

					expect(collection.atIndex(0).name).toBe("Fifteen");
					expect(collection.atIndex(1).name).toBe("Twentyfive");

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("sets a listened model as stale when removed, subscribing to it after a while", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				let model = collection.atIndex(0);
				collection.on('remove', cb);
				model.on('change', cb2);
				server.sendEvent('service.collection', 'remove', { rid: collectionData[0].rid, idx: 0 });

				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(1);
					expect(collection.length).toBe(2);

					expect(cb.mock.calls[0][0]).toEqual({ idx: 0, item: model });
					expect(cb.mock.calls[0][1]).toBe(collection);

					expect(server.pendingRequests()).toBe(0);

					return waitAWhile().then(flushRequests).then(() => {
						let req = server.getNextRequest();
						expect(req).not.toBe(undefined);
						expect(req.method).toBe('subscribe.' + collectionData[0].rid);
						server.sendResponse(req, {
							id: 10,
							name: "X"
						});

						return flushRequests().then(() => {
							expect(cb2.mock.calls.length).toBe(1);
							expect(cb2.mock.calls[0][0]).toEqual({ name: "Ten" });
							expect(cb2.mock.calls[0][1]).toBe(model);
							expect(model.name).toBe("X");

							expect(server.error).toBe(null);
							expect(server.pendingRequests()).toBe(0);
						});
					});
				});
			});
		});
	});

	describe("reconnect", () => {

		it("reconnects after connection is lost", () => {
			let promise = client.connect()
				.then(() => {
					let oldUrl = server.url;
					expect(server.isConnected()).toBe(true);
					server.close();
					return flushPromises().then(() => {
						server = new ResServer(oldUrl);
						expect(server.isConnected()).toBe(false);

						return waitAWhile().then(flushPromises).then(() => {
							expect(server.isConnected()).toBe(true);
						});
					});
				});
			return flushRequests().then(() => promise);
		});

		it("resubscribes to a model after reconnect", () => {
			return getServerResource('service.model', modelData).then(model => {
				model.on('change', cb);
				let oldUrl = server.url;
				server.close();

				return flushPromises().then(() => {
					server = new ResServer(oldUrl);

					return waitAWhile().then(flushRequests).then(() => {
						expect(server.error).toBe(null);
						let req = server.getNextRequest();
						expect(req).not.toBe(undefined);
						expect(req.method).toBe('subscribe.service.model');
						server.sendResponse(req, modelData);

						return flushRequests().then(() => {
							expect(server.error).toBe(null);
							expect(server.pendingRequests()).toBe(0);
						});
					});
				});
			});
		});

		it("emits a change event when resubscribed model differs from cached model", () => {
			return getServerResource('service.model', modelData).then(model => {
				model.on('change', cb);
				let oldUrl = server.url;
				server.close();

				return flushPromises().then(() => {
					server = new ResServer(oldUrl);

					return waitAWhile().then(flushRequests).then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, {
							foo: "baz",
							int: 42
						});

						return flushRequests().then(() => {
							expect(cb.mock.calls.length).toBe(1);
							expect(cb.mock.calls[0][0]).toEqual({ foo: 'bar' });
							expect(cb.mock.calls[0][1]).toBe(model);
							expect(model.foo).toBe('baz');

							expect(server.error).toBe(null);
							expect(server.pendingRequests()).toBe(0);
						});
					});
				});
			});
		});

		it("emits remove and add events when collection differs from cached collection", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				let oldUrl = server.url;
				collection.on('remove', cb);
				collection.on('add', cb2);
				server.close();

				return flushPromises().then(() => {
					server = new ResServer(oldUrl);

					return waitAWhile().then(flushRequests).then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, [
							collectionData[0],
							{ rid: 'service.item.15', data: { id: 15, name: "Fifteen" }},
							collectionData[2]
						]);

						return flushRequests().then(() => {
							expect(collection.length).toBe(3);
							expect(cb.mock.calls.length).toBe(1);
							expect(cb.mock.calls[0][1]).toBe(collection);
							expect(cb2.mock.calls.length).toBe(1);
							expect(cb2.mock.calls[0][1]).toBe(collection);

							expect(server.error).toBe(null);
							expect(server.pendingRequests()).toBe(0);
						});
					});
				});
			});
		});
	});

	describe("modelType", () => {

		it("uses the registered model type when creating a model instance", () => {
			client.registerModelType({
				id: 'service.item',
				modelFactory: (api, rid, data) => {
					return new ResModel(api, rid, data, {
						definition: {
							id: { type: 'number' },
							name: { type: 'string' },
							flag: { type: 'boolean', default: true }
						}
					});
				}
			});

			return getServerResource('service.collection', collectionData).then(collection => {
				expect(collection.atIndex(0).flag).toBe(true);
				expect(collection.atIndex(1).flag).toBe(true);
				expect(collection.atIndex(1).flag).toBe(true);
			});
		});

		it("does not use an unregistered model type when creating a model instance", () => {
			client.registerModelType({
				id: 'service.item',
				modelFactory: (api, rid, data) => {
					return new ResModel(api, rid, data, {
						definition: {
							id: { type: 'number' },
							name: { type: 'string' },
							flag: { type: 'boolean', default: true }
						}
					});
				}
			});

			client.unregisterModelType('service.item');

			return getServerResource('service.collection', collectionData).then(collection => {
				expect(collection.atIndex(0).flag).toBe(undefined);
				expect(collection.atIndex(1).flag).toBe(undefined);
				expect(collection.atIndex(1).flag).toBe(undefined);
			});
		});

		it("creates a collecting using collectionFactory callback function", () => {
			let promise = client.getResource('service.collection', (api, rid, data) => {
				let c = new ResCollection(api, rid, data);
				c.flag = true;
				return c;
			}).then(collection => {
				expect(collection.flag).toBe(true);
			});

			return flushRequests().then(() => {
				let req = server.getNextRequest();
				expect(req).not.toBe(undefined);
				expect(req.method).toBe('subscribe.service.collection');
				server.sendResponse(req, collectionData);

				return flushRequests().then(() => promise);
			});
		});
	});

	describe("ResModel", () => {

		it("calls remote method on call with parameters", () => {
			return getServerResource('service.model', modelData).then(model => {
				model.call('test', { zoo: "baz", value: 12 });

				return flushRequests().then(() => {
					expect(server.pendingRequests()).toBe(1);
					expect(server.error).toBe(null);
					let req = server.getNextRequest();
					expect(req.method).toBe('call.service.model.test');
					expect(req.params).toEqual({ zoo: "baz", value: 12 });
				});
			});
		});

		it("calls remote method on call without parameters", () => {
			return getServerResource('service.model', modelData).then(model => {
				model.call('test');
				return flushRequests().then(() => {
					let req = server.getNextRequest();
					expect([ null, undefined ]).toContain(req.params);
				});
			});
		});

		it("calls set method on set", () => {
			return getServerResource('service.model', modelData).then(model => {
				model.set({ foo: "baz" });
				return flushRequests().then(() => {
					let req = server.getNextRequest();
					expect(req.method).toBe('call.service.model.set');
					expect(req.params).toEqual({ foo: "baz" });
				});
			});
		});

		it("resolves call promise on success", () => {
			return getServerResource('service.model', modelData).then(model => {
				let promise = model.call('test');

				return flushRequests().then(() => {
					let req = server.getNextRequest();
					server.sendResponse(req, { responseValue: true });

					return flushRequests().then(() => {
						return expect(promise).resolves.toEqual({ responseValue: true });
					});
				});
			});
		});

		it("rejects call promise on error", () => {
			return getServerResource('service.model', modelData).then(model => {
				let promise = model.call('test');

				return flushRequests().then(() => {
					let req = server.getNextRequest();
					expect(req).not.toBe(undefined);
					server.sendError(req, 'service.testError', "Test error");

					return expect(promise).rejects.toEqual(expect.objectContaining({
						code: 'service.testError',
						message: "Test error"
					}));
				});
			});
		});

		it("creates anonymous object on toJSON", () => {
			return getServerResource('service.model', { foo: "bar", value: 10 }).then(model => {
				expect(model.toJSON()).toEqual({ foo: "bar", value: 10 });
			});
		});

		it("creates anonymous object on toJSON using definition", () => {
			client.registerModelType({
				id: 'service.model',
				modelFactory: (api, rid, data) => {
					return new ResModel(api, rid, data, {
						definition: {
							foo: { type: 'string' },
							value: { type: 'number', default: 10 },
							notProvided: { type: 'string', default: "Not provided" }
						}
					});
				}
			});

			return getServerResource('service.model', {
				foo: "bar",
				value: 12,
				notDefined: "Not defined"
			}).then(model => {
				expect(model.toJSON()).toEqual({
					foo: "bar",
					value: 12,
					notProvided: "Not provided"
				});
			});
		});
	});

	describe("ResCollection", () => {

		it("calls new method on create", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				collection.create({ foo: "baz" });
				return flushRequests().then(() => {
					let req = server.getNextRequest();
					expect(req.method).toBe('call.service.collection.new');
					expect(req.params).toEqual({ foo: "baz" });
				});
			});
		});

		it("calls remove method on remove", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				collection.remove('service.item.10');
				return flushRequests().then(() => {
					let req = server.getNextRequest();
					expect(req.method).toBe('call.service.collection.remove');
					expect(req.params).toEqual({ rid: 'service.item.10' });
				});
			});
		});

		it("getResourceId returns the collection resource ID", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				expect(collection.getResourceId()).toBe('service.collection');
			});
		});

		it("getResourceId returns the collection resource ID", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				expect(collection.getResourceId()).toBe('service.collection');
			});
		});

		it("length gets the collection length", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				expect(collection.length).toBe(3);
			});
		});

		it("get returns the model using resource ID without idAttribute set", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				expect(collection.get('service.item.10').toJSON()).toEqual({ id: 10, name: "Ten" });
				expect(collection.get('service.item.20').toJSON()).toEqual({ id: 20, name: "Twenty" });
				expect(collection.get('service.item.30').toJSON()).toEqual({ id: 30, name: "Thirty" });
			});
		});

		it("get returns the model using ID with idAttribute set", () => {
			return getServerResource('service.collection', collectionData, (api, rid, data) => {
				return new ResCollection(api, rid, data, {
					idAttribute: m => m.id
				});
			}).then(collection => {
				expect(collection.get(10).toJSON()).toEqual({ id: 10, name: "Ten" });
				expect(collection.get(20).toJSON()).toEqual({ id: 20, name: "Twenty" });
				expect(collection.get(30).toJSON()).toEqual({ id: 30, name: "Thirty" });
			});
		});

		it("indexOf gets the index of a model using resource ID without idAttribute set", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				expect(collection.indexOf('service.item.10')).toBe(0);
				expect(collection.indexOf('service.item.20')).toBe(1);
				expect(collection.indexOf('service.item.30')).toBe(2);
			});
		});

		it("indexOf gets the index of a model using ID with idAttribute set", () => {
			return getServerResource('service.collection', collectionData, (api, rid, data) => {
				return new ResCollection(api, rid, data, {
					idAttribute: m => m.id
				});
			}).then(collection => {
				expect(collection.indexOf(10)).toBe(0);
				expect(collection.indexOf(20)).toBe(1);
				expect(collection.indexOf(30)).toBe(2);
			});
		});

		it("indexOf gets the index of a model", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				let model10 = collection.atIndex(0);
				let model20 = collection.atIndex(1);
				let model30 = collection.atIndex(2);
				expect(collection.indexOf(model10)).toBe(0);
				expect(collection.indexOf(model20)).toBe(1);
				expect(collection.indexOf(model30)).toBe(2);
			});
		});

		it("atIndex returns model at given index", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				expect(collection.atIndex(0).toJSON()).toEqual({ id: 10, name: "Ten" });
				expect(collection.atIndex(1).toJSON()).toEqual({ id: 20, name: "Twenty" });
				expect(collection.atIndex(2).toJSON()).toEqual({ id: 30, name: "Thirty" });
			});
		});

		it("implements iterable", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				let i = 0;
				for (let model of collection) {
					expect(model.id).toBe(collectionData[i].data.id);
					expect(model.name).toBe(collectionData[i].data.name);
					i++;
				}
			});
		});

		it("creates anonymous array on toJSON", () => {
			return getServerResource('service.collection', collectionData).then(collection => {
				expect(collection.toJSON()).toEqual([
					{ id: 10, name: "Ten" },
					{ id: 20, name: "Twenty" },
					{ id: 30, name: "Thirty" }
				]);
			});
		});
	});
});
