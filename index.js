'use strict';

const express = require('express');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const mongodb = require('mongodb');
const formidable = require('formidable');

require('dotenv').config();
const dbuser = process.env.DB_USER;
const dbpassword = process.env.DB_PASS;
const dbname = process.env.DB_NAME;

const MongoClient = mongodb.MongoClient;
const uri = `mongodb+srv://${dbuser}:${dbpassword}@${dbname}.mongodb.net/test?retryWrites=true&w=majority`;
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};
let db = null;
MongoClient.connect(uri, options, function(err, client) {
  if (err) throw err;
  else {
    db = client.db('opus');
    console.log('Succesfully connected to db');
  }
});
const store = new MongoDBStore({
  uri: uri,
  databaseName: 'opus',
  collection: 'sessions',
});

function getUserInfo(req, callback) {
  const query = { userName: req.session.userName };
  db.collection('users').find(query).toArray(done);
  function done(err, data) {
    if (err) throw err;
    else {
      callback(data[0]);
    }
  };
};

function updateUserInfo(req, update, callback) {
  db.collection('users').updateOne(
    { userName: req.session.userName },
    { $set: update },
    { upsert: true },
    done,
  );
  function done(err) {
    if (err) throw err;
    else {
      callback();
    }
  }
};

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('static'));
app.use(session({
  secret: 'ikwilkaas',
  resave: true,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
  store: store,
}));
app.set('view engine', 'ejs');
app.set('views', 'view');

app.listen(port, function() {
  console.log(`Opus app listening at http://localhost:${port}`);
});

app.get(['/', '/homepage', '/index', '/discover'], discover);
app.get('/profile', profile);
app.get('/artwork', artwork);
app.get('/set-user', setUser);

// Set user
app.post('/set-user', changeUser);
// Activate Opus Mode
app.post('/profile', setOpusMode);
// Receive Artwork Upload
app.post('/artwork', uploadArtwork);

// Error functions
app.use(function(req, res, next) {
  res.status(404).send("Sorry can't find that! (Error code 404)");
});

app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Something broke! (Error code 500)');
});

// Render functions
function discover(req, res) {
  if (!req.session.userName) req.session.userName = 'user0';
  getUserInfo(req, function(result) {
    let page = 'discover.ejs';
    let pageTitle = 'Discover';
    res.render(page, {
      title: pageTitle,
      userInfo: result,
    });
  });
}

function profile(req, res) {
  if (!req.session.userName) req.session.userName = 'user0';
  getUserInfo(req, function(result) {
    let page = 'profile.ejs';
    let pageTitle = 'Profile';
    res.render(page, {
      title: pageTitle,
      userInfo: result,
    });
  });
}

function artwork(req, res) {
  if (!req.session.userName) req.session.userName = 'user0';
  getUserInfo(req, function(result) {
    let page = 'artwork.ejs';
    let msg = 'Input Artwork Image File';
    let error = false;
    res.render(page, {
      msg: msg,
      userInfo: result,
      error: error,
    });
  });
}

function setUser(req, res) {
  if (!req.session.userName) req.session.userName = 'user0';
  getUserInfo(req, function(result) {
    let page = 'set-user.ejs';
    let pageTitle = 'Set User';
    res.render(page, {
      title: pageTitle,
      userInfo: result,
    });
  });
}

// Post functions
function changeUser(req, res) {
  let form = new formidable.IncomingForm();
  form.parse(req);
  form.on('field', function(name, value) {
    req.session.userName = value;
  });
  form.on('end', function() {
    res.redirect('./profile');
  });
}

function setOpusMode(req, res) {
  let form = new formidable.IncomingForm();
  let opusActive = false;
  form.parse(req);
  form.on('field', function(name, value) {
    if (name === 'true') {
      opusActive = true;
    } else {
      opusActive = false;
    }
  });
  form.on('end', function() {
    updateUserInfo(req, { opusActive: opusActive }, function() {
      console.log('Opus mode succesfully updated. Opus: ' + opusActive);
      res.redirect('./profile');
    });
  });
}

function uploadArtwork(req, res) {
  let form = new formidable.IncomingForm();
  let artwork = {};
  form.parse(req);
  form.on('field', function(name, value) {
    artwork[name] = value;
  });
  form.on('fileBegin', function(name, file) {
    file.name = 'img' + Date.now() + '.' + file.type.split('/')[1];
    file.path = __dirname + '/static/uploads/' + file.name;
    artwork[name] = file.name;
  });
  form.on('aborted', function() {
    console.error('Request aborted by the user');
    artwork = undefined;
  });
  form.on('error', function(err) {
    console.error('Error', err);
    artwork = undefined;
    throw err;
  });
  form.on('end', function() {
    updateUserInfo(req, { artwork: artwork }, function() {
      console.log('Artwork succesfully updated');
      res.redirect('./profile');
    });
  });
}
