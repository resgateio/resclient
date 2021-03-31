import { obj } from 'modapp-utils';
import equal from './equal';

/**
 * Change event emitted on any change to one or more public (non-underscore) properties.
 * @callback ResModel~changeCallback
 * @param {Object.<string,*>} changed Changed key/value object where key is the changed property, and value is the old property value.
 * @param {Model} model ResModel emitting the event.
 * @param {string} event Event name including namespace.
 * @param {?string} action Event action.
 */

/**
 * ResModel represents a model provided over the RES API.
 * @implements {module:modapp~Model}
 */
class ResModel {

	/**
	 * Creates a ResModel instance
	 * @param {ResClient} api ResClient instance
	 * @param {string} rid Resource id.
	 * @param {object} [opt] Optional parameters.
	 * @param {object} [opt.definition] Object definition. If not provided, any value will be allowed.
	 */
	constructor(api, rid, opt) {
		obj.update(this, opt, {
			definition: { type: '?object', property: '_definition' }
		});

		this._rid = rid;
		this._api = api;
		this._props = {};
	}

	/**
	 * Model properties.
	 * @returns {object} Anonymous object with all model properties.
	 */
	get props() {
		return this._props;
	}

	/**
	 * ResClient instance.
	 * @returns {ResClient} ResClient instance
	 */
	getClient() {
		return this._api;
	}

	/**
	 * Model resource ID
	 * @returns {string} Resource ID
	 */
	getResourceId() {
		return this._rid;
	}

	/**
	 * Attach a model event handler function for one or more events.
	 * If no event or handler is provided, the model will still be considered listened to,
	 * until a matching off call without arguments is made.
	 * Available events are 'change', or custom events.
	 * @param {?string} [events] One or more space-separated events. Null means any event.
	 * @param {ResModel~changeCallback|eventCallback} [handler] Handler function to execute when the event is emitted.
	 * @returns {this}
	 */
	on(events, handler) {
		this._api.resourceOn(this._rid, events, handler, this);
		return this;
	}

	 /**
	 * Remove a model event handler function.
	 * Available events are 'change', or custom events.
	 * @param {?string} events One or more space-separated events. Null means any event.
	 * @param {ResModel~changeCallback|eventCallback} [handler] Handler function to remove.
	 * @returns {this}
	 */
	off(events, handler) {
		this._api.resourceOff(this._rid, events, handler, this);
		return this;
	}

	/**
	 * Calls the set method to update model properties.
	 * @param {object} props Properties. Set value to undefined to delete a property.
	 * @returns {Promise.<object>} Promise of the call being completed.
	 */
	set(props) {
		return this._api.setModel(this._rid, props);
	}

	/**
	 * Calls a method on the model.
	 * @param {string} method Method name
	 * @param {*} params Method parameters
	 * @returns {Promise.<object>} Promise of the call result.
	 */
	call(method, params) {
		return this._api.call(this._rid, method, params);
	}

	/**
	 * Calls an auth method on the model.
	 * @param {string} method Auth method name
	 * @param {*} params Method parameters
	 * @returns {Promise.<object>} Promise of the auth result.
	 */
	auth(method, params) {
		return this._api.authenticate(this._rid, method, params);
	}

	/**
	 * Initializes the model with a data object.
	 * Should only be called by the ResClient instance.
	 * @param {object} data Data object
	 * @private
	 */
	__init(data) {
		this.__update(data);
	}

	/**
	 * Updates the model.
	 * Should only be called by the ResClient instance.
	 * @param {object} props Properties to update
	 * @param {boolean} reset Flag that sets if missing values should be deleted.
	 * @returns {?object} Changed properties
	 * @private
	 */
	__update(props, reset) {
		if (!props) {
			return null;
		}

		let changed = null;
		let v, promote;
		let p = this._props;

		if (reset) {
			props = Object.assign({}, props);
			for (var k in p) {
				if (!props.hasOwnProperty(k)) {
					props[k] = undefined;
				}
			}
		}

		if (this._definition) {
			changed = obj.update(p, props, this._definition);
			for (let key in changed) {
				if ((this.hasOwnProperty(key) || !this[key]) && key[0] !== '_') {
					v = p[key];
					if (v === undefined) {
						delete this[key];
					} else {
						this[key] = v;
					}
				}
			}
		} else {
			for (let key in props) {
				v = props[key];
				promote = (this.hasOwnProperty(key) || !this[key]) && key[0] !== '_';
				if (!equal(p[key], v)) {
					changed = changed || {};
					changed[key] = p[key];
					if (v === undefined) {
						delete p[key];
						if (promote) delete this[key];
					} else {
						p[key] = v;
						if (promote) this[key] = v;
					}
				}
			}
		}

		return changed;
	}

	toJSON() {
		let o = this._definition
			? obj.copy(this._props, this._definition)
			: Object.assign({}, this._props);
		for (let k in o) {
			var v = o[k];
			if (typeof v === 'object' && v !== null && v.toJSON) {
				o[k] = v.toJSON();
			}
		}
		return o;
	}
}

export default ResModel;
