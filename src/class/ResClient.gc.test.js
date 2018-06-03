import ResClient from './ResClient.js';

describe("ResClient Garbage collection", () => {

	// Traverse states
	const stateDelete = 1;
	const stateKeep = 2;
	const stateStale = 3;

	const states = {
		0: 'stateNone',
		1: 'stateDelete',
		2: 'stateKeep',
		3: 'stateStale'
	};

	function expectRefState(refs, compare) {
		let r = {};
		Object.keys(refs).forEach(k => {
			r[k] = states[refs[k].st];
		});
		let c = {};
		Object.keys(compare).forEach(k => {
			c[k] = states[compare[k]];
		});

		expect(r).toEqual(c);
	};

	function getRefState(dta, root) {
		// Prepare refs object
		let refs = Object.assign({}, dta);
		Object.keys(refs).forEach(k => refs[k] = {
			rid: k,
			item: dta[k].refs || [],
			subscribed: !!dta[k].subscribed,
			direct: dta[k].direct || 0,
			indirect: 0,
			type: 'collection'
		});
		// Add indirect references
		Object.keys(refs).forEach(k => {
			refs[k].item.forEach(v => refs[v].indirect++);
		});

		let client = new ResClient("ws://localhost");
		client._getRefItem = v => refs[v];

		let r = refs[root];
		expect(r).not.toBe(undefined);
		let refState = client._getRefState(r);

		return refState;
	};


	describe("stateDelete", () => {

		it("marks value without reference for deletion", () => {
			let rs = getRefState({
				a: { refs: [] }
			}, 'a');

			expectRefState(rs, {
				a: stateDelete
			});
		});

		it("marks simple reference for deletion", () => {
			let rs = getRefState({
				a: { refs: [ 'b' ] },
				b: { refs: [] }
			}, 'a');

			expectRefState(rs, {
				a: stateDelete,
				b: stateDelete
			});
		});

		it("marks chained reference for deletion", () => {
			let rs = getRefState({
				a: { refs: [ 'b' ] },
				b: { refs: [ 'c' ] },
				c: { refs: [] }
			}, 'a');

			expectRefState(rs, {
				a: stateDelete,
				b: stateDelete,
				c: stateDelete
			});
		});

		it("marks complex reference for deletion", () => {
			let rs = getRefState({
				a: { refs: [ 'b', 'c' ] },
				b: { refs: [ 'd' ] },
				c: { refs: [ 'd' ] },
				d: { refs: [] }
			}, 'a');

			expectRefState(rs, {
				a: stateDelete,
				b: stateDelete,
				c: stateDelete,
				d: stateDelete
			});
		});

	});

	describe("stateKeep", () => {

		it("marks to keep subscribed root", () => {
			let rs = getRefState({
				a: { refs: [], subscribed: true }
			}, 'a');

			expectRefState(rs, {});
		});

		it("marks to keep root covered by other root", () => {
			let rs = getRefState({
				a: { refs: [] },
				b: { refs: [ 'a' ] }
			}, 'a');

			expectRefState(rs, {
				a: stateKeep
			});
		});

		it("marks to keep reference covered by other root", () => {
			let rs = getRefState({
				a: { refs: [ 'b' ] },
				b: { refs: [ 'd' ] },
				c: { refs: [ 'd' ] },
				d: { refs: [] }
			}, 'a');

			expectRefState(rs, {
				a: stateDelete,
				b: stateDelete,
				d: stateKeep
			});
		});

		it("marks to keep reference tree covered by other root", () => {
			let rs = getRefState({
				a: { refs: [ 'b', 'c' ] },
				b: { refs: [ 'd' ] },
				c: { refs: [ 'd' ] },
				d: { refs: [] },
				e: { refs: [ 'b' ] }
			}, 'a');

			expectRefState(rs, {
				a: stateDelete,
				b: stateKeep,
				c: stateDelete,
				d: stateKeep
			});
		});

	});

	describe("stale", () => {

		it("marks direct referenced item as stale", () => {
			let rs = getRefState({
				a: { refs: [ 'b', 'c' ] },
				b: { refs: [ 'c' ], direct: 1 },
				c: { refs: [] }
			}, 'a');

			expectRefState(rs, {
				a: stateDelete,
				b: stateStale,
				c: stateKeep
			});
		});

		it("marks direct referenced as keep if covered by another stale reference", () => {
			let rs = getRefState({
				a: { refs: [ 'b', 'c' ] },
				b: { refs: [ 'd' ], direct: 1 },
				c: { refs: [ 'b' ], direct: 1 },
				d: { refs: [] }
			}, 'a');

			expectRefState(rs, {
				a: stateDelete,
				b: stateKeep,
				c: stateStale,
				d: stateKeep
			});
		});

	});

	describe("cyclic reference", () => {

		it("marks simple cyclic reference for deletion", () => {
			let rs = getRefState({
				a: { refs: [ 'a' ] }
			}, 'a');

			expectRefState(rs, {
				a: stateDelete
			});
		});

		it("marks to keep reference root when reference is covered by other root in cyclic tree", () => {
			let rs = getRefState({
				a: { refs: [ 'b', 'd' ] },
				b: { refs: [ 'c' ] },
				c: { refs: [ 'a' ] },
				d: { refs: [] },
				e: { refs: [ 'c' ] }
			}, 'a');

			expectRefState(rs, {
				a: stateKeep,
				b: stateKeep,
				c: stateKeep,
				d: stateKeep
			});
		});

		it("marks to keep cyclic group when one item is covered by other root", () => {
			let rs = getRefState({
				a: { refs: [ 'b' ] },
				b: { refs: [ 'c' ] },
				c: { refs: [ 'b' ] },
				d: { refs: [ 'c' ] }
			}, 'a');

			expectRefState(rs, {
				a: stateDelete,
				b: stateKeep,
				c: stateKeep
			});
		});

		it("marks directly referenced cyclic reference as stale", () => {
			let rs = getRefState({
				a: { refs: [ 'b' ] },
				b: { refs: [ 'b' ], direct: 1 }
			}, 'a');

			expectRefState(rs, {
				a: stateDelete,
				b: stateStale
			});
		});

		it("marks only one reference in cyclic group as stale if multiple directly references exist", () => {
			let rs = getRefState({
				a: { refs: [ 'b' ] },
				b: { refs: [ 'c' ], direct: 1 },
				c: { refs: [ 'd' ], direct: 1 },
				d: { refs: [ 'b' ], direct: 1 }
			}, 'a');

			expectRefState(rs, {
				a: stateDelete,
				b: stateStale,
				c: stateKeep,
				d: stateKeep
			});
		});

	});
});
