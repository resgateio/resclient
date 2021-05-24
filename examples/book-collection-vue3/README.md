# Book Collection example - Vue 3

This is a Vue 3 version of [Resgate's Book Collection example](https://github.com/resgateio/resgate/tree/master/examples/book-collection). It contains both a client and a server written for *node.js*.

The purpose of this example is to show how ResClient can be used together with Vue 3 and its built in reactivity. To learn more about writing services for Resgate, visit the [Resgate project](https://github.com/resgateio/resgate).

## Prerequisite

* Have [NATS Server](https://nats.io/download/nats-io/gnatsd/) and [Resgate](https://github.com/resgateio/resgate) running
* Have [node.js](https://nodejs.org/en/download/) installed

## Running the example

Run the following commands:
```bash
npm install
npm start
```

Open the client
```
http://localhost:8083
```

## Notes

In the example, each _ResModel_ and _ResCollection_ is wrapped with `Vue.reactive(...)` to make the Vue components update without the need to listen to specific events.

```javascript
const app = Vue.createApp({
    client: null,
    created() {
        // The client is stored outside the data object to prevent it from being
        // wrapped in a Vue reactive Proxy.
        this.client = new ResClient('ws://localhost:8080')
            // The full wildcard (">") let's us wrap all ResModel/ResCollection
            // instances in a Vue reactive Proxy.
            .registerModelType(">", (api, rid) => Vue.reactive(new ResModel(api, rid)))
            .registerCollectionType(">", (api, rid) => Vue.reactive(new ResCollection(api, rid)));
        /* ... */
    },
    /* ... */
});
```

## Things to try out

**Realtime updates**  
Run the client in two separate tabs to observe realtime updates.

**System reset**  
Run the client and make some changes. Restart the server to observe resetting of resources in client.

**Resynchronization**  
Run the client on two separate devices. Disconnect one device, then make changes with the other. Reconnect the first device to observe resynchronization.


## Web resources

### Get book collection
```
GET http://localhost:8080/api/bookService/books
```

### Get book
```
GET http://localhost:8080/api/bookService/book/<BOOK_ID>
```

### Update book properties
```
POST http://localhost:8080/api/bookService/book/<BOOK_ID>/set
```
*Body*  
```
{ "title": "Animal Farming" }
```

### Add new book
```
POST http://localhost:8080/api/bookService/books/add
```
*Body*  
```
{ "title": "Dracula", "author": "Bram Stoker" }
```

### Delete book
```
POST http://localhost:8080/api/bookService/books/delete
```
*Body*  
```
{ "id": <BOOK_ID> }
```