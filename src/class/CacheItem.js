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
		this.subscribed = false;
		this.promise = null;
	}

	setSubscribed(isSubscribed) {
		this.subscribed = isSubscribed;
		if (!isSubscribed && this.unsubTimeout) {
			clearTimeout(this.unsubTimeout);
			this.unsubTimeout = null;
		}
		return this;
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
			// The subscription is stale and should be removed directly
			this._unsubscribe(this);
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
	}

	removeIndirect(n = 1) {
		this.indirect -= n;
		if (this.indirect < 0) {
			throw "Indirect count reached below 0";
		}
	}

}

export default CacheItem;
