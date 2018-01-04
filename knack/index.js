var express = require('express')
  , request = require('request')
  , cookieParser = require('cookie-parser')
  , exphbs = require('express-handlebars')
  , build = require('build-url')
  , bodyParser = require('body-parser')
  , morgan = require('morgan')
  , rand = require('rand-paul')
  , util = require('util');

var keys = {
  'public': '35d273679a9945bdaa66a58e3d781c19',
  'private': '4e08c678656e49128e58277a17c13b34'
}

var url = 'https://knack-spotify.herokuapp.com'

var music_api_key = '987d7ecb2f8a2bd10928d61d9a424081';

var app = express();
var port = process.env.PORT || 3000;

// config
app.engine('handlebars', exphbs({defaultLayout: 'layout'}));
app.set('view engine', 'handlebars');
app.use(cookieParser());
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev'));

// routes
app.get('/', function(req, res) {
  res.render('home');
});

app.get('/callback', function(req, res) {

  var options = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      'client_id': keys.public,
      'client_secret': keys.private,
      'grant_type': 'authorization_code',
      'code': req.query.code,
      'redirect_uri': url + '/callback'
    }
  };

  request.post(options, function(error, body, response) {
    if (error) console.log(error);

    var cookieOptions = {
      maxAge: 1000 * 60 * 60, // 60 mins
    }

    json = JSON.parse(response);
    res.cookie('token', json.access_token, cookieOptions);

    res.redirect('/create');
  });
  
});

app.get('/create', function(req, res) {
  var options = {
    url: 'https://api.spotify.com/v1/me/top/tracks',
    headers: {
      'Authorization': 'Authorization: Bearer ' + req.cookies.token
    }
  }

  request(options, function(error, body, response) {
    var json = JSON.parse(response);
    try {
      var album = rand.paul(json.items)
        , title = album.name
        , artist = album.artists[0].name;
    } catch (err) {
      return res.send({error: 'i am ready to end my life'});
    }

    var url = build('http://api.musixmatch.com/ws/1.1', {
      path: 'track.search',
      queryParams: {
        'format': 'json',
        'apikey': music_api_key,
        'q_track': title,
        'q_artist': artist
      }
    });

    request(url, function(e, b, r) {
      var json = JSON.parse(r);
      var id = json.message.body.track_list[0].track.track_id

      res.redirect('lyrics/' + id);
    });
  });
});

app.get('/lyrics/:id', function(req, res) {
  var url = build('http://api.musixmatch.com/ws/1.1', {
    path: 'track.lyrics.get',
    queryParams: {
      'format': 'json',
      'apikey': music_api_key,
      'track_id': req.params.id
    }
  });

  request(url, function(e, b, r) {
    var json = JSON.parse(r);
    try {
      var lyrics = json.message.body.lyrics.lyrics_body;
    } catch (err) {
      res.render('lyrics', {lyrics: err});
    }

    try {
      var excess = lyrics.split('*******')
      , split_lyrics = excess[0].split('\n');
    } catch (err) {
      return res.render('lyrics', {lyrics: lyrics});
    }

    var index = Math.floor(Math.random() * split_lyrics.length);

    var complete = util.format('%s, %s.', split_lyrics[index], split_lyrics[index+1]);
    return res.render('lyrics', {lyrics: complete});
  });
});


// debug because shelby's iphone won't work with this for some reason
app.get('/me', function(req, res) {
  if (!req.cookies.token) return res.send({error: 'not authenticated'});

  var options = {
    url: 'https://api.spotify.com/v1/me',
    headers: {
      'Authorization': 'Authorization: Bearer ' + req.cookies.token
    }
  }

  request(options, function(e, b, content) {
    var json = JSON.parse(content);
    res.send(json);
  });
});

app.get('/cookies', function(req, res) {
  res.send(req.cookies);
})

app.get('*', function(req, res) {
  res.redirect('/');
})

app.listen(port, function() {
  console.log('watching on port %s', port);
});
