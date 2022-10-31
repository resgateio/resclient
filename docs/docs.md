## Classes

<dl>
<dt><a href="#ResClient">ResClient</a></dt>
<dd><p>ResClient represents a client connection to a RES API.</p>
</dd>
<dt><a href="#ResCollection">ResCollection</a></dt>
<dd><p>ResCollection represents a collection provided over the RES API.</p>
</dd>
<dt><a href="#ResModel">ResModel</a></dt>
<dd><p>ResModel represents a model provided over the RES API.</p>
</dd>
<dt><a href="#ResError">ResError</a></dt>
<dd><p>ResError represents a RES API error.</p>
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
ResClient represents a client connection to a RES API.

**Kind**: global class  

* [ResClient](#ResClient)
    * [new ResClient(hostUrlOrFactory, [opt])](#new_ResClient_new)
    * _instance_
        * [.supportedProtocol](#ResClient+supportedProtocol) ⇒ <code>string</code>
        * [.connect()](#ResClient+connect) ⇒ <code>Promise</code>
        * [.disconnect()](#ResClient+disconnect)
        * [.getHostUrl()](#ResClient+getHostUrl) ⇒ <code>string</code>
        * [.on(events, handler)](#ResClient+on)
        * [.off(events, [handler])](#ResClient+off)
        * [.setOnConnect(onConnect)](#ResClient+setOnConnect) ⇒ <code>this</code>
        * [.registerModelType(pattern, factory)](#ResClient+registerModelType) ⇒ <code>this</code>
        * [.unregisterModelType(pattern)](#ResClient+unregisterModelType) ⇒ [<code>modelFactory</code>](#ResClient..modelFactory)
        * [.registerCollectionType(pattern, factory)](#ResClient+registerCollectionType) ⇒ <code>this</code>
        * [.unregisterCollectionType(pattern)](#ResClient+unregisterCollectionType) ⇒ [<code>collectionFactory</code>](#ResClient..collectionFactory)
        * [.get(rid, [collectionFactory])](#ResClient+get) ⇒ <code>Promise.&lt;(ResModel\|ResCollection)&gt;</code>
        * [.call(rid, method, params)](#ResClient+call) ⇒ <code>Promise.&lt;object&gt;</code>
        * [.authenticate(rid, method, params)](#ResClient+authenticate) ⇒ <code>Promise.&lt;object&gt;</code>
        * ~~[.create(rid, params)](#ResClient+create) ⇒ <code>Promise.&lt;(ResModel\|ResCollection)&gt;</code>~~
        * [.setModel(modelId, props)](#ResClient+setModel) ⇒ <code>Promise.&lt;object&gt;</code>
    * _inner_
        * [~connectCallback](#ResClient..connectCallback) : <code>function</code>
        * [~disconnectCallback](#ResClient..disconnectCallback) : <code>function</code>
        * [~errorCallback](#ResClient..errorCallback) : <code>function</code>
        * [~websocketFactory](#ResClient..websocketFactory) ⇒ <code>WebSocket</code>
        * [~onConnectCallback](#ResClient..onConnectCallback) ⇒ <code>Promise</code>
        * [~modelFactory](#ResClient..modelFactory) ⇒ [<code>ResModel</code>](#ResModel)
        * [~collectionFactory](#ResClient..collectionFactory) ⇒ [<code>ResCollection</code>](#ResCollection)

<a name="new_ResClient_new"></a>

### new ResClient(hostUrlOrFactory, [opt])
Creates a ResClient instance


| Param | Type | Description |
| --- | --- | --- |
| hostUrlOrFactory | <code>string</code> \| [<code>websocketFactory</code>](#ResClient..websocketFactory) | Websocket host path, or websocket factory function. Path may be relative to current path. |
| [opt] | <code>object</code> | Optional parameters. |
| [opt.onConnect] | <code>function</code> | On connect callback called prior resolving the connect promise and subscribing to stale resources. May return a promise. |
| [opt.namespace] | <code>string</code> | Event bus namespace. Defaults to 'resclient'. |
| [opt.debug] | <code>bool</code> | Flag to debug log all WebSocket communication. Defaults to false. |
| [opt.eventBus] | <code>module:modapp~EventBus</code> | Event bus. |

<a name="ResClient+supportedProtocol"></a>

### resClient.supportedProtocol ⇒ <code>string</code>
RES protocol level supported by this client version.

**Kind**: instance property of [<code>ResClient</code>](#ResClient)  
**Returns**: <code>string</code> - Supported RES protocol version.  
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
Attach an event handler function for one or more instance events.
Available events are 'connect', 'disconnect', and 'error'.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  

| Param | Type | Description |
| --- | --- | --- |
| events | <code>string</code> | One or more space-separated events. Null means any event. |
| handler | [<code>connectCallback</code>](#ResClient..connectCallback) \| [<code>disconnectCallback</code>](#ResClient..disconnectCallback) \| [<code>errorCallback</code>](#ResClient..errorCallback) | Handler function to execute when the event is emitted. |

<a name="ResClient+off"></a>

### resClient.off(events, [handler])
Remove an instance event handler.
Available events are 'connect', 'disconnect', and 'error'.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  

| Param | Type | Description |
| --- | --- | --- |
| events | <code>string</code> | One or more space-separated events. Null means any event. |
| [handler] | [<code>connectCallback</code>](#ResClient..connectCallback) \| [<code>disconnectCallback</code>](#ResClient..disconnectCallback) \| [<code>errorCallback</code>](#ResClient..errorCallback) | Handler function to remove. |

<a name="ResClient+setOnConnect"></a>

### resClient.setOnConnect(onConnect) ⇒ <code>this</code>
Sets the onConnect callback.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  

| Param | Type | Description |
| --- | --- | --- |
| onConnect | [<code>onConnectCallback</code>](#ResClient..onConnectCallback) | On connect callback called prior resolving the connect promise and subscribing to stale resources. May return a promise. |

<a name="ResClient+registerModelType"></a>

### resClient.registerModelType(pattern, factory) ⇒ <code>this</code>
Register a model type.
The pattern may use the following wild cards:
* The asterisk (*) matches any part at any level of the resource name.
* The greater than symbol (>) matches one or more parts at the end of a resource name, and must be the last part.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  

| Param | Type | Description |
| --- | --- | --- |
| pattern | <code>string</code> | Pattern of the model type. |
| factory | [<code>modelFactory</code>](#ResClient..modelFactory) | Model factory callback |

<a name="ResClient+unregisterModelType"></a>

### resClient.unregisterModelType(pattern) ⇒ [<code>modelFactory</code>](#ResClient..modelFactory)
Unregister a previously registered model type pattern.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  
**Returns**: [<code>modelFactory</code>](#ResClient..modelFactory) - Unregistered model factory callback  

| Param | Type | Description |
| --- | --- | --- |
| pattern | <code>string</code> | Pattern of the model type. |

<a name="ResClient+registerCollectionType"></a>

### resClient.registerCollectionType(pattern, factory) ⇒ <code>this</code>
Register a collection type.
The pattern may use the following wild cards:
* The asterisk (*) matches any part at any level of the resource name.
* The greater than symbol (>) matches one or more parts at the end of a resource name, and must be the last part.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  

| Param | Type | Description |
| --- | --- | --- |
| pattern | <code>string</code> | Pattern of the collection type. |
| factory | [<code>collectionFactory</code>](#ResClient..collectionFactory) | Collection factory callback |

<a name="ResClient+unregisterCollectionType"></a>

### resClient.unregisterCollectionType(pattern) ⇒ [<code>collectionFactory</code>](#ResClient..collectionFactory)
Unregister a previously registered collection type pattern.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  
**Returns**: [<code>collectionFactory</code>](#ResClient..collectionFactory) - Unregistered collection factory callback  

| Param | Type | Description |
| --- | --- | --- |
| pattern | <code>string</code> | Pattern of the collection type. |

<a name="ResClient+get"></a>

### resClient.get(rid, [collectionFactory]) ⇒ <code>Promise.&lt;(ResModel\|ResCollection)&gt;</code>
Get a resource from the API

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  
**Returns**: <code>Promise.&lt;(ResModel\|ResCollection)&gt;</code> - Promise of the resource.  

| Param | Type | Description |
| --- | --- | --- |
| rid | <code>string</code> | Resource ID |
| [collectionFactory] | <code>function</code> | Collection factory function. |

<a name="ResClient+call"></a>

### resClient.call(rid, method, params) ⇒ <code>Promise.&lt;object&gt;</code>
Calls a method on a resource.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  
**Returns**: <code>Promise.&lt;object&gt;</code> - Promise of the call result.  

| Param | Type | Description |
| --- | --- | --- |
| rid | <code>string</code> | Resource ID. |
| method | <code>string</code> | Method name |
| params | <code>\*</code> | Method parameters |

<a name="ResClient+authenticate"></a>

### resClient.authenticate(rid, method, params) ⇒ <code>Promise.&lt;object&gt;</code>
Invokes a authentication method on a resource.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  
**Returns**: <code>Promise.&lt;object&gt;</code> - Promise of the authentication result.  

| Param | Type | Description |
| --- | --- | --- |
| rid | <code>string</code> | Resource ID. |
| method | <code>string</code> | Method name |
| params | <code>\*</code> | Method parameters |

<a name="ResClient+create"></a>

### ~~resClient.create(rid, params) ⇒ <code>Promise.&lt;(ResModel\|ResCollection)&gt;</code>~~
***Deprecated***

Creates a new resource by calling the 'new' method.  
Use call with 'new' as method parameter instead.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  
**Returns**: <code>Promise.&lt;(ResModel\|ResCollection)&gt;</code> - Promise of the resource.  

| Param | Type | Description |
| --- | --- | --- |
| rid | <code>\*</code> | Resource ID |
| params | <code>\*</code> | Method parameters |

<a name="ResClient+setModel"></a>

### resClient.setModel(modelId, props) ⇒ <code>Promise.&lt;object&gt;</code>
Calls the set method to update model properties.

**Kind**: instance method of [<code>ResClient</code>](#ResClient)  
**Returns**: <code>Promise.&lt;object&gt;</code> - Promise of the call being completed.  

| Param | Type | Description |
| --- | --- | --- |
| modelId | <code>string</code> | Model resource ID. |
| props | <code>object</code> | Properties. Set value to undefined to delete a property. |

<a name="ResClient..connectCallback"></a>

### ResClient~connectCallback : <code>function</code>
Connect event emitted on connect.

**Kind**: inner typedef of [<code>ResClient</code>](#ResClient)  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>object</code> | WebSocket open event object |

<a name="ResClient..disconnectCallback"></a>

### ResClient~disconnectCallback : <code>function</code>
Disconnect event emitted on disconnect.

**Kind**: inner typedef of [<code>ResClient</code>](#ResClient)  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>object</code> | WebSocket close event object |

<a name="ResClient..errorCallback"></a>

### ResClient~errorCallback : <code>function</code>
Error event emitted on error.

**Kind**: inner typedef of [<code>ResClient</code>](#ResClient)  

| Param | Type | Description |
| --- | --- | --- |
| err | [<code>ResError</code>](#ResError) | ResError object |

<a name="ResClient..websocketFactory"></a>

### ResClient~websocketFactory ⇒ <code>WebSocket</code>
WebSocket factory function.

**Kind**: inner typedef of [<code>ResClient</code>](#ResClient)  
**Returns**: <code>WebSocket</code> - WebSocket instance implementing the [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).  
<a name="ResClient..onConnectCallback"></a>

### ResClient~onConnectCallback ⇒ <code>Promise</code>
OnConnect callback function.

**Kind**: inner typedef of [<code>ResClient</code>](#ResClient)  
**Returns**: <code>Promise</code> - Promise for the onConnect handlers completion. Must always resolve.  

| Param | Type | Description |
| --- | --- | --- |
| ResClient | [<code>ResClient</code>](#ResClient) | instance |

<a name="ResClient..modelFactory"></a>

### ResClient~modelFactory ⇒ [<code>ResModel</code>](#ResModel)
Model factory callback

**Kind**: inner typedef of [<code>ResClient</code>](#ResClient)  
**Returns**: [<code>ResModel</code>](#ResModel) - Model instance object.  

| Param | Type | Description |
| --- | --- | --- |
| api | [<code>ResClient</code>](#ResClient) | ResClient instance |
| rid | <code>string</code> | Resource ID |

<a name="ResClient..collectionFactory"></a>

### ResClient~collectionFactory ⇒ [<code>ResCollection</code>](#ResCollection)
Collection factory callback

**Kind**: inner typedef of [<code>ResClient</code>](#ResClient)  
**Returns**: [<code>ResCollection</code>](#ResCollection) - Collection instance object.  

| Param | Type | Description |
| --- | --- | --- |
| api | [<code>ResClient</code>](#ResClient) | ResClient instance |
| rid | <code>string</code> | Resource ID |

<a name="ResCollection"></a>

## ResCollection
ResCollection represents a collection provided over the RES API.

**Kind**: global class  
**Implements**: <code>module:modapp~Collection</code>  

* [ResCollection](#ResCollection)
    * [new ResCollection(api, rid, [opt])](#new_ResCollection_new)
    * _instance_
        * [.length](#ResCollection+length)
        * [.list](#ResCollection+list)
        * [.getClient()](#ResCollection+getClient) ⇒ [<code>ResClient</code>](#ResClient)
        * [.getResourceId()](#ResCollection+getResourceId) ⇒ <code>string</code>
        * [.on([events], [handler])](#ResCollection+on) ⇒ <code>this</code>
        * [.off([events], [handler])](#ResCollection+off) ⇒ <code>this</code>
        * [.get(id)](#ResCollection+get) ⇒ <code>\*</code>
        * [.indexOf(item)](#ResCollection+indexOf) ⇒ <code>number</code>
        * [.atIndex(idx)](#ResCollection+atIndex) ⇒ <code>\*</code>
        * [.call(method, params)](#ResCollection+call) ⇒ <code>Promise.&lt;object&gt;</code>
        * [.auth(method, params)](#ResCollection+auth) ⇒ <code>Promise.&lt;object&gt;</code>
        * [.toArray()](#ResCollection+toArray) ⇒ <code>Array.&lt;\*&gt;</code>
    * _inner_
        * [~addEvent](#ResCollection..addEvent) : <code>object</code>
        * [~addCallback](#ResCollection..addCallback) : <code>function</code>
        * [~removeEvent](#ResCollection..removeEvent) : <code>object</code>
        * [~removeCallback](#ResCollection..removeCallback) : <code>function</code>

<a name="new_ResCollection_new"></a>

### new ResCollection(api, rid, [opt])
Creates an ResCollection instance


| Param | Type | Description |
| --- | --- | --- |
| api | [<code>ResClient</code>](#ResClient) | ResClient instance |
| rid | <code>string</code> | Resource id. |
| [opt] | <code>object</code> | Optional settings |
| [opt.idCallback] | <code>function</code> | Id callback function. |

<a name="ResCollection+length"></a>

### resCollection.length
Length of the collection

**Kind**: instance property of [<code>ResCollection</code>](#ResCollection)  
<a name="ResCollection+list"></a>

### resCollection.list
Internal collection array. Do not mutate directly.

**Kind**: instance property of [<code>ResCollection</code>](#ResCollection)  
<a name="ResCollection+getClient"></a>

### resCollection.getClient() ⇒ [<code>ResClient</code>](#ResClient)
ResClient instance.

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  
**Returns**: [<code>ResClient</code>](#ResClient) - ResClient instance  
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
Available events are 'add', 'remove', and custom events.

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  

| Param | Type | Description |
| --- | --- | --- |
| [events] | <code>string</code> | One or more space-separated events. Null means any event. |
| [handler] | [<code>addCallback</code>](#ResCollection..addCallback) \| [<code>removeCallback</code>](#ResCollection..removeCallback) \| [<code>eventCallback</code>](#eventCallback) | Handler function to execute when the event is emitted. |

<a name="ResCollection+off"></a>

### resCollection.off([events], [handler]) ⇒ <code>this</code>
Remove a collection event handler function.
Available events are 'add', 'remove', and custom events.

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  

| Param | Type | Description |
| --- | --- | --- |
| [events] | <code>string</code> | One or more space-separated events. Null means any event. |
| [handler] | [<code>addCallback</code>](#ResCollection..addCallback) \| [<code>removeCallback</code>](#ResCollection..removeCallback) \| [<code>eventCallback</code>](#eventCallback) | Handler function to remove. |

<a name="ResCollection+get"></a>

### resCollection.get(id) ⇒ <code>\*</code>
Get an item from the collection by id.
Requires that id callback is defined for the collection.

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  
**Returns**: <code>\*</code> - Item with the id. Undefined if key doesn't exist  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | Id of the item |

<a name="ResCollection+indexOf"></a>

### resCollection.indexOf(item) ⇒ <code>number</code>
Retrieves the order index of an item.

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  
**Returns**: <code>number</code> - Order index of the first matching item. -1 if the item doesn't exist.  

| Param | Type | Description |
| --- | --- | --- |
| item | <code>\*</code> | Item to find |

<a name="ResCollection+atIndex"></a>

### resCollection.atIndex(idx) ⇒ <code>\*</code>
Gets an item from the collection by index position

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  
**Returns**: <code>\*</code> - Item at the given index. Undefined if the index is out of bounds.  

| Param | Type | Description |
| --- | --- | --- |
| idx | <code>number</code> | Index of the item |

<a name="ResCollection+call"></a>

### resCollection.call(method, params) ⇒ <code>Promise.&lt;object&gt;</code>
Calls a method on the collection.

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  
**Returns**: <code>Promise.&lt;object&gt;</code> - Promise of the call result.  

| Param | Type | Description |
| --- | --- | --- |
| method | <code>string</code> | Method name |
| params | <code>\*</code> | Method parameters |

<a name="ResCollection+auth"></a>

### resCollection.auth(method, params) ⇒ <code>Promise.&lt;object&gt;</code>
Calls an auth method on the collection.

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  
**Returns**: <code>Promise.&lt;object&gt;</code> - Promise of the auth result.  

| Param | Type | Description |
| --- | --- | --- |
| method | <code>string</code> | Auth method name |
| params | <code>\*</code> | Method parameters |

<a name="ResCollection+toArray"></a>

### resCollection.toArray() ⇒ <code>Array.&lt;\*&gt;</code>
Returns a shallow clone of the internal array.

**Kind**: instance method of [<code>ResCollection</code>](#ResCollection)  
**Returns**: <code>Array.&lt;\*&gt;</code> - Clone of internal array  
<a name="ResCollection..addEvent"></a>

### ResCollection~addEvent : <code>object</code>
Add event data

**Kind**: inner typedef of [<code>ResCollection</code>](#ResCollection)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| item | <code>\*</code> | Item being added to the collection. |
| idx | <code>number</code> | Index where item was added. |

<a name="ResCollection..addCallback"></a>

### ResCollection~addCallback : <code>function</code>
Add event emitted on any item being added to the collection.

**Kind**: inner typedef of [<code>ResCollection</code>](#ResCollection)  

| Param | Type | Description |
| --- | --- | --- |
| event | [<code>addEvent</code>](#ResCollection..addEvent) | Add event data. |
| collection | [<code>ResCollection</code>](#ResCollection) | Collection emitting event. |
| event | <code>string</code> | Event name including namespace. |
| action | <code>string</code> | Event action. |

<a name="ResCollection..removeEvent"></a>

### ResCollection~removeEvent : <code>object</code>
Remove event data

**Kind**: inner typedef of [<code>ResCollection</code>](#ResCollection)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| item | <code>\*</code> | Item being removed from the collection. |
| idx | <code>number</code> | Index from where the item was removed. |

<a name="ResCollection..removeCallback"></a>

### ResCollection~removeCallback : <code>function</code>
Remove event emitted on any item being added to the collection.

**Kind**: inner typedef of [<code>ResCollection</code>](#ResCollection)  

| Param | Type | Description |
| --- | --- | --- |
| event | [<code>removeEvent</code>](#ResCollection..removeEvent) | Remove event data. |
| collection | [<code>ResCollection</code>](#ResCollection) | Collection emitting event. |
| event | <code>string</code> | Event name including namespace. |
| action | <code>string</code> | Event action. |

<a name="ResModel"></a>

## ResModel
ResModel represents a model provided over the RES API.

**Kind**: global class  
**Implements**: <code>module:modapp~Model</code>  

* [ResModel](#ResModel)
    * [new ResModel(api, rid, [opt])](#new_ResModel_new)
    * _instance_
        * [.props](#ResModel+props) ⇒ <code>object</code>
        * [.getClient()](#ResModel+getClient) ⇒ [<code>ResClient</code>](#ResClient)
        * [.getResourceId()](#ResModel+getResourceId) ⇒ <code>string</code>
        * [.on([events], [handler])](#ResModel+on) ⇒ <code>this</code>
        * [.off(events, [handler])](#ResModel+off) ⇒ <code>this</code>
        * [.set(props)](#ResModel+set) ⇒ <code>Promise.&lt;object&gt;</code>
        * [.call(method, params)](#ResModel+call) ⇒ <code>Promise.&lt;object&gt;</code>
        * [.auth(method, params)](#ResModel+auth) ⇒ <code>Promise.&lt;object&gt;</code>
    * _inner_
        * [~changeCallback](#ResModel..changeCallback) : <code>function</code>

<a name="new_ResModel_new"></a>

### new ResModel(api, rid, [opt])
Creates a ResModel instance


| Param | Type | Description |
| --- | --- | --- |
| api | [<code>ResClient</code>](#ResClient) | ResClient instance |
| rid | <code>string</code> | Resource id. |
| [opt] | <code>object</code> | Optional parameters. |
| [opt.definition] | <code>object</code> | Object definition. If not provided, any value will be allowed. |

<a name="ResModel+props"></a>

### resModel.props ⇒ <code>object</code>
Model properties.

**Kind**: instance property of [<code>ResModel</code>](#ResModel)  
**Returns**: <code>object</code> - Anonymous object with all model properties.  
<a name="ResModel+getClient"></a>

### resModel.getClient() ⇒ [<code>ResClient</code>](#ResClient)
ResClient instance.

**Kind**: instance method of [<code>ResModel</code>](#ResModel)  
**Returns**: [<code>ResClient</code>](#ResClient) - ResClient instance  
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
Available events are 'change', or custom events.

**Kind**: instance method of [<code>ResModel</code>](#ResModel)  

| Param | Type | Description |
| --- | --- | --- |
| [events] | <code>string</code> | One or more space-separated events. Null means any event. |
| [handler] | [<code>changeCallback</code>](#ResModel..changeCallback) \| [<code>eventCallback</code>](#eventCallback) | Handler function to execute when the event is emitted. |

<a name="ResModel+off"></a>

### resModel.off(events, [handler]) ⇒ <code>this</code>
Remove a model event handler function.
Available events are 'change', or custom events.

**Kind**: instance method of [<code>ResModel</code>](#ResModel)  

| Param | Type | Description |
| --- | --- | --- |
| events | <code>string</code> | One or more space-separated events. Null means any event. |
| [handler] | [<code>changeCallback</code>](#ResModel..changeCallback) \| [<code>eventCallback</code>](#eventCallback) | Handler function to remove. |

<a name="ResModel+set"></a>

### resModel.set(props) ⇒ <code>Promise.&lt;object&gt;</code>
Calls the set method to update model properties.

**Kind**: instance method of [<code>ResModel</code>](#ResModel)  
**Returns**: <code>Promise.&lt;object&gt;</code> - Promise of the call being completed.  

| Param | Type | Description |
| --- | --- | --- |
| props | <code>object</code> | Properties. Set value to undefined to delete a property. |

<a name="ResModel+call"></a>

### resModel.call(method, params) ⇒ <code>Promise.&lt;object&gt;</code>
Calls a method on the model.

**Kind**: instance method of [<code>ResModel</code>](#ResModel)  
**Returns**: <code>Promise.&lt;object&gt;</code> - Promise of the call result.  

| Param | Type | Description |
| --- | --- | --- |
| method | <code>string</code> | Method name |
| params | <code>\*</code> | Method parameters |

<a name="ResModel+auth"></a>

### resModel.auth(method, params) ⇒ <code>Promise.&lt;object&gt;</code>
Calls an auth method on the model.

**Kind**: instance method of [<code>ResModel</code>](#ResModel)  
**Returns**: <code>Promise.&lt;object&gt;</code> - Promise of the auth result.  

| Param | Type | Description |
| --- | --- | --- |
| method | <code>string</code> | Auth method name |
| params | <code>\*</code> | Method parameters |

<a name="ResModel..changeCallback"></a>

### ResModel~changeCallback : <code>function</code>
Change event emitted on any change to one or more public (non-underscore) properties.

**Kind**: inner typedef of [<code>ResModel</code>](#ResModel)  

| Param | Type | Description |
| --- | --- | --- |
| changed | <code>Object.&lt;string, \*&gt;</code> | Changed key/value object where key is the changed property, and value is the old property value. |
| model | <code>Model</code> | ResModel emitting the event. |
| event | <code>string</code> | Event name including namespace. |
| action | <code>string</code> | Event action. |

<a name="ResError"></a>

## ResError
ResError represents a RES API error.

**Kind**: global class  

* [ResError](#ResError)
    * [.code](#ResError+code) : <code>string</code>
    * [.message](#ResError+message) : <code>string</code>
    * [.data](#ResError+data) : <code>\*</code>
    * [.getResourceId()](#ResError+getResourceId) ⇒ <code>string</code>

<a name="ResError+code"></a>

### resError.code : <code>string</code>
Error code

**Kind**: instance property of [<code>ResError</code>](#ResError)  
<a name="ResError+message"></a>

### resError.message : <code>string</code>
Error message

**Kind**: instance property of [<code>ResError</code>](#ResError)  
<a name="ResError+data"></a>

### resError.data : <code>\*</code>
Error data object

**Kind**: instance property of [<code>ResError</code>](#ResError)  
<a name="ResError+getResourceId"></a>

### resError.getResourceId() ⇒ <code>string</code>
Error resource ID

**Kind**: instance method of [<code>ResError</code>](#ResError)  
**Returns**: <code>string</code> - Resource ID  
<a name="eventCallback"></a>

## eventCallback : <code>function</code>
Event callback

**Kind**: global typedef  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>object</code> | Event data object |
| resource | <code>object</code> | Resource emitting the event |
| event | <code>string</code> | Event name including namespace |
| action | <code>string</code> | Event action |

