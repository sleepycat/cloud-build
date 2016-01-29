require("babel-polyfill");

let request = require('supertest')
  , dbConfig = require('../arangodb_config')[process.env.NODE_ENV]
  , db = require('arangojs')(dbConfig)
  , app = require('../app');

describe('App', () => {

  describe('GET /', () => {

    it('serves the root route', (done) => {
      request(app)
      .get('/')
      .expect(/Usesth.is/)
      .end(done);
    })

  });


  describe('POST /graphql', () => {

    beforeEach(async () => {
      let vertex_data = require('./data/vertices').vertices
      let edge_data = require('./data/edges').edges
      await db.truncate()
      let vertices = await db.collection('vertices')
      await vertices.import(vertex_data)
      let edges = db.collection('edges')
      await edges.import(edge_data)
    })

    afterEach(async () => {
      await db.truncate()
    })

    it('serves a specified location', async (done) => {
      request(app)
      .post('/graphql')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send('{"query": "{ location(id: 2733712293){address} }"}')
      .expect('{\n  "data": {\n    "location": {\n      "address": "126 York Street, Ottawa, ON K1N, Canada"\n    }\n  }\n}')
      .end(done);
    })

    it('returns the 2 organizations for the specified location', async (done) => {
      request(app)
      .post('/graphql')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send({"query": "{ location(id:2733712293){address organizations {name uri}} }"})
      .expect((response) => {
        let organizations = response.body.data.location.organizations;
        if (!(organizations.length == 2)) {
          throw new Error(`Organizations returned were: ${JSON.stringify(organizations)}. Was expecting 2`);
        }
      })
      .end(done);
    })

    it('returns the organizations and technologies for the specified location', async (done) => {
      request(app)
      .post('/graphql')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send({"query": "{ location(id:2733712293){address organizations {name uri technologies {name}}} }"})
      .expect((response) => {
        let technologies = response.body.data.location.organizations[0].technologies;
        if (!(technologies.length > 0)) throw new Error(`What was returned ${JSON.stringify(technologies)}`);
      })
      .end(done);
    })

    it('it has an id instead of the Arangodb _key', async (done) => {
      request(app)
      .post('/graphql')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send('{"query": "{ location(id: 2733712293){id lat lng address} }"}')
      .expect((res) => {
        if (!('id' in res.body.data.location)) throw new Error("missing id!");
      })
      .end(done);
    });

    it('it shows details of the type', done => {
      request(app)
      .post('/graphql')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send({"query": "{ __type(name: \"Location\"){ name } }"})
      .expect('{\n  "data": {\n    "__type": {\n      "name": "Location"\n    }\n  }\n}')
      .end(done);
    })

    it('it can return a collection of locations', async (done) => {
      request(app)
      .post('/graphql')
      .set('content-type', 'application/json; charset=utf-8')
      .send('{"query": "{ locations{address} }"}')
      .expect((res) => {
        if(typeof res.body.errors !== 'undefined') throw new error(res.body.errors[0].message);
        let locations = res.body.data.locations;
        if(!(locations.length == 3)) throw new Error("response did not include 3 locations.");
      })
      .end(done);
    });

    // Nota Bene: This test will fail if there no geo indexes created!
    it('returns a locations within given bounds', async (done) => {
      let vertices = db.collection('vertices')
      await vertices.import([
        {"lat":-41.287723,"lng":174.776344,"type":"location","address":"56 Victoria Street, Wellington, Wellington 6011, New Zealand"}
      ]);

      request(app)
      .post('/graphql')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send({"query": "{ locations_within_bounds(sw_lat:45.41670820924417, sw_lng: -75.75180530548096, ne_lat:45.436104879546555, ne_lng:-75.66940784454347){address} }"})
      .expect((res) => {
        if(typeof res.body.errors !== 'undefined') throw new Error(res.body.errors[0].message);
        let locations = res.body.data.locations_within_bounds;
        if(!(locations.length == 1)) throw new Error("Response included locations outside bounds.");
      })
      .end(done);
    });

  });
});
