const express = require("express");
const app = express();
const fs = require("fs");
var formidable = require("formidable");
// var { getVideoDuration } = require("get-video-duration");
// const cors = require('cors')
// app.use(cors())
const server = require('http').Server(app)
const mongoose = require('mongoose');
const sha256 = require('js-sha256');
const session = require('express-session');
var bodyParser = require("body-parser");
const { type } = require('os');
app.use(bodyParser.urlencoded({ extended: true })); 
app.set('view engine', 'ejs')
app.use(express.static('public'))


app.use(session({ 
  secret: "John Wick", 
  resave: false, 
  saveUninitialized: false
}));

mongoose.connect("mongodb+srv://harsh:harshmistry@cluster0.ncy6p.mongodb.net/HMIMiniproject?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
}).then(() => {
  console.log('Mongo Connection Successful');
}).catch(err => {
  console.log('ERROR:', err.message);
})

// Schemas
var UserSchema = new mongoose.Schema(
  { 
   user_name: {
        type: String,
        require: true
      },
   user_password: {
        type: String,
        require: true
      },
   email:  {
        type: String,
        require: true
      },
    contact: {
      type: String,
      require: true
    }
},{collection: 'users'});

var VideoSchema = new mongoose.Schema(
  { 
   video_title: {
        type: String,
        require: true
      },
   file_name: {
        type: String,
        require: true
      },
   description:  {
        type: String,
        require: true
      },
    user_email: {
      type: String,
      require: true
    }
},{collection: 'videos'});

var Users = mongoose.model('Users',UserSchema);
var Videos = mongoose.model('Videos',VideoSchema);

const redirectLogin = (req, res, next) => {
  if (!req.session.email){
    res.redirect('/login');
  }
  else{
    next();
  }
}

app.get('/login', (req, res) => {
  res.render('login', { message: "", message_category: 'danger' })
})

app.post('/login', (req, res) => {
  var email = req.body.email;
  var password = req.body.password;

  Users.findOne({email: email, user_password: sha256(password)}, (err, data) => {
    if (err) {
      console.log(err);
      res.render('login', { message: "Something went wrong !!!", message_category: 'danger' });
    }
    else{
      if(data == null){
          res.render("login", {message: "Invalid Email or Password !!!", message_category: 'danger'});
      }
      else{
        // User exits
        console.log(data);
        req.session.user = data;
        req.session.email = email;
        req.session.name = data.user_name;
        res.redirect('/upload_video');
      }
    }
  });

})

app.get('/logout', redirectLogin, (req, res) => {
  req.session.destroy(err => {
    if (err) {
      res.redirect('/')
    }
    else{
      res.redirect('/login')
    }
  })
})

app.get('/register', (req, res) => {
  res.render('register', { message: "", message_category: 'danger' });
})

app.post('/register', (req, res) => {
  var name = req.body.name;
  var email = req.body.email;
  var contact = req.body.contact;
  var password = req.body.password;
  var confirm_password = req.body.confirm_password;

  // check if user already exists
  Users.findOne({email: email}, (err, data) => {
    if (err) {
      console.log(err);
      res.render('register', { message: "Something went wrong !!!", message_category: 'danger' });   
    }
    else{
      if(data == null){
        // no user with this email make new one
        if (password != confirm_password){
          res.render('register', { message: "Passwords does not match.", message_category: 'danger' }); 
        }
        else{
          Users.create(
            {
              user_name: name,
              user_password: sha256(password),
              email: email,
              contact: contact 
            },
            function (err, Users) {
              if (err) {
                console.log(err);
              }
              else {
                console.log(Users);
              }
            }
          );
          res.render("login", { message: "User Created Successfully.", message_category: 'success'});
        }
      }
      else{
        // User already exits
        res.render('register', { message: "User already exists.", message_category: 'danger'}); 
      }
    }
  });
})

app.get('/', redirectLogin, (req, res) => {
  var user = req.session.user;
  res.render('index', {user: user});  
})


app.get("/upload_video", redirectLogin, (req, res) => {
    var user = req.session.user;
    res.render('upload_video', {user: user, message: "", message_category: 'success'})
});

app.post("/upload_video", redirectLogin, (req, res) => {
    var user = req.session.user;
    var formData = new formidable.IncomingForm();
    formData.marFileSize = 1000 * 1024 * 1024;
    formData.parse(req, function (error, fields, files) {
        var title = fields.video_title;
        var description = fields.video_description;
        console.log(files);
        var oldPathVideo = files.video.path;
        var videoName = new Date().getTime() + "-" + files.video.name;
        var newPath = "videos/" + videoName;
        fs.rename(oldPathVideo, newPath, function (error) {
            if(error){
                console.log(error);
                res.render('upload_video', {user: user, message: "Something Went Wrong", message_category: 'danger'});
            }
            else{
                Videos.create({
                    video_title: title,
                    file_name: videoName,
                    description: description,
                    user_email: user.email
                }, function (err, videos) {
                    if (err) {
                      console.log(err);
                        res.render('upload_video', {user: user, message: "Something Went Wrong", message_category: 'danger'});
                    }
                    else{
                        console.log(videos);
                        res.render('upload_video', {user: user, message: "Video Uploaded Successfully", message_category: 'success'});
                    }
                });
            }
        });
    });
});

app.get("/stream_videos", redirectLogin, (req, res) => {
    var user = req.session.user;

    Videos.find({user_email: user.email}, (err, data) => {
        if(err){
            console.log(err);
            res.render('stream_videos', {user: user, videos: null});
        }
        else{
            console.log(data);
            res.render('stream_videos', {user: user, videos: data});
        }
    });
});


app.get("/stream_video/:file_name", redirectLogin, (req, res) => {
    var user = req.session.user;
    var file_name = req.params.file_name;

    Videos.findOne({file_name: file_name, user_email: user.email}, (err, data) => {
        if(err){
            console.log(err);
            res.redirect("/stream_videos");
        }
        else{
            if(data != null){
                console.log(data);
                res.render('stream_video', {user: user, video: data});
            }
            else{
                res.redirect("/stream_videos");
            }
        }
    });
});


app.get("/video/:file_name", function (req, res) {
    var file_name = req.params.file_name;
    // Ensure there is a range given for the video
    const range = req.headers.range;
    if (!range) {
        res.status(400).send("Requires Range header");
    }

    // get video stats (about 61MB)
    const videoPath = "videos/" + file_name;
    const videoSize = fs.statSync("videos/" + file_name).size;

    // Parse Range
    // Example: "bytes=32324-"
    const CHUNK_SIZE = 10 ** 6; // 1MB
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

    // Create headers
    const contentLength = end - start + 1;
    const headers = {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": "video/mp4",
    };

    // HTTP Status 206 for Partial Content
    res.writeHead(206, headers);

    // create video read stream for this particular chunk
    const videoStream = fs.createReadStream(videoPath, { start, end });

    // Stream the video chunk to the client
    videoStream.pipe(res);
});

server.listen(process.env.PORT||3030, "0.0.0.0")