import TypeList from './TypeList.js';

describe("TypeList", () => {

	let typeList;
	const defaultFactory = () => {};
	const fa = () => {};
	const fb = () => {};

	beforeEach(() => {
		typeList = new TypeList(defaultFactory);
	});

	describe("addFactory", () => {

		it("adds a factory function without using wildcards", () => {
			typeList.addFactory('foo.bar', fa);
			typeList.addFactory('foo.baz', fa);
			typeList.addFactory('foo.bar.b', fa);
			typeList.addFactory('foo.b', fa);
			typeList.addFactory('foo.c', fa);
			typeList.addFactory('foo.b.baz', fa);
		});

		it("adds a factory function using * wildcard", () => {
			typeList.addFactory('foo.*', fa);
		});

		it("adds a factory function using > wildcard", () => {
			typeList.addFactory('foo.>', fa);
		});

		it("adds a factory function using only * wildcard", () => {
			typeList.addFactory('*', fa);
		});

		it("adds a factory function using only > wildcard", () => {
			typeList.addFactory('>', fa);
		});

		it("adds a factory function using multiple wildcards", () => {
			typeList.addFactory('foo.*.bar.*.*.baz.>', fa);
		});

		it("adds two factory functions with similar pattern", () => {
			typeList.addFactory('foo.*', fa);
			typeList.addFactory('foo.*.bar', fb);
		});

		it("throws error on empty token", () => {
			expect(() => {
				typeList.addFactory('foo..bar', fa);
			}).toThrow();
		});

		it("throws error on using > wildcard as non-last token", () => {
			expect(() => {
				typeList.addFactory('foo.>.bar', fa);
			}).toThrow();
		});

		it("throws error on adding the same pattern twice", () => {
			typeList.addFactory('foo.*.bar.*.*.baz.>', fa);
			expect(() => {
				typeList.addFactory('foo.*.bar.*.*.baz.>', fb);
			}).toThrow();
		});

	});

	describe("getFactory", () => {

		it("gets default factory function on empty list", () => {
			expect(typeList.getFactory('foo')).toBe(defaultFactory);
			expect(typeList.getFactory('foo.bar')).toBe(defaultFactory);
		});

		it("gets a factory function with single token", () => {
			typeList.addFactory('foo', fa);
			expect(typeList.getFactory('foo')).toBe(fa);
			expect(typeList.getFactory('bar')).toBe(defaultFactory);
		});

		it("gets a factory function without using wildcards", () => {
			typeList.addFactory('foo.b', fa);
			expect(typeList.getFactory('foo.b')).toBe(fa);
			expect(typeList.getFactory('foo.bar')).toBe(defaultFactory);
		});

		it("gets a factory function using * wildcard", () => {
			typeList.addFactory('foo.*', fa);
			expect(typeList.getFactory('foo.bar')).toBe(fa);
			expect(typeList.getFactory('foo.bar.baz')).toBe(defaultFactory);
		});

		it("gets a factory function using > wildcard", () => {
			typeList.addFactory('foo.>', fa);
			expect(typeList.getFactory('foo.bar')).toBe(fa);
			expect(typeList.getFactory('foo.bar.baz')).toBe(fa);
		});

		it("gets a factory function using only * wildcard", () => {
			typeList.addFactory('*', fa);
			expect(typeList.getFactory('foo')).toBe(fa);
			expect(typeList.getFactory('foo.bar')).toBe(defaultFactory);
		});

		it("gets a factory function using only > wildcard", () => {
			typeList.addFactory('>', fa);
			expect(typeList.getFactory('foo')).toBe(fa);
			expect(typeList.getFactory('foo.bar')).toBe(fa);
		});

		it("gets default factory function on partial match", () => {
			typeList.addFactory('foo.bar', fa);
			expect(typeList.getFactory('foo')).toBe(defaultFactory);
		});

	});

	describe("factory priority", () => {

		it("matches text before * wildcard", () => {
			typeList.addFactory('foo.bar', fa);
			typeList.addFactory('foo.*', fb);
			expect(typeList.getFactory('foo.bar')).toBe(fa);
		});

		it("matches text before > wildcard", () => {
			typeList.addFactory('foo.bar', fa);
			typeList.addFactory('foo.>', fb);
			expect(typeList.getFactory('foo.bar')).toBe(fa);
		});

		it("matches * wildcard before > wildcard", () => {
			typeList.addFactory('foo.*', fa);
			typeList.addFactory('foo.>', fb);
			expect(typeList.getFactory('foo.bar')).toBe(fa);
		});

		it("matches tokens with priority left to right", () => {
			typeList.addFactory('foo.bar.>', fa);
			typeList.addFactory('foo.*.baz', fb);
			typeList.addFactory('foo.>', fb);
			expect(typeList.getFactory('foo.bar.baz')).toBe(fa);
		});
	});

});
