import SortedMap from 'modapp-resource/SortedMap';
import * as obj from 'modapp-utils/obj';

/**
 * ResCollection represents a collection provided over the RES API.
 * @implements {module:modapp~Collection}
 */
class ResCollection {

	/**
	 * Creates an ResCollection instance
	 * @param {ResClient} api ResClient instance
	 * @param {string} rid Resource id.
	 * @param {Array.<object>} data ResCollection data array
	 * @param {object} [opt] Optional settings
	 * @param {function} [opt.compare] Compare function for sort order. Defaults to insert order.
	 * @param {function} [opt.idAttribute] Id attribute callback function. Defaults to returning the object.id property.
	 */
	constructor(api, rid, data, opt) {
		opt = obj.copy(opt, {
			compare: { type: '?function' },
			idAttribute: { type: '?function' }
		});

		this._rid = rid;
		this._api = api;
		this._idAttribute = opt.idAttribute;

		this._modelResources = this._idAttribute ? {} : null;
		this._map = new SortedMap(opt.compare);

		// Populate map with initial data
		if (data) {
			for (let cont of data) {
				this._map.add(cont.rid, cont.model);
				if (this._idAttribute) {
					this._modelResources[this._idAttribute(cont.model)] = cont.rid;
				}
			}
		}
	}

	/**
	 * Collection resource ID
	 * @returns {string} Resource ID
	 */
	getResourceId() {
		return this._rid;
	}

	/**
	 * Length of the collection
	 */
	get length() {
		return this._map.length;
	}

	/**
	 * Attach a collection event handler function for one or more events.
	 * If no event or handler is provided, the collection will still be considered listened to,
	 * until a matching off call without arguments is made.
	 * Available events are 'add', 'remove', and 'move'.
	 * @param {?string} [events] One or more space-separated events. Null means any event.
	 * @param {eventCallback} [handler] Handler function to execute when the event is emitted.
	 * @returns {this}
	 */
	on(events, handler) {
		this._api.resourceOn(this._rid, events, handler);
		return this;
	}

	 /**
	 * Remove a collection event handler function.
	 * Available events are 'add', 'remove', and 'move'.
	 * @param {?string} [events] One or more space-separated events. Null means any event.
	 * @param {eventCallback} [handler] Handler function to remove.
	 * @returns {this}
	 */
	off(events, handler) {
		this._api.resourceOff(this._rid, events, handler);
		return this;
	}

	/**
	 * Get a model from the collection by id
	 * @param {string} id Id of the model
	 * @returns {*} Stored model. Undefined if key doesn't exist
	 */
	get(id) {
		let rid = this._idAttribute ? this._modelResources[id] : id;
		return this._map.get(rid);
	}

	/**
	 * Retrieves the order index of a model.
	 * @param {string|Model} id Id of the model or the model object
	 * @returns {number} Order index of the model. -1 if the model id doesn't exist.
	 */
	indexOf(id) {
		if (id && typeof id !== 'object') {
			let rid = this._idAttribute ? this._modelResources[id] : id;
			id = rid ? this._map.get(rid) : null;
		}
		return id ? this._map.indexOf(id) : -1;
	}

	/**
	 * Gets a model from the collection by index position
	 * @param {number} idx  Index of the model
	 * @returns {module:modapp~Model} Stored model. Undefined if the index is out of bounds.
	 */
	atIndex(idx) {
		return this._map[idx];
	}

	/**
	 * Creates a new model for the collection at the server.
	 * Server will return an error if the collection doesn't support creation.
	 * @param {object} props Model properties
	 * @returns {Promise.<Model>} Promise of the created model.
	 */
	create(props) {
		return this._api.createModel(this._rid, props);
	}

	/**
	 * Removes an existing model from the collection at the server.
	 * Server will return an error if the collection doesn't support removal.
	 * @param {string} modelId Model resource id
	 * @return {Promise} Promise of the removal.
	 */
	remove(modelId) {
		return this._api.removeModel(this._rid, modelId);
	}

	/**
	 * Add a model to the collection.
	 * Should only be called from api module.
	 * @param {string} modelId Model resource id
	 * @param {object} model Model object
	 * @param {idx} [idx] Index value of where to insert the model. Ignored if the collection has a compare function.
	 * @returns {number} Index value of where the model was inserted in the list
	 * @private
	 */
	__add(modelId, model, idx) {
		idx = this._map.add(modelId, model, idx);

		if (this._idAttribute) {
			this._modelResources[this._idAttribute(model)] = modelId;
		}
		return idx;
	}

	/**
	 * Remove a model from the collection.
	 * Should only be called from api module.
	 * @param {number} idx Index of the item to remove
	 * @returns {*} Removed item or undefined if no item was removed
	 * @private
	 */
	__remove(idx) {
		let model = this._map[idx];
		if (model === undefined) {
			return model;
		}

		this._map.remove(model.getResourceId());

		if (this._idAttribute) {
			delete this._modelResources[this._idAttribute(model)];
		}

		return model;
	}

	toJSON() {
		let m;
		let len = this._map.length;
		let arr = new Array(len);
		for (let i = 0; i < len; i++) {
			m = this._map[i];
			arr[i] = m.toJSON ? m.toJSON() : m;
		}

		return arr;
	}

	[Symbol.iterator]() {
		let i = 0,
			a = this._map,
			l = a.length;

		return {
			next: function() {
				return { value: a[i++], done: i > l };
			}
		};
	}
}

export default ResCollection;
