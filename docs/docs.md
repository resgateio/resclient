## Classes

<dl>
<dt><a href="#ResClient">ResClient</a></dt>
<dd><p>ResClient is a client implementing the RES-Client protocol.</p>
</dd>
<dt><a href="#ResCollection">ResCollection</a></dt>
<dd><p>ResCollection represents a collection provided over the RES API.</p>
</dd>
<dt><a href="#ResModel">ResModel</a></dt>
<dd><p>ResModel represents a model provided over the RES API.</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#eventCallback">eventCallback</a> : <code>function</code></dt>
<dd><p>Event callback</p>
</dd>
</dl>

<a name="ResClient"></a>

## ResClient
ResClient is a client implementing the RES-Client protocol.

**Kind**: global class  

* [ResClient](#ResClient)
    * [new ResClient(hostUrl, [opt])](#new_ResClient_new)
    * [.connect()](#ResClient+connect) ⇒ <code>Promise</code>
    * [.disconnect()](#ResClient+disconnect)
    * [.getHostUrl()](#ResClient+getHostUrl) ⇒ <code>string</code>
    * [.on(events, handler)](#ResClient+on)
    * [.off(events, [handler])](#ResClient+off)
    * [.setOnConnect(onConnect)](#ResClient+setOnConnect) ⇒ <code>this</code>
    * [.registerModelType(modelType)](#ResClient+registerModelType)
    * [.unregisterModelType(modelTypeId)](#ResClient+unregisterModelType) ⇒ <code>object</code>
    * [.getResource(rid, [collectionFactory])](#ResClient+getResource) ⇒ <code>Promise.&lt;(Model\|Collection)&gt;</code>
    * [.createModel(collectionId, props)](#ResClient+createModel) ⇒ <code>Promise.&lt;Model&gt;</code>
    * [._tryDelete(cacheItem)](#ResClient+_tryDelete) ⇒ <code>boolean</code>

<a name="new_ResClient_new"></a>

### new ResClient(hostUrl, [opt])
Creates a ResClient instance


| Param | Type | Description |
| --- | --- | --- |
| hostUrl | <code>string</code> | Websocket host path. May be relative to current path. |
| [opt] | <code>object</code> | Optional parameters. |
| [opt.onConnect] | <code>function</code> | On connect callback called prior resolving the connect promise and subscribing to stale resources. May return a promise. |
| [opt.namespace] | <code>string</code> | Event bus namespace. Defaults to 'resclient'. |
| [opt.eventBus] | <code>module:modapp/ext~EventBus</code> | Event bus. |

<a name="ResClient+connect"></a>

### resClient.connect() ⇒ <code>Promise</code>
Connects the instance to the server.
Can be called even if a connection is already established.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  
**Returns**: <code>Promise</code> - A promise to the established connection.  
<a name="ResClient+disconnect"></a>

### resClient.disconnect()
Disconnects any current connection and stops attempts
of reconnecting.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  
<a name="ResClient+getHostUrl"></a>

### resClient.getHostUrl() ⇒ <code>string</code>
Gets the host URL to the RES API

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  
**Returns**: <code>string</code> - Host URL  
<a name="ResClient+on"></a>

### resClient.on(events, handler)
Attach an  event handler function for one or more instance events.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  

| Param | Type | Description |
| --- | --- | --- |
| events | <code>string</code> | One or more space-separated events. Null means any event. |
| handler | [<code>eventCallback</code>](#eventCallback) | A function to execute when the event is emitted. |

<a name="ResClient+off"></a>

### resClient.off(events, [handler])
Remove an instance event handler.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  

| Param | Type | Description |
| --- | --- | --- |
| events | <code>string</code> | One or more space-separated events. Null means any event. |
| [handler] | [<code>eventCallback</code>](#eventCallback) | An optional handler function. The handler will only be remove if it is the same handler. |

<a name="ResClient+setOnConnect"></a>

### resClient.setOnConnect(onConnect) ⇒ <code>this</code>
Sets the onConnect callback.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  

| Param | Type | Description |
| --- | --- | --- |
| onConnect | <code>function</code> | On connect callback called prior resolving the connect promise and subscribing to stale resources. May return a promise. |

<a name="ResClient+registerModelType"></a>

### resClient.registerModelType(modelType)
Register a model type

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  

| Param | Type | Description |
| --- | --- | --- |
| modelType | [<code>ModelType</code>](#module/Api..ModelType) | Model type definition object |

<a name="ResClient+unregisterModelType"></a>

### resClient.unregisterModelType(modelTypeId) ⇒ <code>object</code>
Unregister a model type

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  
**Returns**: <code>object</code> - Model type definition object, or null if it wasn't registered  

| Param | Type | Description |
| --- | --- | --- |
| modelTypeId | <code>string</code> | Id of model type |

<a name="ResClient+getResource"></a>

### resClient.getResource(rid, [collectionFactory]) ⇒ <code>Promise.&lt;(Model\|Collection)&gt;</code>
Get a resource from the backend

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  
**Returns**: <code>Promise.&lt;(Model\|Collection)&gt;</code> - Promise of the resourcce  

| Param | Type | Description |
| --- | --- | --- |
| rid | <code>string</code> | Resource ID |
| [collectionFactory] | <code>function</code> | Collection factory function. |

<a name="ResClient+createModel"></a>

### resClient.createModel(collectionId, props) ⇒ <code>Promise.&lt;Model&gt;</code>
Create a new model resource

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  
**Returns**: <code>Promise.&lt;Model&gt;</code> - Promise of the created model  

| Param | Type | Description |
| --- | --- | --- |
| collectionId | <code>string</code> | Existing collection in which the resource is to be created |
| props | <code>object</code> | Model properties |

<a name="ResClient+_tryDelete"></a>

### resClient._tryDelete(cacheItem) ⇒ <code>boolean</code>
Tries to delete the cached item.
It will delete if there are no direct listeners, indirect references, or any subscription.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  
**Returns**: <code>boolean</code> - True if the item was deleted from cache, otherwise false  

| Param | Type | Description |
| --- | --- | --- |
| cacheItem | <code>object</code> | Cache item to delete |

<a name="ResCollection"></a>

## ResCollection
ResCollection represents a collection provided over the RES API.

**Kind**: global class  
**Implements**: <code>module:modapp~Collection</code>  

* [ResCollection](#ResCollection)
    * [new ResCollection(api, rid, data, [opt])](#new_ResCollection_new)
    * [.length](#ResCollection+length)
    * [.getResourceId()](#ResCollection+getResourceId) ⇒ <code>string</code>
    * [.on([events], [handler])](#ResCollection+on) ⇒ <code>this</code>
    * [.off([events], [handler])](#ResCollection+off) ⇒ <code>this</code>
    * [.get(id)](#ResCollection+get) ⇒ <code>\*</code>
    * [.indexOf(id)](#ResCollection+indexOf) ⇒ <code>number</code>
    * [.atIndex(idx)](#ResCollection+atIndex) ⇒ <code>module:modapp~Model</code>
    * [.create(props)](#ResCollection+create) ⇒ <code>Promise.&lt;Model&gt;</code>
    * [.remove(modelId)](#ResCollection+remove) ⇒ <code>Promise</code>

<a name="new_ResCollection_new"></a>

### new ResCollection(api, rid, data, [opt])
Creates an ResCollection instance


| Param | Type | Description |
| --- | --- | --- |
| api | [<code>ResClient</code>](#ResClient) | ResClient instance |
| rid | <code>string</code> | Resource id. |
| data | <code>Array.&lt;object&gt;</code> | ResCollection data array |
| [opt] | <code>object</code> | Optional settings |
| [opt.compare] | <code>function</code> | Compare function for sort order. Defaults to insert order. |
| [opt.idAttribute] | <code>function</code> | Id attribute callback function. Defaults to returning the object.id property. |

<a name="ResCollection+length"></a>

### resCollection.length
Length of the collection

**Kind**: instance property of [<code>ResCollection</code>](#ResCollection)  
<a name="ResCollection+getResourceId"></a>

### resCollection.getResourceId() ⇒ <code>string</code>
Collection resource ID

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  
**Returns**: <code>string</code> - Resource ID  
<a name="ResCollection+on"></a>

### resCollection.on([events], [handler]) ⇒ <code>this</code>
Attach a collection event handler function for one or more events.
If no event or handler is provided, the collection will still be considered listened to,
until a matching off call without arguments is made.
Available events are 'add', 'remove', and 'move'.

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  

| Param | Type | Description |
| --- | --- | --- |
| [events] | <code>string</code> | One or more space-separated events. Null means any event. |
| [handler] | [<code>eventCallback</code>](#eventCallback) | Handler function to execute when the event is emitted. |

<a name="ResCollection+off"></a>

### resCollection.off([events], [handler]) ⇒ <code>this</code>
Remove a collection event handler function.
Available events are 'add', 'remove', and 'move'.

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  

| Param | Type | Description |
| --- | --- | --- |
| [events] | <code>string</code> | One or more space-separated events. Null means any event. |
| [handler] | [<code>eventCallback</code>](#eventCallback) | Handler function to remove. |

<a name="ResCollection+get"></a>

### resCollection.get(id) ⇒ <code>\*</code>
Get a model from the collection by id

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  
**Returns**: <code>\*</code> - Stored model. Undefined if key doesn't exist  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | Id of the model |

<a name="ResCollection+indexOf"></a>

### resCollection.indexOf(id) ⇒ <code>number</code>
Retrieves the order index of a model.

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  
**Returns**: <code>number</code> - Order index of the model. -1 if the model id doesn't exist.  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> \| <code>Model</code> | Id of the model or the model object |

<a name="ResCollection+atIndex"></a>

### resCollection.atIndex(idx) ⇒ <code>module:modapp~Model</code>
Gets a model from the collection by index position

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  
**Returns**: <code>module:modapp~Model</code> - Stored model. Undefined if the index is out of bounds.  

| Param | Type | Description |
| --- | --- | --- |
| idx | <code>number</code> | Index of the model |

<a name="ResCollection+create"></a>

### resCollection.create(props) ⇒ <code>Promise.&lt;Model&gt;</code>
Creates a new model for the collection at the server.
Server will return an error if the collection doesn't support creation.

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  
**Returns**: <code>Promise.&lt;Model&gt;</code> - Promise of the created model.  

| Param | Type | Description |
| --- | --- | --- |
| props | <code>object</code> | Model properties |

<a name="ResCollection+remove"></a>

### resCollection.remove(modelId) ⇒ <code>Promise</code>
Removes an existing model from the collection at the server.
Server will return an error if the collection doesn't support removal.

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  
**Returns**: <code>Promise</code> - Promise of the removal.  

| Param | Type | Description |
| --- | --- | --- |
| modelId | <code>string</code> | Model resource id |

<a name="ResModel"></a>

## ResModel
ResModel represents a model provided over the RES API.

**Kind**: global class  
**Implements**: <code>module:modapp~Model</code>  

* [ResModel](#ResModel)
    * [new ResModel(api, rid, data, [opt])](#new_ResModel_new)
    * [.getResourceId()](#ResModel+getResourceId) ⇒ <code>string</code>
    * [.on([events], [handler])](#ResModel+on) ⇒ <code>this</code>
    * [.off(events, [handler])](#ResModel+off) ⇒ <code>this</code>
    * [.set(props)](#ResModel+set) ⇒ <code>Promise.&lt;object&gt;</code>
    * [.call(method, params)](#ResModel+call) ⇒ <code>Promise.&lt;object&gt;</code>

<a name="new_ResModel_new"></a>

### new ResModel(api, rid, data, [opt])
Creates a ResModel instance


| Param | Type | Description |
| --- | --- | --- |
| api | [<code>ResClient</code>](#ResClient) | ResClient instance |
| rid | <code>string</code> | Resource id. |
| data | <code>object</code> | Data object |
| [opt] | <code>object</code> | Optional parameters. |
| [opt.definition] | <code>object</code> | Object definition. If not provided, any value will be allowed. |

<a name="ResModel+getResourceId"></a>

### resModel.getResourceId() ⇒ <code>string</code>
Model resource ID

**Kind**: instance method of [<code>ResModel</code>](#ResModel)  
**Returns**: <code>string</code> - Resource ID  
<a name="ResModel+on"></a>

### resModel.on([events], [handler]) ⇒ <code>this</code>
Attach a model event handler function for one or more events.
If no event or handler is provided, the model will still be considered listened to,
until a matching off call without arguments is made.
Available event is 'change'.

**Kind**: instance method of [<code>ResModel</code>](#ResModel)  

| Param | Type | Description |
| --- | --- | --- |
| [events] | <code>string</code> | One or more space-separated events. Null means any event. |
| [handler] | [<code>eventCallback</code>](#eventCallback) | Handler function to execute when the event is emitted. |

<a name="ResModel+off"></a>

### resModel.off(events, [handler]) ⇒ <code>this</code>
Remove a model event handler function.
Available event is 'change'.

**Kind**: instance method of [<code>ResModel</code>](#ResModel)  

| Param | Type | Description |
| --- | --- | --- |
| events | <code>string</code> | One or more space-separated events. Null means any event. |
| [handler] | [<code>eventCallback</code>](#eventCallback) | Handler function to remove. |

<a name="ResModel+set"></a>

### resModel.set(props) ⇒ <code>Promise.&lt;object&gt;</code>
Calls the set method to update model properties.

**Kind**: instance method of [<code>ResModel</code>](#ResModel)  
**Returns**: <code>Promise.&lt;object&gt;</code> - Promise of the call being completed.  

| Param | Type | Description |
| --- | --- | --- |
| props | <code>object</code> | Properties |

<a name="ResModel+call"></a>

### resModel.call(method, params) ⇒ <code>Promise.&lt;object&gt;</code>
Calls a method on the model.

**Kind**: instance method of [<code>ResModel</code>](#ResModel)  
**Returns**: <code>Promise.&lt;object&gt;</code> - Promise of the call result.  

| Param | Type | Description |
| --- | --- | --- |
| method | <code>string</code> | Method name |
| params | <code>\*</code> | Method parameters |

<a name="eventCallback"></a>

## eventCallback : <code>function</code>
Event callback

**Kind**: global typedef  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>object</code> | Event data object |
| resource | <code>object</code> | Resource object |
| event | <code>string</code> | Event name including namespace |
| action | <code>string</code> | Event action |

