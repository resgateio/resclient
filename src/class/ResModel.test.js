import ResModel from './ResModel.js';

describe("ResModel", () => {

	describe("__init", () => {

		it("initializes the model with data", () => {
			let model = new ResModel(null, 'service.model');
			model.__init({
				foo: "bar",
				int: 42
			});
			expect(model.foo).toBe("bar");
			expect(model.int).toBe(42);
		});

		it("does not overwrite existing ResModel properties", () => {
			let model = new ResModel(null, 'service.model');
			let o = {};
			for (let k in model) {
				o[k] = k;
			}
			model.__init(o);
			for (let k in o) {
				expect(model[k]).not.toBe(k);
			}
		});

		it("initializes the model with linked resources", () => {
			let model = new ResModel(null, 'service.model');
			let childModel = new ResModel(null, 'service.model.child');
			model.__init({ child: childModel });
			expect(model.child).toBe(childModel);
		});

	});

	describe("props", () => {

		it("returns the properties", () => {
			let model = new ResModel(null, 'service.model');
			model.__init({
				foo: "bar",
				int: 42
			});
			expect(model.props).toEqual({ foo: "bar", int: 42 });
		});

		it("returns hidden properties", () => {
			let model = new ResModel(null, 'service.model');
			let o = {};
			for (let k in model) {
				o[k] = k;
			}
			model.__init(o);
			expect(model.props).toEqual(o);
		});
	});

	describe("toJSON", () => {

		it("returns the properties", () => {
			let model = new ResModel(null, 'service.model');
			model.__init({
				foo: "bar",
				int: 42
			});
			expect(model.toJSON()).toEqual({ foo: "bar", int: 42 });
		});

		it("returns hidden properties", () => {
			let model = new ResModel(null, 'service.model');
			let o = {};
			for (let k in model) {
				o[k] = k;
			}
			model.__init(o);
			expect(model.toJSON()).toEqual(o);
		});

		it("returns linked resources", () => {
			let model = new ResModel(null, 'service.model');
			let childModel = new ResModel(null, 'service.model.child');
			childModel.__init({ zoo: "baz" });
			model.__init({ foo: "bar", child: childModel });
			expect(model.toJSON()).toEqual({ foo: "bar", child: { zoo: "baz" }});
		});

	});

	describe("__update", () => {

		it("updates properties with new value", () => {
			let model = new ResModel(null, 'service.model');
			model.__init({
				foo: "bar",
				int: 42
			});
			let changed = model.__update({ foo: "baz" });
			expect(changed).toEqual({ foo: "bar" });
			expect(model.foo).toBe("baz");
			expect(model.props.foo).toBe("baz");
		});

		it("updates hidden properties with new value", () => {
			let model = new ResModel(null, 'service.model');
			model.__init({
				foo: "bar",
				int: 42,
				on: "on",
				_api: true
			});
			let changed = model.__update({ on: "off", _api: false });
			expect(changed).toEqual({ on: "on", _api: true });
			expect(model.on).not.toBe("off");
			expect(model.props.on).toBe("off");
			expect(model._api).not.toBe(false);
			expect(model.props._api).toBe(false);
		});

		it("returns null on empty props", () => {
			let model = new ResModel(null, 'service.model');
			model.__init({ foo: "bar", int: 42 });
			let changed = model.__update(null);
			expect(changed).toBe(null);
		});
	});
});
