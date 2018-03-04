import SortedMap from 'modapp-resource/SortedMap';
import * as obj from 'modapp-utils/obj';

/**
 * ResModel holds a collection provided over the RES API.
 * @implements {module:modapp~Collection}
 */
class ResCollection {

	/**
	 * Creats an ResCollection instance
	 * @param {ResClient} api ResClient instance
	 * @param {string} rid Resource id.
	 * @param {object} [opt] Optional settings
	 * @param {Array.<object>} [opt.data] ResCollection data array
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
					this._modelResources[this._idAttribute(cont.model)] = rid;
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
	 * Attach an event handler function for one or more instance events.
	 * Available events are 'add', 'remove', and 'move'.
	 * @param {?string} events One or more space-separated events. Null means any event.
	 * @param {EventBus~eventCallback} [handler] A function to execute when the event is emitted.
	 * @returns {this}
	 */
	on(events, handler) {
		this._api.resourceOn(this._rid, events, handler);
		return this;
	}

	 /**
	 * Remove an instance event handler.
	 * Available events are 'add', 'remove', and 'move'.
	 * @param {?string} events One or more space-separated events. Null means any event.
	 * @param {EventBus~eventCallback} [handler] An option handler function. The handler will only be remove if it is the same handler.
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
	 * Retrieves the order index of an model.
	 * @param {string} id Id of the model
	 * @returns {number} Order index of the model. -1 if the model id doesn't exist.
	 */
	indexOfId(id) {
		let modelId = this._idAttribute ? this._modelResources[id] : id;
		return this._map.indexOf(modelId);
	}

	/**
	 * Gets a model from the collection by index position
	 * @param {number} idx  Index of the model
	 * @returns {*} Stored model. Undefined if the index is out of bounds.
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
	 * @param {string} modelId Model resource id
	 * @returns {number} Index of the model before removal. -1 if the model id doesn't exist
	 * @private
	 */
	__remove(modelId) {
		let model = this._map.get(modelId);
		if (!model) {
			return -1;
		}

		let idx = this._map.remove(modelId);

		if (this._idAttribute) {
			delete this._modelResources[this._idAttribute(model)];
		}

		return idx;
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