const unsubscribeDelay = 5000; // ms

class CacheItem {

	/**
	 * Creates a CacheItem instance
	 * @param {string} rid Resource ID
	 * @param {function} unsubscribe Unsubscribe callback
	 */
	constructor(rid, unsubscribe) {
		this.rid = rid;
		this._unsubscribe = unsubscribe;

		this.type = null;
		this.item = null;
		this.direct = 0;
		this.indirect = 0;
		this.subscribed = 0; // Count of direct subscriptions towards Resgate
		this.promise = null;
	}

	/**
	 * Adds or subtracts from the subscribed counter.
	 * @param {number} dir Value to add. If 0, the subscribed counter will be set to 0.
	 */
	addSubscribed(dir) {
		this.subscribed += dir ? dir : -this.subscribed;
		if (!this.subscribed && this.unsubTimeout) {
			clearTimeout(this.unsubTimeout);
			this.unsubTimeout = null;
		}
	}

	setPromise(promise) {
		if (!this.item) {
			this.promise = promise;
		}
		return promise;
	}

	setItem(item, type) {
		this.item = item;
		this.type = type;
		this.promise = null;
		this._checkUnsubscribe();
		return this;
	}

	setType(modelType) {
		this.type = modelType;
		return this;
	}

	addDirect() {
		if (this.unsubTimeout) {
			clearTimeout(this.unsubTimeout);
			this.unsubTimeout = null;
		}
		this.direct++;
	}

	removeDirect() {
		this.direct--;
		if (this.direct < 0) {
			throw "Direct count reached below 0";
		}
		if (this.subscribed) {
			this._checkUnsubscribe();
		} else {
			// The subscription might be stale and should then be removed directly
			this._unsubscribe(this);
		}
	}

	resetTimeout() {
		if (this.unsubTimeout) {
			clearTimeout(this.unsubTimeout);
			this.unsubTimeout = null;
			this._checkUnsubscribe();
		}
	}

	_checkUnsubscribe() {
		if (!this.subscribed || this.direct || this.unsubTimeout) {
			return;
		}

		this.unsubTimeout = setTimeout(() => this._unsubscribe(this), unsubscribeDelay);
	}

	addIndirect(n = 1) {
		this.indirect += n;
		if (this.indirect < 0) {
			throw "Indirect count reached below 0";
		}
	}

}

export default CacheItem;
