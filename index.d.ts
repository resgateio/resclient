export class CacheItem<I = unknown> {
	constructor(rid: string, unsubscribe: (item: CacheItem) => void);
	rid: string;
	type: string | null;
	item: I | null;
	direct: number;
	indirect: number;
	subscribed: number;
	promise: Promise<unknown> | null;
	addSubscribed(dir: number): void;
	setPromise<P extends Promise<unknown>>(promise: P): P;
	setItem(item: I, type: string): this;
	setType(type: string): this;
	addDirect(): void;
	removeDirect(): void;
	resetTimeout(): void;
	addIndirect(n?: number): void;
}

export interface ClientOptions {
	onConnect?(): void;
	namespace: string;
	eventBus: any; // import("modapp-eventbus").EventBus
}

export interface Type {
	id: string;
	prepareData(data: unknown): unknown;
	getFactory(rid: string): (data: unknown) => unknown;
	syncronize(cacheItem: unknown, data: unknown): void;
}

export class ResClient {
	constructor(hostUrlOrFactory: string | (() => WebSocket), options?: ClientOptions);
	tryConnect: boolean;
	connected: boolean;
	ws: WebSocket | null;
	requests: {};
	reqId: number;
	cache: Record<string, CacheItem>;
	stale: null;
	connectPromise: Promise<void> | null;
	connectCallback: {
		resolve?(): void;
		reject?(err: Error): void;
	} | null;
	types: {
		model: Type & { list: TypeList; };
		collection: Type & { list: TypeList; };
		error: Type;
	};
	readonly supportedProtocol: string;
	connect(): Promise<void>;
	disconnect(): void;
	getHostUrl(): string | null;
	on(events: string | null, handler: Function): void;
	off(events: string | null, handler: Function): void;
	setOnConnect(onConnect: Function): this;
	registerModelType(pattern: string, factory: Function): this;
	unregisterModelType(pattern: string): this;
	registerCollectionType(pattern: string, factory: Function): this;
	unregisterCollectionType(pattern: string): this;
	get<T = unknown>(rid: string): Promise<T>;
	call<T = unknown>(rid: string, method: string, params: Record<string, unknown>): Promise<T>;
	authenticate<T = unknown>(rid: string, method: string, params: Record<string, unknown>): Promise<T>;
	create<T = unknown>(rid: string, params: Record<string, unknown>): Promise<T>;
	setModel<T = unknown>(id: string, props: Record<string, unknown>): Promise<T>;
	resourceOn(rid: string, events: string | null, handler: Function): void;
	resourceOff(rid: string, events: string | null, handler: Function): void;
}

export function isResError(input: unknown): input is ResError;

export class ResCollection<O = unknown> {
	constructor(api: ResClient, rid: string, opt?: { idCallback?: () => void; });
	readonly length: number;
	readonly list: Array<ResModel & O>;
	getClient(): ResClient;
	getResourceId(): string;
	on(events: string | null, handler: Function): this;
	off(events: string | null, handler: Function): this;
	get(id: string): ResModel & O | undefined
	indexOf(model: ResModel & O): number;
	atIndex(index: number): ResModel & O | undefined;
	call<T = unknown>(method: string, params: Record<string, unknown>): Promise<T>;
	auth<T = unknown>(method: string, params: Record<string, unknown>): Promise<T>;
	toArray(): Array<ResModel & O>;
	toJSON(): object;
	[Symbol.iterator](): IterableIterator<ResModel & O>;
}

export class ResError {
	constructor(rid: string, method: string, params: Record<string, unknown>);
	rid: string;
	method?: string;
	params?: Record<string, unknown>;
	readonly code: string;
	readonly message: string;
	readonly data: unknown;
	getResourceId(): string;
}

export class ResModel {
	constructor(api: ResClient, rid: string, opt?: { definition?: object; });
	readonly props: Record<string, unknown>;
	getClient(): ResClient;
	getResourceId(): string;
	on(events: string | null, handler: Function): this;
	off(events: string | null, handler: Function): this;
	set<T = unknown>(props: Record<string, unknown>): T;
	call<T = unknown>(method: string, params: Record<string, unknown>): Promise<T>;
	auth<T = unknown>(method: string, params: Record<string, unknown>): Promise<T>;
	toJSON(): object;
}

export class ResRef {
	constructor(api: ResClient, rid: string);
	readonly rid: string;
	get<T = unknown>(): Promise<T>;
	equals(other: ResRef): boolean;
	toJSON(): object;
}

export class TypeList {
	constructor(defaultFactory: Function);
	root: {};
	defaultFactory: Function;
	addFactory(pattern: string, factory: Function): void;
	removeFactory(pattern: string): Function | void;
	getFactory(rid: string): Function;
}
