// ********************** Initialize server **********************************

const server = require('../src/index.js'); //TODO: Make sure the path to your index.js is correctly added

// ********************** Import Libraries ***********************************

const chai = require('chai'); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;

// ********************** DEFAULT WELCOME TESTCASE ****************************

describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
});

// *********************** TODO: WRITE 2 UNIT TESTCASES **************************

describe('Register-Positive', () => {
  it('Positive: /register', done => {
    chai
      .request(server)
      .post('/register')
      .send({email:'email@gmail.com', password:'password'})
      .redirects(0)
      .end((err, res) => {
       res.should.have.status(302);
        done(); 
      });
  })
});

describe('Register-Negative', () => {
  it('Negative: /register', done => {
    chai
      .request(server)
      .post('/register')
      .send({email:'1234', password:'password'})
      .redirects(0)
      .end((err, res) => {
       res.should.have.status(302);
        done(); 
      });
  })
});

// ***************************** TESTING LOGIN ***********************************

describe('Login-Positive', () => {
  it('Positive: /login', done => {
    chai
      .request(server)
      .post('/login')
      .send({email:'email@gmail.com', password:'password'})
      .redirects(0)
      .end((err, res) => {
       res.should.have.status(302);
        done();  
      });
  })
});

describe('Login-Negative', () => {
  it('Negative: /login', done => {
    chai
      .request(server)
      .post('/login')
      .send({email:'emailgmail.com', password:'password'})
      .redirects(0)
      .end((err, res) => {
       res.should.have.status(302);
        done(); 
      });
  })
});