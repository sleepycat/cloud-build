require("babel-polyfill");
import request from 'supertest'
import expect from 'expect'
import { db } from '../src/data/database'

let vertices = db.collection('vertices')
let edges = db.collection('edges')
var aqlQuery = require('arangojs').aqlQuery;

describe('Arangodb', () => {

  beforeEach(async ()=>{
    let vertex_data = require('./data/vertices').vertices
    let edge_data = require('./data/edges').edges
    await vertices.import(vertex_data)
    await edges.import(edge_data)
  })

  afterEach(async ()=>{
    await db.truncate()
  })

  it('find vertices and edges collections', async (done) => {
    let collections = await db.collections();
    let collectionNames = collections.map((c) => {return c.name});
    expect(collectionNames).toInclude('vertices');
    expect(collectionNames).toInclude('edges');
    done();
  });

  it('can query the database with AQL', async (done) => {
    let vertices = await db.collection('vertices');
    await vertices.save({hello: 'world'});

    let cursor = await db.query('FOR doc IN vertices FILTER doc.hello == "world" RETURN doc');
    let result = await cursor.next();

    expect(result.hello).toEqual("world");
    done();
  })

  it('can insert data', async (done) => {
    let latLng = {"lat":45.4292652,"lng":-75.6900505}
    let location = {"lat":45.4292652,"lng":-75.6900505,"type":"location","address":"126 York Street, Ottawa, ON K1N, Canada"};
    let aql = aqlQuery`
      UPSERT ${latLng} INSERT ${location} UPDATE {} IN vertices RETURN NEW
    `
    let cursor = await db.query(aql);
    let result = await cursor.all();
    expect(result[0].lat).toEqual(45.4292652);
    done();
  });

  it('can gather a summary of the technologies', async (done) => {
    let aql = aqlQuery`
    let locations = (WITHIN_RECTANGLE(vertices, 45.49407440402927, -75.48362731933594, 45.34949122231596, -75.94058990478516)) LET summary = ( FOR loc in locations FOR tech in TRAVERSAL(vertices, edges, loc._id, "any", { maxDepth: 2, filterVertices: [ { type: "technology" } ], vertexFilterMethod: [ "exclude" ], uniqueness: {"vertices": "global"}}) COLLECT technology = tech.vertex.name INTO g RETURN {"name": technology, "count": LENGTH(g)}) LET sorted = (FOR s in summary SORT s.count DESC LIMIT 10 RETURN s) LET offices = (FOR loc in locations FOR office in TRAVERSAL(vertices, edges, loc._id, "inbound", { maxDepth: 2, filterVertices: [ { type: "office" } ], vertexFilterMethod: [ "exclude" ], uniqueness: {"vertices": "global"}}) RETURN office ) RETURN {sample_size: LENGTH(offices), "summary": sorted}
    `
    let cursor = await db.query(aql);
    let result = await cursor.all();

    expect(result[0].sample_size).toEqual(2);
    done();
  });

});



