import ResCollection from './ResCollection.js';

describe("ResCollection", () => {

	let primitives;
	let models;

	beforeEach(() => {
		primitives = new ResCollection(null, 'service.primitives');
		primitives.__init([
			"Ten",
			"Twenty",
			false,
			null
		]);

		models = new ResCollection(null, 'services.models', {
			idCallback: m => m.id
		});
		models.__init([
			{ id: 10, name: "Ten" },
			{ id: 20, name: "Twenty" },
			{ id: 30, name: "Thirty" },
		]);
	});

	describe("primitives", () => {

		it("adds a primitive item", () => {
			primitives.__add("Thirty", 2);
			expect(primitives.atIndex(0)).toBe("Ten");
			expect(primitives.atIndex(1)).toBe("Twenty");
			expect(primitives.atIndex(2)).toBe("Thirty");
			expect(primitives.atIndex(3)).toBe(false);
			expect(primitives.atIndex(4)).toBe(null);
		});

		it("removes a primitive item", () => {
			primitives.__remove(2);
			expect(primitives.atIndex(0)).toBe("Ten");
			expect(primitives.atIndex(1)).toBe("Twenty");
			expect(primitives.atIndex(2)).toBe(null);
		});

	});

	describe("models", () => {

		it("gets model by id", () => {
			expect(models.get(10)).toEqual({ id: 10, name: "Ten" });
			expect(models.get(20)).toEqual({ id: 20, name: "Twenty" });
			expect(models.get(30)).toEqual({ id: 30, name: "Thirty" });
		});

		it("adds a model item", () => {
			models.__add({ id: 15, name: "Fifteen" }, 1);
			expect(models.get(10)).toEqual({ id: 10, name: "Ten" });
			expect(models.get(15)).toEqual({ id: 15, name: "Fifteen" });
			expect(models.atIndex(0)).toBe(models.get(10));
			expect(models.atIndex(1)).toBe(models.get(15));
			expect(models.atIndex(2)).toBe(models.get(20));
			expect(models.atIndex(3)).toBe(models.get(30));
		});

		it("removes a model item", () => {
			models.__remove(2);
			expect(models.get(10)).toEqual({ id: 10, name: "Ten" });
			expect(models.get(20)).toEqual({ id: 20, name: "Twenty" });
			expect(models.get(30)).toBe(undefined);
			expect(models.atIndex(0)).toBe(models.get(10));
			expect(models.atIndex(1)).toBe(models.get(20));
		});

		it("throws an error on adding duplicate keys", () => {
			expect(() => models.__add({ id: 20, name: "NewTwenty" }, 0)).toThrow();
		});

	});

});
