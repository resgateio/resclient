
import eventBus from 'modapp-eventbus';
import { obj } from 'modapp-utils';
import CacheItem from './CacheItem';
import TypeList from './TypeList';
import ResCollection from './ResCollection';
import ResModel from './ResModel';
import ResError from './ResError';
import ResRef from './ResRef';
import equal from './equal';

const defaultModelFactory = function(api, rid) {
	return new ResModel(api, rid);
};
const defaultCollectionFactory = function(api, rid) {
	return new ResCollection(api, rid);
};
const errorFactory = function(api, rid) {
	return new ResError(rid);
};

const versionToInt = function(version) {
	if (!version) return 0;
	let p = version.split('.');
	let v = 0;
	for (let i = 0; i < 3; i++) {
		v = v * 1000 + Number(p[i]);
	}
	return v;
};

const getRID = function(v) {
	return v !== null && typeof v === 'object' && typeof v.getResourceId === 'function' ? v.getResourceId() : null;
};

// Resource types
const typeCollection = 'collection';
const typeModel = 'model';
const typeError = 'error';
const resourceTypes = [ typeModel, typeCollection, typeError ];
// Actions
const actionDelete = { action: 'delete' };
// Default settings
const defaultNamespace = 'resclient';
const reconnectDelay = 3000;
const subscribeStaleDelay = 2000;
// Traverse states
const stateNone = 0;
const stateDelete = 1;
const stateKeep = 2;
const stateStale = 3;
// RES Protocol version
const supportedProtocol = "1.2.1";
const legacyProtocol = versionToInt("1.1.1");
const v1_2_1 = versionToInt("1.2.1");

/**
 * Connect event emitted on connect.
 * @callback ResClient~connectCallback
 * @param {object} event WebSocket open event object
 */

/**
 * Disconnect event emitted on disconnect.
 * @callback ResClient~disconnectCallback
 * @param {object} event WebSocket close event object
 */

/**
 * Error event emitted on error.
 * @callback ResClient~errorCallback
 * @param {ResError} err ResError object
 */

/**
 * WebSocket factory function.
 * @callback ResClient~websocketFactory
 * @returns {WebSocket} WebSocket instance implementing the [WebSocket API]{@link https://developer.mozilla.org/en-US/docs/Web/API/WebSocket}.
 */

/**
 * OnConnect callback function.
 * @callback ResClient~onConnectCallback
 * @param {ResClient} ResClient instance
 * @returns {?Promise} Promise for the onConnect handlers completion. Must always resolve.
 */

/**
 * ResClient represents a client connection to a RES API.
 */
class ResClient {

	/**
	 * Creates a ResClient instance
	 * @param {string|ResClient~websocketFactory} hostUrlOrFactory Websocket host path, or websocket factory function. Path may be relative to current path.
	 * @param {object} [opt] Optional parameters.
	 * @param {function} [opt.onConnect] On connect callback called prior resolving the connect promise and subscribing to stale resources. May return a promise.
	 * @param {string} [opt.namespace] Event bus namespace. Defaults to 'resclient'.
	 * @param {bool} [opt.debug] Flag to debug log all WebSocket communication. Defaults to false.
	 * @param {module:modapp~EventBus} [opt.eventBus] Event bus.
	 */
	constructor(hostUrlOrFactory, opt) {
		this.hostUrl = null;
		if (typeof hostUrlOrFactory == 'function') {
			this.wsFactory = hostUrlOrFactory;
		} else {
			this.hostUrl = this._resolvePath(hostUrlOrFactory);
			this.wsFactory = () => new WebSocket(this.hostUrl);
		}
		obj.update(this, opt, {
			onConnect: { type: '?function' },
			namespace: { type: 'string', default: defaultNamespace },
			debug: { type: 'boolean', default: false },
			eventBus: { type: 'object', default: eventBus }
		});

		this.tryConnect = false;
		this.connected = false;
		this.ws = null;
		this.requests = {};
		this.reqId = 1; // Incremental request id
		this.cache = {};
		this.stale = null;

		// Queue promises
		this.connectPromise = null;
		this.connectCallback = null;

		// Types
		this.types = {
			model: {
				id: typeModel,
				list: new TypeList(defaultModelFactory),
				prepareData: dta => {
					let o = {};
					for (let k in dta) {
						o[k] = this._prepareValue(dta[k], true);
					}
					return o;
				},
				getFactory: function(rid) { return this.list.getFactory(rid); },
				synchronize: this._syncModel.bind(this)
			},
			collection: {
				id: typeCollection,
				list: new TypeList(defaultCollectionFactory),
				prepareData: dta => dta.map(v => this._prepareValue(v, true)),
				getFactory: function(rid) { return this.list.getFactory(rid); },
				synchronize: this._syncCollection.bind(this)
			},
			error: {
				id: typeError,
				prepareData: dta => dta,
				getFactory: rid => errorFactory,
				synchronize: () => {}
			}
		};

		// Bind callbacks
		this._handleOnopen = this._handleOnopen.bind(this);
		this._handleOnerror = this._handleOnerror.bind(this);
		this._handleOnmessage = this._handleOnmessage.bind(this);
		this._handleOnclose = this._handleOnclose.bind(this);
		this._unsubscribe = this._unsubscribe.bind(this);
	}

	/**
	 * RES protocol level supported by this client version.
	 * @returns {string} Supported RES protocol version.
	 */
	get supportedProtocol() {
		return supportedProtocol;
	}

	/**
	 * Connects the instance to the server.
	 * Can be called even if a connection is already established.
	 * @returns {Promise} A promise to the established connection.
	 */
	connect() {
		this.tryConnect = true;

		return this.connectPromise = this.connectPromise || new Promise((resolve, reject) => {
			this.connectCallback = { resolve, reject };
			this.ws = this.wsFactory();

			this.ws.onopen = this._handleOnopen;
			this.ws.onerror = this._handleOnerror;
			this.ws.onmessage = this._handleOnmessage;
			this.ws.onclose = this._handleOnclose;
		});
	}

	/**
	 * Disconnects any current connection and stops attempts
	 * of reconnecting.
	 */
	disconnect() {
		this.tryConnect = false;

		if (this.ws) {
			let ws = this.ws;
			let err = { code: 'system.disconnect', message: "Disconnect called" };
			ws.onclose = null;
			this._handleOnclose(err);
			ws.close();
			this._connectReject(err);
		}
	}

	/**
	 * Gets the host URL to the RES API
	 * @returns {string} Host URL
	 */
	getHostUrl() {
		return this.hostUrl;
	}

	/**
	 * Attach an event handler function for one or more instance events.
	 * Available events are 'connect', 'disconnect', and 'error'.
	 * @param {?string} events One or more space-separated events. Null means any event.
	 * @param {ResClient~connectCallback|ResClient~disconnectCallback|ResClient~errorCallback} handler Handler function to execute when the event is emitted.
	 */
	on(events, handler) {
		this.eventBus.on(this, events, handler, this.namespace);
	}

	/**
	 * Remove an instance event handler.
	 * Available events are 'connect', 'disconnect', and 'error'.
	 * @param {?string} events One or more space-separated events. Null means any event.
	 * @param {ResClient~connectCallback|ResClient~disconnectCallback|ResClient~errorCallback} [handler] Handler function to remove.
	 */
	off(events, handler) {
		this.eventBus.off(this, events, handler, this.namespace);
	}

	/**
	 * Sets the onConnect callback.
	 * @param {?ResClient~onConnectCallback} onConnect On connect callback called prior resolving the connect promise and subscribing to stale resources. May return a promise.
	 * @returns {this}
	 */
	setOnConnect(onConnect) {
		this.onConnect = onConnect;
		return this;
	}

	/**
	 * Model factory callback
	 * @callback ResClient~modelFactory
	 * @param {ResClient} api ResClient instance
	 * @param {string} rid Resource ID
	 * @returns {ResModel} Model instance object.
	 */

	/**
	 * Register a model type.
	 * The pattern may use the following wild cards:
	 * * The asterisk (*) matches any part at any level of the resource name.
	 * * The greater than symbol (>) matches one or more parts at the end of a resource name, and must be the last part.
	 * @param {string} pattern Pattern of the model type.
	 * @param {ResClient~modelFactory} factory Model factory callback
	 * @returns {this}
	 */
	registerModelType(pattern, factory) {
		this.types.model.list.addFactory(pattern, factory);
		return this;
	}

	/**
	 * Unregister a previously registered model type pattern.
	 * @param {string} pattern Pattern of the model type.
	 * @returns {ResClient~modelFactory} Unregistered model factory callback
	 */
	unregisterModelType(pattern) {
		return this.types.model.list.removeFactory(pattern);
	}

	/**
	 * Collection factory callback
	 * @callback ResClient~collectionFactory
	 * @param {ResClient} api ResClient instance
	 * @param {string} rid Resource ID
	 * @returns {ResCollection} Collection instance object.
	 */

	/**
	 * Register a collection type.
	 * The pattern may use the following wild cards:
	 * * The asterisk (*) matches any part at any level of the resource name.
	 * * The greater than symbol (>) matches one or more parts at the end of a resource name, and must be the last part.
	 * @param {string} pattern Pattern of the collection type.
	 * @param {ResClient~collectionFactory} factory Collection factory callback
	 * @returns {this}
	 */
	registerCollectionType(pattern, factory) {
		this.types.collection.list.addFactory(pattern, factory);
		return this;
	}

	/**
	 * Unregister a previously registered collection type pattern.
	 * @param {string} pattern Pattern of the collection type.
	 * @returns {ResClient~collectionFactory} Unregistered collection factory callback
	 */
	unregisterCollectionType(pattern) {
		return this.types.collection.list.removeFactory(pattern);
	}

	/**
	 * Get a resource from the API
	 * @param {string} rid Resource ID
	 * @param {function} [collectionFactory] Collection factory function.
	 * @return {Promise.<(ResModel|ResCollection)>} Promise of the resource.
	 */
	get(rid) {
		// Check for resource in cache
		let ci = this.cache[rid];
		if (ci) {
			if (ci.promise) {
				return ci.promise;
			}
			ci.resetTimeout();
			return Promise.resolve(ci.item);
		}

		ci = new CacheItem(rid, this._unsubscribe);
		this.cache[rid] = ci;

		return ci.setPromise(
			this._subscribe(ci, true).then(() => ci.item)
		);
	}

	/**
	 * Calls a method on a resource.
	 * @param {string} rid Resource ID.
	 * @param {string} method Method name
	 * @param {*} params Method parameters
	 * @returns {Promise.<object>} Promise of the call result.
	 */
	call(rid, method, params) {
		return this._call('call', rid, method, params);
	}

	/**
	 * Invokes a authentication method on a resource.
	 * @param {string} rid Resource ID.
	 * @param {string} method Method name
	 * @param {*} params Method parameters
	 * @returns {Promise.<object>} Promise of the authentication result.
	 */
	authenticate(rid, method, params) {
		return this._call('auth', rid, method, params);
	}

	/**
	 * Creates a new resource by calling the 'new' method.  
	 * Use call with 'new' as method parameter instead.
	 * @param {*} rid Resource ID
	 * @param {*} params Method parameters
	 * @return {Promise.<(ResModel|ResCollection)>} Promise of the resource.
	 * @deprecated since version 2.1.0. Use call with 'new' as method parameter instead.
	 */
	create(rid, params) {
		return this._send('new', rid, null, params)
			.then(result => {
				this._cacheResources(result);
				let ci = this.cache[result.rid];
				ci.addSubscribed(1);
				return ci.item;
			});
	}

	/**
	 * Calls the set method to update model properties.
	 * @param {string} modelId Model resource ID.
	 * @param {object} props Properties. Set value to undefined to delete a property.
	 * @returns {Promise.<object>} Promise of the call being completed.
	 */
	setModel(modelId, props) {
		props = Object.assign({}, props);
		// Replace undefined with actionDelete object
		Object.keys(props).forEach(k => {
			if (props[k] === undefined) {
				props[k] = actionDelete;
			}
		});

		return this._send('call', modelId, 'set', props);
	}

	resourceOn(rid, events, handler) {
		let cacheItem = this.cache[rid];
		if (!cacheItem) {
			throw new Error("Resource " + rid + " not found in cache");
		}

		cacheItem.addDirect();
		this.eventBus.on(cacheItem.item, events, handler, this.namespace + '.resource.' + rid);
	}

	resourceOff(rid, events, handler) {
		let cacheItem = this.cache[rid];
		if (!cacheItem) {
			throw new Error("Resource " + rid + " not found in cache");
		}

		cacheItem.removeDirect();
		this.eventBus.off(cacheItem.item, events, handler, this.namespace + '.resource.' + rid);
	}

	/**
	 * Sends a JsonRpc call to the API
	 * @param {string} action Action name
	 * @param {string} rid Resource ID
	 * @param {?string} method Optional method name
	 * @param {?object} params Optional parameters
	 * @returns {Promise.<object>} Promise to the response
	 * @private
	 */
	_send(action, rid, method, params) {
		if (!rid) {
			throw new Error("Invalid resource ID");
		}

		if (method === "") {
			throw new Error("Invalid method");
		}

		let m = action + '.' + rid + (method ? '.' + method : '');

		return this.connected
			? this._sendNow(m, params)
			: this.connect()
				.catch(e => { throw new ResError(rid, m, params).__init(e); })
				.then(() => this._sendNow(m, params));
	}

	_sendNow(method, params) {
		return new Promise((resolve, reject) => {
			// Prepare request object
			var req = { id: this.reqId++, method: method, params: params || undefined };

			this.requests[req.id] = {
				method: method,
				params: req.params,
				resolve: resolve,
				reject: reject
			};

			var json = JSON.stringify(req);
			if (this.debug) {
				console.debug("<== " + req.id + ":" + json);
			}
			this.ws.send(json);
		});
	}

	/**
	 * Receives a incoming json encoded data string and executes the appropriate functions/callbacks.
	 * @param {string} json Json encoded data
	 * @private
	 */
	_receive(json) {
		let data = JSON.parse(json.trim());

		if (data.hasOwnProperty('id')) {
			if (this.debug) {
				console.debug("==> " + data.id + ":" + json);
			}

			// Find the stored request
			let req = this.requests[data.id];
			if (!req) {
				throw new Error("Server response without matching request");
			}

			delete this.requests[data.id];

			if (data.hasOwnProperty("error")) {
				this._handleErrorResponse(req, data);
			} else {
				this._handleSuccessResponse(req, data);
			}
		} else if (data.hasOwnProperty('event')) {
			if (this.debug) {
				console.debug("--> " + json);
			}
			this._handleEvent(data);
		} else {
			throw new Error("Invalid message from server: " + json);
		}
	}

	_call(type, rid, method, params) {
		return this._send(type, rid, method || '', params)
			.then(result => {
				// Legacy v1.1.1 behavior
				if (this.protocol <= legacyProtocol) {
					return result;
				}
				if (result.rid) {
					this._cacheResources(result);
					let ci = this.cache[result.rid];
					ci.addSubscribed(1);
					return ci.item;
				}
				return result.payload;
			});
	}

	_handleErrorResponse(req, data) {
		let m = req.method;
		// Extract the rid if possible
		let rid = "";
		let i = m.indexOf('.');
		if (i >= 0) {
			rid = m.substr(i + 1);
			let a = m.substr(0, i);
			if (a === 'call' || a === 'auth') {
				i = rid.lastIndexOf('.');
				if (i >= 0) {
					rid = rid.substr(0, i);
				}
			}
		}
		let err = new ResError(
			rid.trim(),
			m,
			req.params
		);
		err.__init(data.error);
		try {
			this._emit('error', err);
		} catch (ex) {}

		// Execute error callback bound to calling object
		req.reject(err);
	}

	_handleSuccessResponse(req, data) {
		// Execute success callback bound to calling object
		req.resolve(data.result);
	}

	_handleEvent(data) {
		// Event
		let idx = data.event.lastIndexOf('.');
		if (idx < 0 || idx === data.event.length - 1) {
			throw new Error("Malformed event name: " + data.event);
		}

		let rid = data.event.substr(0, idx);

		let cacheItem = this.cache[rid];
		if (!cacheItem) {
			throw new Error("Resource not found in cache");
		}

		let event = data.event.substr(idx + 1);
		let handled = false;
		switch (event) {
		case 'change':
			handled = this._handleChangeEvent(cacheItem, event, data.data, false);
			break;

		case 'add':
			handled = this._handleAddEvent(cacheItem, event, data.data);
			break;

		case 'remove':
			handled = this._handleRemoveEvent(cacheItem, event, data.data);
			break;

		case 'unsubscribe':
			handled = this._handleUnsubscribeEvent(cacheItem);
			break;
		}

		if (!handled) {
			this.eventBus.emit(cacheItem.item, this.namespace + '.resource.' + rid + '.' + event, data.data);
		}
	}

	_handleChangeEvent(cacheItem, event, data, reset) {
		if (cacheItem.type !== typeModel) {
			return false;
		}

		this._cacheResources(data);

		// Set deleted properties to undefined
		let item = cacheItem.item;
		let rid;
		let vals = data.values;
		for (let k in vals) {
			vals[k] = this._prepareValue(vals[k]);
		}

		// Update the model with new values
		let changed = item.__update(vals, reset);
		if (!changed) {
			return false;
		}

		// Used changed object to determine which resource references has been
		// added or removed.
		let ind = {};
		for (let k in changed) {
			if ((rid = getRID(changed[k]))) {
				ind[rid] = (ind[rid] || 0) - 1;
			}
			if ((rid = getRID(vals[k]))) {
				ind[rid] = (ind[rid] || 0) + 1;
			}
		}

		// Remove indirect reference to resources no longer referenced in the
		// model
		for (rid in ind) {
			let d = ind[rid];
			let ci = this.cache[rid];
			ci.addIndirect(d);
			if (d < 0) {
				this._tryDelete(ci);
			}
		}

		this.eventBus.emit(cacheItem.item, this.namespace + '.resource.' + cacheItem.rid + '.' + event, changed);
		return true;
	}

	_handleAddEvent(ci, event, data) {
		if (ci.type !== typeCollection) {
			return false;
		}

		this._cacheResources(data);
		let v = this._prepareValue(data.value, true);
		let idx = data.idx;

		ci.item.__add(v, idx);
		this.eventBus.emit(ci.item, this.namespace + '.resource.' + ci.rid + '.' + event, { item: v, idx });
		return true;
	}

	_handleRemoveEvent(ci, event, data) {
		if (ci.type !== typeCollection) {
			return false;
		}

		let idx = data.idx;
		let item = ci.item.__remove(idx);
		this.eventBus.emit(ci.item, this.namespace + '.resource.' + ci.rid + '.' + event, { item, idx });

		let rid = getRID(item);
		if (rid) {
			let refItem = this.cache[rid];
			if (!refItem) {
				throw new Error("Removed model is not in cache");
			}

			refItem.addIndirect(-1);
			this._tryDelete(refItem);
		}
		return true;
	}

	_handleUnsubscribeEvent(ci) {
		ci.addSubscribed(0);
		this._tryDelete(ci);
		this.eventBus.emit(ci.item, this.namespace + '.resource.' + ci.rid + '.unsubscribe', { item: ci.item });
		return true;
	}

	_setStale(rid) {
		this._addStale(rid);
		if (this.connected) {
			setTimeout(() => this._subscribeToStale(rid), subscribeStaleDelay);
		}
	}

	_addStale(rid) {
		if (!this.stale) {
			this.stale = {};
		}
		this.stale[rid] = true;
	}

	_removeStale(rid) {
		if (this.stale) {
			delete this.stale[rid];
			for (let k in this.stale) {
				return;
			}
			this.stale = null;
		}
	}

	_subscribe(ci, throwError) {
		let rid = ci.rid;
		ci.addSubscribed(1);
		this._removeStale(rid);
		return this._send('subscribe', rid)
			.then(response => this._cacheResources(response))
			.catch(err => {
				if (throwError) {
					this._handleFailedSubscribe(ci);
					throw err;
				} else {
					this._handleUnsubscribeEvent(ci);
				}
			});
	}

	_subscribeToStale(rid) {
		if (!this.connected || !this.stale || !this.stale[rid]) {
			return;
		}

		this._subscribe(this.cache[rid]);
	}

	_subscribeToAllStale() {
		if (!this.stale) {
			return;
		}

		for (let rid in this.stale) {
			this._subscribeToStale(rid);
		}
	}

	/**
	 * Handles the websocket onopen event
	 * @param {object} e Open event object
	 * @private
	 */
	_handleOnopen(e) {
		if (this.debug) {
			console.debug("ResClient open", e, this);
		}
		this._sendNow('version', { protocol: this.supportedProtocol })
			.then(ver => {
				this.protocol = versionToInt(ver.protocol) || legacyProtocol;
			})
			.catch(err => {
				// Invalid error means the gateway doesn't support
				// version requests. Default to legacy protocol.
				if (err.code && err.code == 'system.invalidRequest') {
					this.protocol = legacyProtocol;
					return;
				}
				throw err;
			})
			.then(() => {
				if (this.onConnect) {
					this.connected = true;
					let promise = this.onConnect(this);
					this.connected = false;
					return promise;
				}
			})
			.then(() => {
				this.connected = true;
				this._subscribeToAllStale();
				this._emit('connect', e);
				this._connectResolve();
			})
			.catch(err => {
				if (this.ws) {
					this.ws.close();
				}
			});
	}

	/**
	 * Handles the websocket onerror event
	 * @param {object} e Error event object
	 * @private
	 */
	_handleOnerror(e) {
		if (this.debug) {
			console.debug("ResClient error", e, this);
		}
		this._connectReject({ code: 'system.connectionError', message: "Connection error", data: e });
	}

	/**
	 * Handles the websocket onmessage event
	 * @param {object} e Message event object
	 * @private
	 */
	_handleOnmessage(e) {
		this._receive(e.data);
	}

	/**
	 * Handles the websocket onclose event
	 * @param {object} e Close event object
	 * @private
	 */
	_handleOnclose(e) {
		if (this.debug) {
			console.debug("ResClient close", e, this);
		}
		this.connectPromise = null;
		this.ws = null;
		let wasConnected = this.connected;
		if (this.connected) {
			this.connected = false;

			// Set any subscribed item in cache to stale
			for (let rid in this.cache) {
				let ci = this.cache[rid];
				if (ci.subscribed) {
					ci.addSubscribed(0);
					this._addStale(rid);
					this._tryDelete(ci);
				}
			}

			this._emit('disconnect', e);
		}

		let hasStale = false;
		for (let _ in this.cache) { // eslint-disable-line no-unused-vars
			hasStale = true;
			break;
		}

		this.tryConnect = hasStale && this.tryConnect;

		if (this.tryConnect) {
			this._reconnect(wasConnected);
		}
	}

	/**
	 * Resolves the connection promise
	 * @private
	 */
	_connectResolve() {
		if (this.connectCallback) {
			this.connectCallback.resolve();
			this.connectCallback = null;
		}
	}

	/**
	 * Rejects the connection promise
	 * @param {*} e Error event
	 * @private
	 */
	_connectReject(e) {
		this.connectPromise = null;
		this.ws = null;

		if (this.connectCallback) {
			this.connectCallback.reject(e);
			this.connectCallback = null;
		}
	}

	_emit(event, data) {
		this.eventBus.emit(this, event, data, this.namespace);
	}

	/**
	 * Tries to delete the cached item.
	 * It will delete if there are no direct listeners, indirect references, or any subscription.
	 * @param {object} ci Cache item to delete
	 * @private
	 */
	_tryDelete(ci) {
		let refs = this._getRefState(ci);

		for (let rid in refs) {
			let r = refs[rid];
			switch (r.st) {
			case stateStale:
				this._setStale(rid);
				break;
			case stateDelete:
				this._deleteRef(r.ci);
				break;
			}
		}
	}

	/**
	 * Reference State object
	 * @typedef {object} RefState
	 * @property {CacheItem} ci Cache item
	 * @property {Number} rc Reference count from external references.
	 * @property {Number} st State. Is either stateDelete, stateKeep, or stateStale.
	 * @private
	 */

	/**
	 * Gets the reference state for a cacheItem and all its references
	 * if the cacheItem was to be removed.
	 * @param {CacheItem} ci Cache item
	 * @return {Object.<string, RefState>} A key value object with key being the rid, and value being a RefState array.
	 * @private
	 */
	_getRefState(ci) {
		let refs = {};
		// Quick exit
		if (ci.subscribed) {
			return refs;
		}
		refs[ci.rid] = { ci, rc: ci.indirect, st: stateNone };
		this._traverse(ci, this._seekRefs.bind(this, refs), 0, true);
		this._traverse(ci, this._markDelete.bind(this, refs), stateDelete);
		return refs;
	}

	/**
	 * Seeks for resources that no longer has any reference and may
	 * be deleted.
	 * Callback used with _traverse.
	 * @param {*} refs References
	 * @param {*} ci Cache item
	 * @param {*} state State as returned from parent's traverse callback
	 * @returns {*} State to pass to children. False means no traversing to children.
	 * @private
	 */
	_seekRefs(refs, ci, state) {
		// Quick exit if it is already subscribed
		if (ci.subscribed) {
			return false;
		}

		let rid = ci.rid;
		let r = refs[rid];
		if (r) {
			r.rc--;
			return false;
		}

		refs[rid] = { ci, rc: ci.indirect - 1, st: stateNone };
		return true;
	}

	/**
	 * Marks reference as stateDelete, stateKeep, or stateStale, depending on
	 * the values returned from a _seekRefs traverse.
	 * @param {*} refs References
	 * @param {*} ci Cache item
	 * @param {*} state State as returned from parent's traverse callback
	 * @return {*} State to pass to children. False means no traversing to children.
	 * @private
	 */
	_markDelete(refs, ci, state) {
		// Quick exit if it is already subscribed
		if (ci.subscribed) {
			return false;
		}

		let rid = ci.rid;
		let r = refs[rid];

		if (r.st === stateKeep) {
			return false;
		}

		if (state === stateDelete) {

			if (r.rc > 0) {
				r.st = stateKeep;
				return rid;
			}

			if (r.st !== stateNone) {
				return false;
			}

			if (r.ci.direct) {
				r.st = stateStale;
				return rid;
			}

			r.st = stateDelete;
			return stateDelete;
		}

		// A stale item can never cover itself
		if (rid === state) {
			return false;
		}

		r.st = stateKeep;
		return r.rc > 0 ? rid : state;
	}

	_deleteRef(ci) {
		let item = ci.item, ri;
		switch (ci.type) {
		case typeCollection:
			for (let v of item) {
				ri = this._getRefItem(v);
				if (ri) {
					ri.addIndirect(-1);
				}
			}
			break;
		case typeModel:
			for (let k in item) {
				if (item.hasOwnProperty(k)) {
					ri = this._getRefItem(item[k]);
					if (ri) {
						ri.addIndirect(-1);
					}
				}
			}
			break;
		}
		delete this.cache[ci.rid];
		this._removeStale(ci.rid);
	}

	_getRefItem(v) {
		let rid = getRID(v);
		if (!rid) {
			return null;
		}
		let refItem = this.cache[rid];
		// refItem not in cache means
		// item has been deleted as part of
		// a refState object.
		if (!refItem) {
			return null;
		}
		return refItem;
	}

	_cacheResources(r) {
		if (!r || !(r.models || r.collections || r.errors)) {
			return;
		}

		let sync = {};
		resourceTypes.forEach(t => (sync[t] = this._createItems(r[t + 's'], this.types[t])));
		resourceTypes.forEach(t => this._initItems(r[t + 's'], this.types[t]));
		resourceTypes.forEach(t => this._syncItems(sync[t], this.types[t]));
	}

	_createItems(refs, type) {
		if (!refs) {
			return;
		}

		let sync;
		for (let rid in refs) {
			let ci = this.cache[rid];
			if (!ci) {
				ci = this.cache[rid] = new CacheItem(
					rid,
					this._unsubscribe
				);
			} else {
				// Remove item as stale if needed
				this._removeStale(rid);
			}
			// If an item is already set,
			// it has gone stale and needs to be synchronized.
			if (ci.item) {
				if (ci.type !== type.id) {
					console.error("Resource type inconsistency");
				} else {
					sync = sync || {};
					sync[rid] = refs[rid];
				}
				delete refs[rid];
			} else {
				let f = type.getFactory(rid);
				ci.setItem(f(this, rid), type.id);
			}
		}

		return sync;
	}

	_initItems(refs, type) {
		if (!refs) {
			return;
		}

		for (let rid in refs) {
			let cacheItem = this.cache[rid];
			cacheItem.item.__init(type.prepareData(refs[rid]));
		}
	}

	_syncItems(refs, type) {
		if (!refs) {
			return;
		}

		for (let rid in refs) {
			let ci = this.cache[rid];
			type.synchronize(ci, refs[rid]);
		}
	}

	_syncModel(cacheItem, data) {
		this._handleChangeEvent(cacheItem, 'change', { values: data }, true);
	}

	_syncCollection(cacheItem, data) {
		let collection = cacheItem.item;
		let i = collection.length;
		let a = new Array(i);
		while (i--) {
			a[i] = collection.atIndex(i);
		}

		let b = data.map(v => this._prepareValue(v));
		this._patchDiff(a, b,
			(id, m, n, idx) => {},
			(id, n, idx) => this._handleAddEvent(cacheItem, 'add', {
				value: data[n],
				idx: idx
			}),
			(id, m, idx) => this._handleRemoveEvent(cacheItem, 'remove', { idx })
		);
	}

	_patchDiff(a, b, onKeep, onAdd, onRemove) {
		// Do a LCS matric calculation
		// https://en.wikipedia.org/wiki/Longest_common_subsequence_problem
		let t, i, j, s = 0, aa, bb, m = a.length, n = b.length;

		// Trim of matches at the start and end
		while (s < m && s < n && equal(a[s], b[s])) {
			s++;
		}
		if (s === m && s === n) {
			return;
		}
		while (s < m && s < n && equal(a[m - 1], b[n - 1])) {
			m--;
			n--;
		}

		if (s > 0 || m < a.length) {
			aa = a.slice(s, m);
			m = aa.length;
		} else {
			aa = a;
		}
		if (s > 0 || n < b.length) {
			bb = b.slice(s, n);
			n = bb.length;
		} else {
			bb = b;
		}

		// Create matrix and initialize it
		let c = new Array(m + 1);
		for (i = 0; i <= m; i++) {
			c[i] = t = new Array(n + 1);
			t[0] = 0;
		}
		t = c[0];
		for (j = 1; j <= n; j++) {
			t[j] = 0;
		}

		for (i = 0; i < m; i++) {
			for (j = 0; j < n; j++) {
				c[i + 1][j + 1] = equal(aa[i], bb[j])
					? c[i][j] + 1
					: Math.max(c[i + 1][j], c[i][j + 1]);
			}
		}

		for (i = a.length - 1; i >= s + m; i--) {
			onKeep(a[i], i, i - m + n, i);
		}
		let idx = m + s;
		i = m;
		j = n;
		let r = 0;
		let adds = [];
		while (true) {
			m = i - 1;
			n = j - 1;
			if (i > 0 && j > 0 && equal(aa[m], bb[n])) {
				onKeep(aa[m], m + s, n + s, --idx);
				i--;
				j--;
			} else if (j > 0 && (i === 0 || c[i][n] >= c[m][j])) {
				adds.push([ n, idx, r ]);
				j--;
			} else if (i > 0 && (j === 0 || c[i][n] < c[m][j])) {
				onRemove(aa[m], m + s, --idx);
				r++;
				i--;
			} else {
				break;
			}
		}
		for (i = s - 1; i >= 0; i--) {
			onKeep(a[i], i, i, i);
		}

		// Do the adds
		let len = adds.length - 1;
		for (i = len; i >= 0; i--) {
			[ n, idx, j ] = adds[i];
			onAdd(bb[n], n + s, idx - r + j + len - i);
		}
	}

	_unsubscribe(ci) {
		if (!ci.subscribed) {
			if (this.stale && this.stale[ci.rid]) {
				this._tryDelete(ci);
			}
			return;
		}

		this._subscribeReferred(ci);

		let i = ci.subscribed;
		if (this.protocol < v1_2_1) {
			while (i--) {
				this._sendUnsubscribe(ci, 1);
			}
		} else {
			this._sendUnsubscribe(ci, i);
		}
	}

	_sendUnsubscribe(ci, count) {
		this._send('unsubscribe', ci.rid, null, count > 1 ? { count } : null)
			.then(() => {
				ci.addSubscribed(-count);
				this._tryDelete(ci);
			})
			.catch(() => this._tryDelete(ci));
	}

	_subscribeReferred(ci) {
		let i = ci.subscribed;
		ci.subscribed = 0;
		let refs = this._getRefState(ci);
		ci.subscribed = i;

		for (let rid in refs) {
			let r = refs[rid];
			if (r.st === stateStale) {
				this._subscribe(r.ci);
			}
		}
	}

	_handleFailedSubscribe(cacheItem) {
		cacheItem.addSubscribed(-1);
		this._tryDelete(cacheItem);
	}

	_reconnect(noDelay) {
		if (noDelay) {
			this.connect();
			return;
		}
		setTimeout(() => {
			if (!this.tryConnect) {
				return;
			}

			this.connect();
		}, reconnectDelay);
	}

	_resolvePath(url) {
		if (url.match(/^wss?:\/\//) || typeof document == 'undefined' || !document.createElement) {
			return url;
		}

		let a = document.createElement('a');
		a.href = url;

		return a.href.replace(/^http/, 'ws');
	}

	_traverse(ci, cb, state, skipFirst = false) {
		// Call callback to get new state to pass to
		// children. If false, we should not traverse deeper
		if (!skipFirst) {
			state = cb(ci, state);
			if (state === false) {
				return;
			}
		}

		let item = ci.item;
		switch (ci.type) {
		case typeCollection:
			for (let v of item) {
				let ci = this._getRefItem(v);
				if (ci) {
					this._traverse(ci, cb, state);
				}
			}
			break;
		case typeModel:
			for (let k in item) {
				if (item.hasOwnProperty(k)) {
					let ci = this._getRefItem(item[k]);
					if (ci) {
						this._traverse(ci, cb, state);
					}
				}
			}
			break;
		}
	}

	_prepareValue(v, addIndirect) {
		if (v !== null && typeof v == 'object') {
			if (v.rid) {
				// Resource reference
				if (v.soft) {
					// Soft reference
					v = new ResRef(this, v.rid);
				} else {
					// Non-soft reference
					let ci = this.cache[v.rid];
					if (addIndirect) {
						ci.addIndirect();
					}
					v = ci.item;
				}
			} else if (v.hasOwnProperty('data')) {
				// Data value
				v = v.data;
			} else if (v.action === 'delete') {
				v = undefined;
			} else {
				throw new Error("Invalid value: " + JSON.stringify(v));
			}
		}
		return v;
	}
}

export default ResClient;

export function isResError(o) {
	return o instanceof ResError;
};
