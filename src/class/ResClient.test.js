import { Server } from 'mock-socket';
import ResClient from './ResClient.js';
import ResModel from './ResModel.js';
import ResCollection from './ResCollection.js';
import ResRef from './ResRef.js';

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
	let recordedEvents;
	let eventRecorder = (event) => jest.fn(e => recordedEvents.push(Object.assign(e, { event })));
	const modelData = {
		foo: "bar",
		int: 42,
		ref: { rid: 'service.model.soft', soft: true },
		dta: { data: { foo: [ "bar" ] }}
	};
	const modelDataJson = {
		foo: "bar",
		int: 42,
		ref: { rid: 'service.model.soft' },
		dta: { foo: [ "bar" ] }
	};
	const modelResources = {
		models: {
			"service.model": modelData
		}
	};
	const collectionModels = {
		'service.item.10': { id: 10, name: "Ten" },
		'service.item.20': { id: 20, name: "Twenty" },
		'service.item.30': { id: 30, name: "Thirty" }
	};
	const collectionData = [
		{ rid: 'service.item.10' },
		{ rid: 'service.item.20' },
		{ rid: 'service.item.30' }
	];
	const collectionResources = {
		models: collectionModels,
		collections: {
			'service.collection': collectionData
		}
	};
	const primitiveCollectionData = [
		"foo",
		42,
		true,
		false,
		null,
		{ rid: "service.model.soft", soft: true }
	];
	const primitiveCollectionResources = {
		collections: {
			'service.primitives': primitiveCollectionData
		}
	};
	const modelReferenceResources = {
		rid: "service.model.ref",
		models: {
			"service.model.ref": modelData
		}
	};

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

	// Gets the resgate protocol version, while sending supported version.
	function getVersion(resgateProtocol) {
		resgateProtocol = resgateProtocol === undefined ? client.supportedProtocol : resgateProtocol;
		return flushRequests().then(() => {
			expect(server.error).toBe(null);
			let req = server.getNextRequest();
			expect(req).not.toBe(undefined);
			expect(req.method).toBe('version');
			expect(req.params).toEqual({ protocol: client.supportedProtocol });
			if (!resgateProtocol) {
				server.sendError(req, 'system.invalidRequest', "Invalid request");
			} else {
				server.sendResponse(req, { protocol: resgateProtocol });
			}
			return flushRequests();
		});
	}

	function getServerResource(rid, data, collectionFactory, resgateProtocol) {
		let isConnected = server.isConnected();
		let promise = client.get(rid, collectionFactory);

		let p = isConnected
			? flushRequests()
			: getVersion(resgateProtocol);

		return p.then(() => {
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
		recordedEvents = [];
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
			client.get('service.test');

			return getVersion().then(() => {
				expect(server.error).toBe(null);
				expect(server.isConnected()).toBe(true);
			});
		});

		it("sends version request on getResource", () => {
			client.get('service.test');

			return flushRequests().then(() => {
				let req = server.getNextRequest();
				expect(req).not.toBe(undefined);
				expect(req.method).toBe('version');
			});
		});

		it("disconnects on disconnect", () => {
			let promise = client.connect();
			return getVersion()
				.then(promise)
				.then(() => {
					client.disconnect();
					jest.runAllTimers();
					expect(server.isConnected()).toBe(false);
				});
		});
	});

	describe("getResource model", () => {

		it("gets model resource from server", () => {
			let promise = client.get('service.model').then(model => {
				expect(model.foo).toBe("bar");
				expect(model.ref).toBeInstanceOf(ResRef);
				expect(model.ref.rid).toBe('service.model.soft');
				expect(model.dta.foo[0]).toBe("bar");
			});

			return getVersion().then(() => {
				expect(server.error).toBe(null);
				let req = server.getNextRequest();
				expect(req).not.toBe(undefined);
				expect(req.method).toBe('subscribe.service.model');
				server.sendResponse(req, modelResources);
				jest.runOnlyPendingTimers();
				expect(server.error).toBe(null);
				expect(server.pendingRequests()).toBe(0);

				return promise;
			});
		});

		it("gets model resource from cache on second request", () => {
			return getServerResource('service.model', modelResources).then(model => {
				expect(model.foo).toBe("bar");
				expect(model.dta.foo[0]).toBe("bar");
				return client.get('service.model').then(modelSecond => {
					expect(model).toBe(modelSecond);

					return flushRequests().then(() => {
						let req = server.getNextRequest();
						expect(req).toBe(undefined);
					});
				});
			});
		});

		it("unsubscribes model not listened to, removing it from cache", () => {
			return getServerResource('service.model', modelResources).then(model => {
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

						return getServerResource('service.model', modelResources).then(modelSecond => {
							expect(model).not.toBe(modelSecond);

							let req = server.getNextRequest();
							expect(req).toBe(undefined);
						});
					});
				});
			});
		});

		it("rejects the promise on error", () => {
			let promise = client.get('service.model');

			return getVersion().then(() => {
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

		it("unsubscribes model with count set to multiple direct subscriptions, when no longer listened to", () => {
			return getServerResource('service.model', modelResources).then(model => {
				let promise = model.call('test');

				return flushRequests().then(() => {
					let req = server.getNextRequest();
					server.sendResponse(req, { rid: "service.model" });

					return flushRequests()
						.then(() => promise)
						.then(m => {
							expect(m).toBe(model);
							// Cause unsubscribe by waiting
							return waitAWhile().then(flushRequests).then(() => {
								expect(server.error).toBe(null);
								// Expect single unsubscribe with count set to 2
								let req = server.getNextRequest();
								expect(req).not.toBe(undefined);
								expect(req.method).toBe('unsubscribe.service.model');
								expect(req.params).toEqual({ count: 2 });
								server.sendResponse(req, null);

								// Wait for the unsubscribe response
								return flushRequests().then(() => {
									expect(server.error).toBe(null);

									return getServerResource('service.model', modelResources).then(modelSecond => {
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

		it("unsubscribes model using multiple requests matching multiple direct subscriptions, when no longer listened to (protocol <= v1.2.0)", () => {
			return getServerResource('service.model', modelResources, null, "1.2.0").then(model => {
				let promise = model.call('test');

				return flushRequests().then(() => {
					let req = server.getNextRequest();
					server.sendResponse(req, { rid: "service.model" });

					return flushRequests()
						.then(() => promise)
						.then(m => {
							expect(m).toBe(model);
							// Cause unsubscribe by waiting
							return waitAWhile().then(flushRequests).then(() => {
								expect(server.error).toBe(null);
								// Expect 2 unsubscribes
								for (var i = 0; i < 2; i++) {
									let req = server.getNextRequest();
									expect(req).not.toBe(undefined);
									expect(req.method).toBe('unsubscribe.service.model');
									server.sendResponse(req, null);
								}

								// Wait for the unsubscribe response
								return flushRequests().then(() => {
									expect(server.error).toBe(null);

									return getServerResource('service.model', modelResources).then(modelSecond => {
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
	});

	describe("getResource collection", () => {

		it("gets primitive collection resource from server", () => {
			let promise = client.get('service.primitives').then(collection => {
				expect(server.error).toBe(null);
				expect(server.pendingRequests()).toBe(0);

				expect(collection.length).toBe(primitiveCollectionData.length);
				expect(collection.atIndex(0)).toBe("foo");
				expect(collection.atIndex(1)).toBe(42);
				expect(collection.atIndex(2)).toBe(true);
				expect(collection.atIndex(3)).toBe(false);
				expect(collection.atIndex(4)).toBe(null);
				expect(collection.atIndex(5)).toMatchObject({ rid: "service.model.soft" });
			});

			return getVersion().then(() => {
				let req = server.getNextRequest();
				expect(req).not.toBe(undefined);
				expect(req.method).toBe('subscribe.service.primitives');
				server.sendResponse(req, primitiveCollectionResources);

				return flushRequests().then(() => promise);
			});
		});

		it("gets model collection resource from server", () => {
			let promise = client.get('service.collection').then(collection => {
				expect(server.error).toBe(null);
				expect(server.pendingRequests()).toBe(0);

				expect(collection.length).toBe(3);
				expect(collection.atIndex(0).name).toBe("Ten");
				expect(collection.atIndex(1).name).toBe("Twenty");
				expect(collection.atIndex(2).name).toBe("Thirty");
			});

			return getVersion().then(() => {
				let req = server.getNextRequest();
				expect(req).not.toBe(undefined);
				expect(req.method).toBe('subscribe.service.collection');
				server.sendResponse(req, collectionResources);

				return flushRequests().then(() => promise);
			});
		});

		it("gets model collection resource and collection models from cache on second request", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				expect(collection.atIndex(0).name).toBe("Ten");
				return client.get('service.collection').then(collectionSecond => {
					expect(collection).toBe(collectionSecond);

					// Test that collection models are also taken from cache
					return client.get(collectionData[0].rid).then(model => {
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
			let rid = collectionData[0].rid;
			let models = {};
			models[rid] = collectionModels[rid];
			return getServerResource(rid, { models }).then(model => {
				models = Object.assign({}, collectionModels);
				delete models[rid];
				return getServerResource('service.collection', {
					models,
					collections: {
						'service.collection': collectionData
					}
				}).then(collection => {
					expect(collection.atIndex(0)).toBe(model);
					return flushRequests().then(() => {
						let req = server.getNextRequest();
						expect(req).toBe(undefined);
					});
				});
			});
		});

		it("unsubscribes collection and its models not listened to, removing it from cache", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
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
						let rid = collectionData[0].rid;
						let models = {};
						models[rid] = collectionModels[rid];
						return getServerResource(rid, { models }).then(modelSecond => {
							expect(model).not.toBe(modelSecond);
							// Get collection again
							models = Object.assign({}, collectionModels);
							delete models[rid];
							return getServerResource('service.collection', {
								models,
								collections: {
									'service.collection': collectionData
								}
							}).then(collectionSecond => {
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

	describe("on", () => {

		it("emits connect event on connect", () => {
			client.on('connect', cb);
			let promise = client.connect();
			return getVersion().then(promise).then(() => {
				jest.runAllTimers();
				expect(cb.mock.calls.length).toBe(1);
				expect(typeof cb.mock.calls[0][0]).toBe('object');
			});
		});

		it("emits disconnect event on disconnect", () => {
			client.on('disconnect', cb);
			let promise = client.connect();
			return getVersion().then(promise).then(() => {
				client.disconnect();
				jest.runAllTimers();
				expect(cb.mock.calls.length).toBe(1);
				expect(typeof cb.mock.calls[0][0]).toBe('object');
			});
		});

		it("emits error event on error", () => {
			client.on('error', cb);
			let promise = client.get('service.model');
			return getVersion().then(() => {
				let req = server.getNextRequest();
				server.sendError(req, 'system.notFound', "Not found");
				jest.runOnlyPendingTimers();

				return promise.catch(() => {
					jest.runAllTimers();
					expect(cb.mock.calls.length).toBe(1);
					expect(cb.mock.calls[0][0]).toEqual(expect.objectContaining({
						code: 'system.notFound',
						message: "Not found"
					}));
				});
			});
		});

	});

	describe("off", () => {

		it("does not emits connect event after connect after calling off", () => {
			client.on('connect', cb);
			client.off('connect', cb);
			return getVersion().then(client.connect()).then(() => {
				jest.runAllTimers();
				expect(cb.mock.calls.length).toBe(0);
			});
		});

		it("does not emits disconnect event on disconnect after calling off", () => {
			client.on('disconnect', cb);
			client.off('disconnect', cb);
			return getVersion().then(client.connect()).then(() => {
				client.disconnect();
				jest.runAllTimers();
				expect(cb.mock.calls.length).toBe(0);
			});
		});

		it("does not emits error event on error after calling off", () => {
			client.on('error', cb);
			client.off('error', cb);
			let promise = client.get('service.model');
			return getVersion().then(() => {
				let req = server.getNextRequest();
				server.sendError(req, 'system.notFound', "Not found");
				jest.runOnlyPendingTimers();

				return promise.catch(() => {
					jest.runAllTimers();
					expect(cb.mock.calls.length).toBe(0);
				});
			});
		});

	});

	describe("model.on", () => {

		it("does not unsubscribe to model being listened to", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('change', cb);

				return waitAWhile().then(flushRequests).then(() => {
					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("does not unsubscribe to model being listened to without handler", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on();

				return waitAWhile().then(flushRequests).then(() => {
					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("unsubscribes to model after it is no longer listened to", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('change', cb);
				model.on('change', cb2);

				return waitAWhile().then(flushRequests).then(() => {
					model.off('change', cb);

					return waitAWhile().then(flushRequests).then(() => {
						expect(server.pendingRequests()).toBe(0);
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

								return getServerResource('service.model', modelResources).then(modelSecond => {
									expect(model).not.toBe(modelSecond);
									expect(server.pendingRequests()).toBe(0);
								});
							});
						});
					});
				});
			});
		});

		it("unsubscribes to model after it is no longer listened to without handler", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on();

				return waitAWhile().then(flushRequests).then(() => {
					expect(server.pendingRequests()).toBe(0);
					model.off();

					return waitAWhile().then(flushRequests).then(() => {
						expect(server.error).toBe(null);
						let req = server.getNextRequest();
						expect(req).not.toBe(undefined);
						expect(req.method).toBe('unsubscribe.service.model');
						server.sendResponse(req, null);

						// Wait for the unsubscribe response
						return flushRequests().then(() => {
							expect(server.error).toBe(null);
						});
					});
				});
			});
		});

		it("does not unsubscribe to model re-listened to before unsubscribe delay", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('change', cb);

				return waitAWhile().then(flushRequests).then(() => {
					model.off('change', cb);

					return waitAWhile(1000).then(flushRequests).then(() => {
						model.on('change', cb2);

						return waitAWhile().then(flushRequests).then(() => {
							expect(server.pendingRequests()).toBe(0);
						});
					});
				});
			});
		});

		it("emits a change event on change", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('change', cb);

				server.sendEvent('service.model', 'change', { values: { foo: 'baz', ref: { rid: 'service.collection.soft', soft: true }}});
				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(1);
					expect(cb.mock.calls[0][0]).toMatchObject({ foo: 'bar', ref: { rid: 'service.model.soft' }});
					expect(cb.mock.calls[0][0].ref).toBeInstanceOf(ResRef);
					expect(cb.mock.calls[0][1]).toBe(model);
					expect(model.foo).toBe('baz');
					expect(model.ref).toBeInstanceOf(ResRef);
					expect(model.ref).toMatchObject({ rid: 'service.collection.soft' });

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("emits a custom event", () => {
			return getServerResource('service.model', modelResources).then(model => {
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

		it("emits an event received before unsubscribe response", () => {
			return getServerResource('service.model', modelResources).then(model => {
				// Cause unsubscribe by waiting
				return waitAWhile().then(flushRequests).then(() => {
					let req = server.getNextRequest();
					server.sendEvent('service.model', 'custom', { foo: 'baz' });
					server.sendResponse(req, null);

					// Wait for the unsubscribe response
					return flushRequests().then(() => {
						expect(server.error).toBe(null);

						return getServerResource('service.model', modelResources).then(modelSecond => {
							expect(model).not.toBe(modelSecond);

							let req = server.getNextRequest();
							expect(req).toBe(undefined);
						});
					});
				});
			});
		});

		it("tries to resubscribes a while after unsubscribe event", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('unsubscribe', cb);

				server.sendEvent('service.model', 'unsubscribe');
				return flushRequests().then(() => {
					expect(server.pendingRequests()).toBe(0);
					expect(cb.mock.calls.length).toBe(1);

					return waitAWhile().then(flushRequests()).then(() => {
						expect(server.error).toBe(null);
						expect(server.pendingRequests()).toBe(1);
						let req = server.getNextRequest();
						expect(req.method).toBe('subscribe.service.model');
					});
				});
			});
		});

		it("instantly removes stale item from cache when no longer listened to", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('custom', cb);

				server.sendEvent('service.model', 'unsubscribe');
				return flushRequests().then(() => {
					model.off('custom', cb);

					return getServerResource('service.model', modelResources).then(modelSecond => {
						expect(model).not.toBe(modelSecond);
					});
				});
			});
		});

		it("instantly resubscribes to a model when listening between an unsubscribe request and its response", () => {
			// TODO
		});


	});

	describe("collection.on", () => {

		it("does not unsubscribe to collection being listened to", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				collection.on('add', cb);

				return waitAWhile().then(flushRequests).then(() => {
					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("unsubscribes to collection after it is no longer listened to", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				collection.on('add', cb);
				collection.on('remove', cb2);

				return waitAWhile().then(flushRequests).then(() => {
					collection.off('add', cb);

					return waitAWhile().then(flushRequests).then(() => {
						expect(server.pendingRequests()).toBe(0);
						collection.off('remove', cb2);

						return waitAWhile().then(flushRequests).then(() => {
							expect(server.error).toBe(null);
							let req = server.getNextRequest();
							expect(req).not.toBe(undefined);
							expect(req.method).toBe('unsubscribe.service.collection');
							server.sendResponse(req, null);

							// Wait for the unsubscribe response
							return flushRequests().then(() => {
								expect(server.error).toBe(null);

								return getServerResource('service.collection', collectionResources).then(collectionSecond => {
									expect(collection).not.toBe(collectionSecond);
									expect(server.pendingRequests()).toBe(0);
								});
							});
						});
					});
				});
			});
		});

		it("subscribes to listened models before unsubscribing to the collection", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
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
						return client.get(collectionData[0].rid).then(modelSecond => {
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
			let rid = collectionData[0].rid;
			let models = {};
			models[rid] = collectionModels[rid];
			return getServerResource(rid, { models }).then(model => {
				// Get collection
				models = Object.assign({}, collectionModels);
				delete models[rid];
				return getServerResource('service.collection', {
					models,
					collections: {
						'service.collection': collectionData
					}
				}).then(collection => {
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

		it("emits an add event on model add", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				collection.on('add', cb);

				server.sendEvent('service.collection', 'add', { value: { rid: 'service.item.35' }, models: { 'service.item.35': { id: 35, name: "Thirtyfive" }}, idx: 3 });
				server.sendEvent('service.collection', 'add', { value: { rid: 'service.item.15' }, models: { 'service.item.15': { id: 15, name: "Fifteen" }}, idx: 1 });
				server.sendEvent('service.collection', 'add', { value: { rid: 'service.item.5' }, models: { 'service.item.5': { id: 5, name: "Five" }}, idx: 0 });

				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(3);
					expect(cb.mock.calls[0][0]).toEqual({ idx: 3, item: collection.atIndex(5) });
					expect(cb.mock.calls[0][1]).toBe(collection);
					expect(cb.mock.calls[1][0]).toEqual({ idx: 1, item: collection.atIndex(2) });
					expect(cb.mock.calls[1][1]).toBe(collection);
					expect(cb.mock.calls[2][0]).toEqual({ idx: 0, item: collection.atIndex(0) });
					expect(cb.mock.calls[2][1]).toBe(collection);

					expect(collection.length).toBe(6);
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

		it("emits a remove event on model remove", () => {
			return getServerResource('service.collection', {
				collections: {
					'service.collection': [
						collectionData[0],
						{ rid: 'service.item.15' },
						collectionData[1],
						{ rid: 'service.item.25' },
						collectionData[2]
					]
				},
				models: {
					'service.item.10': collectionModels['service.item.10'],
					'service.item.15': { id: 15, name: "Fifteen" },
					'service.item.20': collectionModels['service.item.20'],
					'service.item.25': { id: 25, name: "Twentyfive" },
					'service.item.30': collectionModels['service.item.30']
				}
			}).then(collection => {
				collection.on('remove', cb);

				let model10 = collection.atIndex(0);
				let model20 = collection.atIndex(2);
				let model30 = collection.atIndex(4);

				server.sendEvent('service.collection', 'remove', { idx: 0 });
				server.sendEvent('service.collection', 'remove', { idx: 1 });
				server.sendEvent('service.collection', 'remove', { idx: 2 });

				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(3);
					expect(cb.mock.calls[0][0]).toEqual({ idx: 0, item: model10 });
					expect(cb.mock.calls[0][1]).toBe(collection);
					expect(cb.mock.calls[1][0]).toEqual({ idx: 1, item: model20 });
					expect(cb.mock.calls[1][1]).toBe(collection);
					expect(cb.mock.calls[2][0]).toEqual({ idx: 2, item: model30 });
					expect(cb.mock.calls[2][1]).toBe(collection);

					expect(collection.length).toBe(2);
					expect(collection.atIndex(0).name).toBe("Fifteen");
					expect(collection.atIndex(1).name).toBe("Twentyfive");

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("emits an add event on primitive add", () => {
			return getServerResource('service.primitives', primitiveCollectionResources).then(collection => {
				collection.on('add', cb);

				server.sendEvent('service.primitives', 'add', { value: { rid: "service.collection.soft", soft: true }, idx: 0 });
				server.sendEvent('service.primitives', 'add', { value: 52, idx: 3 });
				server.sendEvent('service.primitives', 'add', { value: "end", idx: 8 });

				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(3);
					expect(cb.mock.calls[0][0]).toMatchObject({ idx: 0, item: { rid: "service.collection.soft" }});
					expect(cb.mock.calls[0][1]).toBe(collection);
					expect(cb.mock.calls[1][0]).toEqual({ idx: 3, item: 52 });
					expect(cb.mock.calls[1][1]).toBe(collection);
					expect(cb.mock.calls[2][0]).toEqual({ idx: 8, item: "end" });
					expect(cb.mock.calls[2][1]).toBe(collection);

					expect(collection.length).toBe(9);
					expect(collection.atIndex(0)).toMatchObject({ rid: "service.collection.soft" });
					expect(collection.atIndex(1)).toBe("foo");
					expect(collection.atIndex(2)).toBe(42);
					expect(collection.atIndex(3)).toBe(52);
					expect(collection.atIndex(4)).toBe(true);
					expect(collection.atIndex(5)).toBe(false);
					expect(collection.atIndex(6)).toBe(null);
					expect(collection.atIndex(7)).toMatchObject({ rid: "service.model.soft" });
					expect(collection.atIndex(8)).toBe("end");

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("emits a remove event on primitive remove", () => {
			return getServerResource('service.primitives', primitiveCollectionResources).then(collection => {
				collection.on('remove', cb);

				let item0 = collection.atIndex(0);
				let item1 = collection.atIndex(2);
				let item2 = collection.atIndex(4);
				let item3 = collection.atIndex(5);

				server.sendEvent('service.primitives', 'remove', { idx: 0 });
				server.sendEvent('service.primitives', 'remove', { idx: 1 });
				server.sendEvent('service.primitives', 'remove', { idx: 2 });
				server.sendEvent('service.primitives', 'remove', { idx: 2 });

				return flushRequests().then(() => {
					expect(cb.mock.calls.length).toBe(4);
					expect(cb.mock.calls[0][0]).toEqual({ idx: 0, item: item0 });
					expect(cb.mock.calls[0][1]).toBe(collection);
					expect(cb.mock.calls[1][0]).toEqual({ idx: 1, item: item1 });
					expect(cb.mock.calls[1][1]).toBe(collection);
					expect(cb.mock.calls[2][0]).toEqual({ idx: 2, item: item2 });
					expect(cb.mock.calls[2][1]).toBe(collection);
					expect(cb.mock.calls[3][0]).toEqual({ idx: 2, item: item3 });
					expect(cb.mock.calls[3][1]).toBe(collection);

					expect(collection.length).toBe(2);
					expect(collection.atIndex(0)).toBe(42);
					expect(collection.atIndex(1)).toBe(false);

					let req = server.getNextRequest();
					expect(req).toBe(undefined);
				});
			});
		});

		it("sets a listened model as stale when removed, subscribing to it after a while", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				let model = collection.atIndex(0);
				collection.on('remove', cb);
				model.on('change', cb2);
				server.sendEvent('service.collection', 'remove', { idx: 0 });

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
						server.sendResponse(req, { models: {
							'service.item.10': {
								id: 10,
								name: "X"
							}
						}});

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

		it("reconnects after connection is lost while subscribing", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('change', cb);

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
		});

		it("resubscribes to a model after reconnect", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.on('change', cb);
				let oldUrl = server.url;
				server.close();

				return flushPromises().then(() => {
					server = new ResServer(oldUrl);

					return waitAWhile().then(getVersion).then(() => {
						expect(server.error).toBe(null);
						let req = server.getNextRequest();
						expect(req).not.toBe(undefined);
						expect(req.method).toBe('subscribe.service.model');
						server.sendResponse(req, modelResources);

						return flushRequests().then(() => {
							expect(server.error).toBe(null);
							expect(server.pendingRequests()).toBe(0);
						});
					});
				});
			});
		});

		it("emits remove and add events when collection differs from cached collection", () => {
			return getServerResource('service.collection', collectionResources).then(collection => {
				let oldUrl = server.url;
				collection.on('remove', cb);
				collection.on('add', cb2);
				server.close();

				return flushPromises().then(() => {
					server = new ResServer(oldUrl);

					return waitAWhile().then(getVersion).then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, {
							models: {
								'service.item.15': { id: 15, name: "Fifteen" }
							},
							collections: {
								'service.collection': [
									collectionData[0],
									{ rid: 'service.item.15' },
									collectionData[2],
									"foo"
								]
							}
						});

						return flushRequests().then(() => {
							expect(collection.length).toBe(4);
							expect(cb.mock.calls.length).toBe(1);
							expect(cb.mock.calls[0][1]).toBe(collection);
							expect(cb.mock.calls[0][0].item.getResourceId()).toBe('service.item.20');
							expect(cb.mock.calls[0][0].idx).toEqual(1);
							expect(cb2.mock.calls.length).toBe(2);
							expect(cb2.mock.calls[0][1]).toBe(collection);
							expect(cb2.mock.calls[0][0].item.getResourceId()).toBe('service.item.15');
							expect(cb2.mock.calls[0][0].idx).toEqual(1);
							expect(cb2.mock.calls[1][1]).toBe(collection);
							expect(cb2.mock.calls[1][0].item).toEqual("foo");
							expect(cb2.mock.calls[1][0].idx).toEqual(3);

							expect(server.error).toBe(null);
							expect(server.pendingRequests()).toBe(0);
						});
					});
				});
			});
		});

		describe("emits a change event when resubscribed model differs from cached model", () => {
			test.each([
				[ // No change
					{ models: { 'service.model': { foo: "bar", int: 42, soft: { rid: 'service.model.soft', soft: true }, ref: { rid: 'service.ref' }}, 'service.ref': { zoo: "baz" }}},
					{ models: { 'service.model': { foo: "bar", int: 42, soft: { rid: 'service.model.soft', soft: true }, ref: { rid: 'service.ref' }}, 'service.ref': { zoo: "baz" }}},
					null,
					model => expect(client.cache['service.ref'].indirect).toBe(1)
				],
				[ // Updated values
					{ models: { 'service.model': { foo: "bar", int: 42, ref: { rid: 'service.model.soft', soft: true }}}},
					{ models: { 'service.model': { foo: "baz", int: 12, ref: { rid: 'service.collection.soft', soft: true }}}},
					{ foo: "bar", int: 42, ref: { rid: 'service.model.soft' }},
					null
				],
				[ // New types of values
					{ models: { 'service.model': { foo: "bar", int: 42, ref: { rid: 'service.model.soft', soft: true }}}},
					{ models: { 'service.model': { foo: 42, int: { rid: 'service.model.soft', soft: true }, ref: "bar" }}},
					{ foo: "bar", int: 42, ref: { rid: 'service.model.soft' }},
					null
				],
				[ // Added value
					{ models: { 'service.model': { foo: "bar", int: 42, ref: { rid: 'service.model.soft', soft: true }}}},
					{ models: { 'service.model': { foo: "bar", int: 42, ref: { rid: 'service.model.soft', soft: true }, newValue: true }}},
					{ newValue: undefined },
					null
				],
				[ // Removed values
					{ models: { 'service.model': { foo: "bar", int: 42, ref: { rid: 'service.model.soft', soft: true }}}},
					{ models: { 'service.model': {}}},
					{ foo: "bar", int: 42, ref: { rid: 'service.model.soft' }},
					null
				],
				[ // Decreased reference
					{ models: { 'service.model': { ref1: { rid: 'service.ref' }, ref2: { rid: 'service.ref' }, ref3: { rid: 'service.ref' }}, 'service.ref': { zoo: "baz" }}},
					{ models: { 'service.model': { ref1: { rid: 'service.ref' }, ref2: { rid: 'service.ref' }, ref3: null }, 'service.ref': { zoo: "baz" }}},
					{ ref3: { zoo: "baz" }},
					model => expect(client.cache['service.ref'].indirect).toBe(2)
				],
				[ // Moved reference
					{ models: { 'service.model': { ref1: { rid: 'service.ref' }, ref2: null }, 'service.ref': { zoo: "baz" }}},
					{ models: { 'service.model': { ref1: null, ref2: { rid: 'service.ref' }}, 'service.ref': { zoo: "baz" }}},
					{ ref1: { zoo: "baz" }, ref2: null },
					model => expect(client.cache['service.ref'].indirect).toBe(1)
				],
				[ // Removed reference
					{ models: { 'service.model': { ref1: { rid: 'service.ref' }}, 'service.ref': { zoo: "baz" }}},
					{ models: { 'service.model': { ref1: null }}},
					{ ref1: { zoo: "baz" }},
					model => expect(typeof client.cache['service.ref']).toBe("undefined")
				],
				[ // No change in data value
					{ models: { 'service.model': { obj: { data: { foo: [ "bar", "baz" ] }}, arr: { data: [{ foo: "bar", zoo: "baz" }] }}}},
					{ models: { 'service.model': { obj: { data: { foo: [ "bar", "baz" ] }}, arr: { data: [{ foo: "bar", zoo: "baz" }] }}}},
					null,
					model => expect(model.obj.foo[1]).toBe("baz")
				],
				[ // Changed order in data value array
					{ models: { 'service.model': { arr: { data: [ "bar", "baz" ] }}}},
					{ models: { 'service.model': { arr: { data: [ "baz", "bar" ] }}}},
					{ arr: [ "bar", "baz" ] },
					model => expect(model.arr[1]).toBe("bar")
				],
				[ // Changed count in data value array
					{ models: { 'service.model': { arr: { data: [ "bar", "baz" ] }}}},
					{ models: { 'service.model': { arr: { data: [ "bar" ] }}}},
					{ arr: [ "bar", "baz" ] },
					model => expect(model.arr.length).toBe(1)
				],
				[ // Changed order in data value object
					{ models: { 'service.model': { obj: { data: { foo: "bar", zoo: "baz" }}}}},
					{ models: { 'service.model': { obj: { data: { zoo: "baz", foo: "bar" }}}}},
					null,
					model => expect(model.obj.foo).toBe("bar")
				],
				[ // Changed count in data value object
					{ models: { 'service.model': { obj: { data: { foo: "bar", zoo: "baz" }}}}},
					{ models: { 'service.model': { obj: { data: { foo: "bar" }}}}},
					{ obj: { foo: "bar", zoo: "baz" }},
					model => expect(model.obj.zoo).toBe(undefined)
				],
				[ // Changed value in data value object
					{ models: { 'service.model': { obj: { data: { foo: "bar", zoo: "baz" }}}}},
					{ models: { 'service.model': { obj: { data: { foo: "bar", zoo: "buzz" }}}}},
					{ obj: { foo: "bar", zoo: "baz" }},
					model => expect(model.obj.zoo).toBe("buzz")
				],
				[ // Changed property name in data value object
					{ models: { 'service.model': { obj: { data: { foo: "bar", zoo: "baz" }}}}},
					{ models: { 'service.model': { obj: { data: { foo: "bar", boo: "baz" }}}}},
					{ obj: { foo: "bar", zoo: "baz" }},
					model => expect(model.obj.boo).toBe("baz")
				],
				[ // Changed primitive and data value
					{ models: { 'service.model': { a: { data: 42 }, b: 12 }}},
					{ models: { 'service.model': { a: 42, b: { data: 12 }}}},
					null,
					model => {
						expect(model.a).toBe(42);
						expect(model.b).toBe(12);
					}
				],
			])("given firstModel=%p, and secondModel=%p gives changed values %p", (firstModel, secondModel, expectedChanged, validate) => {
				return getServerResource('service.model', firstModel).then(model => {
					model.on('change', cb);
					let oldUrl = server.url;
					server.close();

					// Make shallow copy of old model props
					let oldProps = Object.assign({}, oldProps);

					return flushPromises().then(() => {
						server = new ResServer(oldUrl);

						return waitAWhile().then(getVersion).then(() => {
							let req = server.getNextRequest();
							server.sendResponse(req, secondModel);

							return flushRequests().then(() => {
								let changed = {};
								if (expectedChanged === null) {
									expect(cb.mock.calls.length).toBe(0);
								} else {
									expect(cb.mock.calls.length).toBe(1);
									expect(cb.mock.calls[0][1]).toBe(model);
									changed = cb.mock.calls[0][0];
									expect(JSON.parse(JSON.stringify(changed))).toEqual(expectedChanged);
								}
								// Validate old values
								for (let k in oldProps) {
									if (changed.hasOwnProperty(k)) {
										expect(oldProps[k]).toBe(changed[k]);
										expect(oldProps[k]).not.toBe(model.props[k]);
									} else {
										expect(oldProps[k]).toBe(model.props[k]);
									}
								}
								// Validate new values
								for (let k in model.props) {
									if (!oldProps.hasOwnProperty) {
										expect(changed[k]).toBe(model.props[k]);
									}
								}

								expect(server.error).toBe(null);
								expect(server.pendingRequests()).toBe(0);
								if (validate) {
									validate(model);
								}
							});
						});
					});
				});
			});
		});

		describe("emits remove and add events when collection differs from cached collection", () => {
			test.each([
				[ // No change
					{ collections: { 'service.collection': [ "foo", 42, { rid: "service.soft", soft: true }, { rid: 'service.ref' }], 'service.ref': [ "baz" ] }},
					{ collections: { 'service.collection': [ "foo", 42, { rid: "service.soft", soft: true }, { rid: 'service.ref' }], 'service.ref': [ "baz" ] }},
					[ "foo", 42, { rid: "service.soft" }, [ "baz" ]],
					0,
					collection => expect(client.cache['service.ref'].indirect).toBe(1)
				],
				[ // Removed primitive
					{ collections: { 'service.collection': [ "foo", 42, { rid: "service.ref", soft: true }, { rid: 'service.ref' }], 'service.ref': [ "baz" ] }},
					{ collections: { 'service.collection': [ "foo", { rid: "service.ref", soft: true }, { rid: 'service.ref' }], 'service.ref': [ "baz" ] }},
					[ "foo", { rid: "service.ref" }, [ "baz" ]],
					1,
					collection => expect(client.cache['service.ref'].indirect).toBe(1)
				],
				[ // Removed soft reference
					{ collections: { 'service.collection': [ "foo", 42, { rid: "service.soft", soft: true }, { rid: 'service.ref' }], 'service.ref': [ "baz" ] }},
					{ collections: { 'service.collection': [ "foo", 42, { rid: 'service.ref' }], 'service.ref': [ "baz" ] }},
					[ "foo", 42, [ "baz" ]],
					1,
					collection => expect(client.cache['service.ref'].indirect).toBe(1)
				],
				[ // Removed reference
					{ collections: { 'service.collection': [ "foo", 42, { rid: "service.soft", soft: true }, { rid: 'service.ref' }], 'service.ref': [ "baz" ] }},
					{ collections: { 'service.collection': [ "foo", 42, { rid: "service.soft", soft: true }] }},
					[ "foo", 42, { rid: "service.soft" }],
					1,
					collection => expect(typeof client.cache['service.ref']).toBe("undefined")
				],
				[ // Decreased reference
					{ collections: { 'service.collection': [{ rid: "service.ref" }, { rid: "service.ref" }, { rid: 'service.ref' }], 'service.ref': [ "baz" ] }},
					{ collections: { 'service.collection': [{ rid: "service.ref" }, { rid: "service.ref" }], 'service.ref': [ "baz" ] }},
					[[ "baz" ], [ "baz" ]],
					1,
					collection => expect(client.cache['service.ref'].indirect).toBe(2)
				],
				[ // Added reference
					{ collections: { 'service.collection': [ "foo" ] }},
					{ collections: { 'service.collection': [{ rid: "service.ref" }, "foo" ], 'service.ref': [ "baz" ] }},
					[[ "baz" ], "foo" ],
					1,
					collection => expect(client.cache['service.ref'].indirect).toBe(1)
				],
				[ // Increased reference
					{ collections: { 'service.collection': [{ rid: "service.ref" }], 'service.ref': [ "baz" ] }},
					{ collections: { 'service.collection': [{ rid: "service.ref" }, { rid: "service.ref" }], 'service.ref': [ "baz" ] }},
					[[ "baz" ], [ "baz" ]],
					1,
					collection => expect(client.cache['service.ref'].indirect).toBe(2)
				],
				[ // Changed soft reference
					{ collections: { 'service.collection': [ "foo", { rid: "service.soft", soft: true }] }},
					{ collections: { 'service.collection': [ "foo", { rid: "service.ref", soft: true }] }},
					[ "foo", { rid: "service.ref" }],
					2,
					null
				],
				[ // Changed reference
					{ collections: { 'service.collection': [ "foo", { rid: 'service.ref1' }], 'service.ref1': [ "zoo" ] }},
					{ collections: { 'service.collection': [ "foo", { rid: 'service.ref2' }], 'service.ref2': [ "baz" ] }},
					[ "foo", [ "baz" ]],
					2,
					null
				],
				[ // Changed data value
					{ collections: { 'service.collection': [ "foo", { data: { foo: "bar" }}] }},
					{ collections: { 'service.collection': [ "foo", { data: { foo: "baz" }}] }},
					[ "foo", { foo: "baz" }],
					2,
					null
				],
				[ // Unchanged data value
					{ collections: { 'service.collection': [{ data: { foo: "bar", zoo: "baz" }}, { data: [ "foo" ] }, { data: null }] }},
					{ collections: { 'service.collection': [{ data: { zoo: "baz", foo: "bar" }}, { data: [ "foo" ] }, null ] }},
					[{ zoo: "baz", foo: "bar" }, [ "foo" ], null ],
					0,
					null
				]
			])("given firstCollection=%j, and secondCollection=%j gives changed values %j", (firstCollection, secondCollection, expectedCollection, expectedEvents, validate) => {
				return getServerResource('service.collection', firstCollection).then(collection => {
					let oldUrl = server.url;
					// Copy initial collection state
					let arr = collection.toArray();

					// Record collection events
					collection.on('add', eventRecorder('add'));
					collection.on('remove', eventRecorder('remove'));

					server.close();

					return flushPromises().then(() => {
						server = new ResServer(oldUrl);

						return waitAWhile().then(getVersion).then(() => {
							let req = server.getNextRequest();
							server.sendResponse(req, secondCollection);

							return flushRequests().then(() => {
								expect(JSON.parse(JSON.stringify(collection))).toEqual(expectedCollection);
								expect(recordedEvents.length).toBe(expectedEvents);

								for (let e of recordedEvents) {
									switch (e.event) {
									case 'add':
										expect(e.idx >= 0 && e.idx <= arr.length).toBe(true);
										arr.splice(e.idx, 0, e.item);
										break;
									case 'remove':
										expect(e.idx >= 0 && e.idx < arr.length).toBe(true);
										expect(e.item).toBe(arr[e.idx]);
										arr.splice(e.idx, 1);
										break;
									}
								}

								expect(JSON.parse(JSON.stringify(arr))).toEqual(expectedCollection);
								expect(server.error).toBe(null);
								expect(server.pendingRequests()).toBe(0);
								if (validate) {
									validate(collection);
								}
							});
						});
					});
				});
			});
		});
	});


	describe("setOnConnect", () => {

		it("calls the setOnConnect callback after connect", () => {
			client.setOnConnect(cb);
			client.connect();
			return getVersion().then(() => {
				jest.runAllTimers();
				expect(cb.mock.calls.length).toBe(1);
			});
		});

		it("postpones any request until setOnConnect callback resolves", () => {
			let onConnect = jest.fn(() => client.call('service.model', 'test'));
			client.setOnConnect(onConnect);

			let promise = client.get('service.model');

			return getVersion().then(() => {
				expect(server.pendingRequests()).toBe(1);
				expect(server.error).toBe(null);
				let req = server.getNextRequest();
				expect(req.method).toBe('call.service.model.test');
				server.sendResponse(req, { payload: null });

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
		});
	});

	describe("modelType", () => {

		it("uses the registered model type when creating a model instance", () => {
			client.registerModelType(
				'service.item.*',
				(api, rid, data) => {
					return new ResModel(api, rid, {
						definition: {
							id: { type: 'number' },
							name: { type: 'string' },
							flag: { type: 'boolean', default: true }
						}
					});
				}
			);

			return getServerResource('service.collection', collectionResources).then(collection => {
				expect(collection.atIndex(0).flag).toBe(true);
				expect(collection.atIndex(1).flag).toBe(true);
				expect(collection.atIndex(1).flag).toBe(true);
			});
		});

		// it("does not use an unregistered model type when creating a model instance", () => {
		// 	client.registerModelType(
		// 		'service.item.*',
		// 		(api, rid, data) => {
		// 			return new ResModel(api, rid, {
		// 				definition: {
		// 					id: { type: 'number' },
		// 					name: { type: 'string' },
		// 					flag: { type: 'boolean', default: true }
		// 				}
		// 			});
		// 		}
		// 	);

		// 	client.unregisterModelType('service.item');

		// 	return getServerResource('service.collection', collectionResources).then(collection => {
		// 		expect(collection.atIndex(0).flag).toBe(undefined);
		// 		expect(collection.atIndex(1).flag).toBe(undefined);
		// 		expect(collection.atIndex(1).flag).toBe(undefined);
		// 	});
		// });

		it("uses the registered collection type when creating a collection instance", () => {
			client.registerCollectionType(
				'service.collection',
				(api, rid) => {
					let c = new ResCollection(api, rid);
					c.flag = true;
					return c;
				}
			);

			return getServerResource('service.collection', collectionResources).then(collection => {
				expect(collection.flag).toBe(true);
			});
		});
	});

	describe("ResModel", () => {

		describe("call", () => {

			it("calls remote method on call with parameters", () => {
				return getServerResource('service.model', modelResources).then(model => {
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
				return getServerResource('service.model', modelResources).then(model => {
					model.call('test');
					return flushRequests().then(() => {
						let req = server.getNextRequest();
						expect([ null, undefined ]).toContain(req.params);
					});
				});
			});

			it("resolves call promise on result payload", () => {
				return getServerResource('service.model', modelResources).then(model => {
					let promise = model.call('test');

					return flushRequests().then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, { payload: { responseValue: true }});

						return flushRequests().then(() => {
							return expect(promise).resolves.toEqual({ responseValue: true });
						});
					});
				});
			});

			it("resolves call promise on success with legacy resgate", () => {
				return getServerResource('service.model', modelResources, null, null).then(model => {
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
				return getServerResource('service.model', modelResources).then(model => {
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

			it("resolves call promise on resource response", () => {
				return getServerResource('service.model', modelResources).then(model => {
					let promise = model.call('test');

					return flushRequests().then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, modelReferenceResources);

						return flushRequests()
							.then(() => promise)
							.then(m => {
								expect(m).not.toBe(undefined);
								expect(m.foo).toBe("bar");
							});
					});
				});
			});

		});

		describe("auth", () => {

			it("calls remote method on auth with parameters", () => {
				return getServerResource('service.model', modelResources).then(model => {
					model.auth('test', { zoo: "baz", value: 12 });

					return flushRequests().then(() => {
						expect(server.pendingRequests()).toBe(1);
						expect(server.error).toBe(null);
						let req = server.getNextRequest();
						expect(req.method).toBe('auth.service.model.test');
						expect(req.params).toEqual({ zoo: "baz", value: 12 });
					});
				});
			});

			it("calls remote method on auth without parameters", () => {
				return getServerResource('service.model', modelResources).then(model => {
					model.auth('test');
					return flushRequests().then(() => {
						let req = server.getNextRequest();
						expect([ null, undefined ]).toContain(req.params);
					});
				});
			});

			it("resolves auth promise on result payload", () => {
				return getServerResource('service.model', modelResources).then(model => {
					let promise = model.auth('test');

					return flushRequests().then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, { payload: { responseValue: true }});

						return flushRequests().then(() => {
							return expect(promise).resolves.toEqual({ responseValue: true });
						});
					});
				});
			});

			it("resolves auth promise on success with legacy resgate", () => {
				return getServerResource('service.model', modelResources, null, null).then(model => {
					let promise = model.auth('test');

					return flushRequests().then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, { responseValue: true });

						return flushRequests().then(() => {
							return expect(promise).resolves.toEqual({ responseValue: true });
						});
					});
				});
			});

			it("rejects auth promise on error", () => {
				return getServerResource('service.model', modelResources).then(model => {
					let promise = model.auth('test');

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

			it("resolves auth promise on resource response", () => {
				return getServerResource('service.model', modelResources).then(model => {
					let promise = model.auth('test');

					return flushRequests().then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, modelReferenceResources);

						return flushRequests()
							.then(() => promise)
							.then(m => {
								expect(m).not.toBe(undefined);
								expect(m.foo).toBe("bar");
							});
					});
				});
			});

		});

		it("calls set method on set", () => {
			return getServerResource('service.model', modelResources).then(model => {
				model.set({ foo: "baz" });
				return flushRequests().then(() => {
					let req = server.getNextRequest();
					expect(req.method).toBe('call.service.model.set');
					expect(req.params).toEqual({ foo: "baz" });
				});
			});
		});

		it("creates anonymous object on toJSON", () => {
			return getServerResource('service.model', modelResources).then(model => {
				expect(model.toJSON()).toEqual(modelDataJson);
			});
		});

		it("creates anonymous object on toJSON using definition", () => {
			client.registerModelType(
				'service.model',
				(api, rid) => {
					return new ResModel(api, rid, {
						definition: {
							foo: { type: 'string' },
							value: { type: 'number', default: 10 },
							notProvided: { type: 'string', default: "Not provided" }
						}
					});
				}
			);

			return getServerResource('service.model', { models: {
				'service.model': {
					foo: "bar",
					value: 12,
					notDefined: "Not defined"
				}
			}}).then(model => {
				expect(model.toJSON()).toEqual({
					foo: "bar",
					value: 12,
					notProvided: "Not provided"
				});
			});
		});
	});

	describe("ResCollection", () => {

		describe("call", () => {

			it("getResourceId returns the collection resource ID", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					expect(collection.getResourceId()).toBe('service.collection');
				});
			});

			it("getResourceId returns the collection resource ID", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					expect(collection.getResourceId()).toBe('service.collection');
				});
			});

			it("length gets the collection length", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					expect(collection.length).toBe(3);
				});
			});

			it("get returns the model using ID with idAttribute set", () => {
				client.registerCollectionType(
					'service.collection',
					(api, rid) => new ResCollection(api, rid, {
						idCallback: m => m.id
					})
				);

				return getServerResource('service.collection', collectionResources).then(collection => {
					expect(collection.get(10).toJSON()).toEqual({ id: 10, name: "Ten" });
					expect(collection.get(20).toJSON()).toEqual({ id: 20, name: "Twenty" });
					expect(collection.get(30).toJSON()).toEqual({ id: 30, name: "Thirty" });
				});
			});

			it("atIndex gets the item at a given index", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					expect(collection.atIndex(0).toJSON()).toEqual({ id: 10, name: "Ten" });
					expect(collection.atIndex(1).toJSON()).toEqual({ id: 20, name: "Twenty" });
					expect(collection.atIndex(2).toJSON()).toEqual({ id: 30, name: "Thirty" });
				});
			});

			it("indexOf gets the index of a primitive item", () => {
				return getServerResource('service.collection', { collections: {
					'service.collection': [
						"Foo",
						"Bar",
						"Baz",
						"Bar"
					]
				}}).then(collection => {
					expect(collection.indexOf("Foo")).toBe(0);
					expect(collection.indexOf("Bar")).toBe(1);
					expect(collection.indexOf("Baz")).toBe(2);
					expect(collection.indexOf("Faz")).toBe(-1);
				});
			});

			it("indexOf gets the index of a model item", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					expect(collection.indexOf(collection.atIndex(0))).toBe(0);
					expect(collection.indexOf(collection.atIndex(1))).toBe(1);
					expect(collection.indexOf(collection.atIndex(2))).toBe(2);
					expect(collection.indexOf({})).toBe(-1);
				});
			});

			it("implements iterable", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					let i = 0;
					for (let model of collection) {
						let expModel = collectionModels[collectionData[i].rid];
						expect(model.id).toBe(expModel.id);
						expect(model.name).toBe(expModel.name);
						i++;
					}
				});
			});

			it("creates anonymous array on toJSON", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					expect(collection.toJSON()).toEqual([
						{ id: 10, name: "Ten" },
						{ id: 20, name: "Twenty" },
						{ id: 30, name: "Thirty" }
					]);
				});
			});

			it("calls remote method on call with parameters", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					collection.call('test', { zoo: "baz", value: 12 });

					return flushRequests().then(() => {
						expect(server.pendingRequests()).toBe(1);
						expect(server.error).toBe(null);
						let req = server.getNextRequest();
						expect(req.method).toBe('call.service.collection.test');
						expect(req.params).toEqual({ zoo: "baz", value: 12 });
					});
				});
			});

			it("calls remote method on call without parameters", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					collection.call('test');
					return flushRequests().then(() => {
						let req = server.getNextRequest();
						expect([ null, undefined ]).toContain(req.params);
					});
				});
			});

			it("resolves call promise on success", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					let promise = collection.call('test');

					return flushRequests().then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, { payload: { responseValue: true }});

						return flushRequests().then(() => {
							return expect(promise).resolves.toEqual({ responseValue: true });
						});
					});
				});
			});

			it("resolves call promise on success with legacy resgate", () => {
				return getServerResource('service.collection', collectionResources, null, null).then(collection => {
					let promise = collection.call('test');

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
				return getServerResource('service.collection', collectionResources).then(collection => {
					let promise = collection.call('test');

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

			it("resolves call promise on resource response", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					let promise = collection.call('test');

					return flushRequests().then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, modelReferenceResources);

						return flushRequests()
							.then(() => promise)
							.then(m => {
								expect(m).not.toBe(undefined);
								expect(m.foo).toBe("bar");
							});
					});
				});
			});

		});

		describe("auth", () => {

			it("calls remote method on auth with parameters", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					collection.auth('test', { zoo: "baz", value: 12 });

					return flushRequests().then(() => {
						expect(server.pendingRequests()).toBe(1);
						expect(server.error).toBe(null);
						let req = server.getNextRequest();
						expect(req.method).toBe('auth.service.collection.test');
						expect(req.params).toEqual({ zoo: "baz", value: 12 });
					});
				});
			});

			it("calls remote method on auth without parameters", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					collection.auth('test');
					return flushRequests().then(() => {
						let req = server.getNextRequest();
						expect([ null, undefined ]).toContain(req.params);
					});
				});
			});

			it("resolves auth promise on result payload", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					let promise = collection.auth('test');

					return flushRequests().then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, { payload: { responseValue: true }});

						return flushRequests().then(() => {
							return expect(promise).resolves.toEqual({ responseValue: true });
						});
					});
				});
			});

			it("resolves auth promise on success with legacy resgate", () => {
				return getServerResource('service.collection', collectionResources, null, null).then(collection => {
					let promise = collection.auth('test');

					return flushRequests().then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, { responseValue: true });

						return flushRequests().then(() => {
							return expect(promise).resolves.toEqual({ responseValue: true });
						});
					});
				});
			});

			it("rejects auth promise on error", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					let promise = collection.auth('test');

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

			it("resolves auth promise on resource response", () => {
				return getServerResource('service.collection', collectionResources).then(collection => {
					let promise = collection.auth('test');

					return flushRequests().then(() => {
						let req = server.getNextRequest();
						server.sendResponse(req, modelReferenceResources);

						return flushRequests()
							.then(() => promise)
							.then(m => {
								expect(m).not.toBe(undefined);
								expect(m.foo).toBe("bar");
							});
					});
				});
			});

		});
	});

	describe("ResRef", () => {

		describe("get", () => {

			it("gets referenced resource", () => {
				return getServerResource('service.model', modelResources).then(model => {
					let promise = model.ref.get().then(refmodel => {
						expect(refmodel.name).toBe("soft");
					});

					return flushRequests().then(() => {
						expect(server.error).toBe(null);
						let req = server.getNextRequest();
						expect(req).not.toBe(undefined);
						expect(req.method).toBe('subscribe.service.model.soft');
						server.sendResponse(req, { models: { "service.model.soft": { name: "soft" }}});
						jest.runOnlyPendingTimers();
						return promise;
					});
				});
			});

		});

	});

});
