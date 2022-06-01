//---------------------------------------Middleware/Packages-------------------------------------------------------

const mongoose = require("mongoose");
const Models = require("./models.js");
const Movies = Models.movies;
const Users = Models.users;
const express = require("express");
const cors = require("cors");
const app = express();
const { check, validationResult } = require("express-validator");

morgan = require("morgan");
app.use(morgan("common"));
app.use(express.static("public"));

//mongoose.connect("mongodb://localhost:27017/myFlixDB", {useNewUrlParser: true, useUnifiedTopology: true});

mongoose.connect( process.env.CONNECTION_URI , {useNewUrlParser: true, useUnifiedTopology: true});

const bodyParser = require("body-parser"),
methodOverride = require("method-override");
const { restart } = require("nodemon");
app.use(bodyParser.urlencoded({ extended: true,}));
app.use(bodyParser.json());
app.use(methodOverride());

let allowedOrigins = ["http://localhost:5500", "http://testsite.com", "http://localhost:1234"];

app.use(cors({
  origin: (origin, callback) => {
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){ 
      let message = "The CORS policy for this application doesn’t allow access from origin" + origin;
      return callback(new Error(message ), false);
    }
    return callback(null, true);
  }
}));

let auth = require('./auth')(app);

const passport = require('passport');
require('./passport');

//---------------------------------------API URL's and Functions-------------------------------------------------------

//function returns a homepage

app.get("/", (req,res) => {
  res.send("Welcome to the My Flix App!!!")
});


// function returns myFlixDB instructions for developer use

app.get("/documentation", (req, res) => {
  res.sendFile("Public/documentation.html", { root: __dirname });
});


//function allows a new user to register

app.post("/users/register", 
 [
  check("Username", "Username with a minimum of six characters is required").isLength({min: 6}),       //Validation logic for user registration request
  check("Username", "Username contains non alphanumeric characters- not allowed").isAlphanumeric(),
  check("Password", "Password is required").not().isEmpty(),
  check("Password", "Password with a minimum of eight characters is required").isLength({min: 8}),
  check('Email', 'Email does not appear to be valid').isEmail()
],        
(req, res) => {
  
let errors = validationResult(req);        //checks validation object for errors

if (!errors.isEmpty()) {
    return res.status(422).json( {errors: errors.array() });
}
let hashPassword = Users.hashPassword(req.body.Password);
  Users.findOne({ Username: req.body.Username })
    .then((users) => {
      if (users) {
        return res.status(400).send(req.body.Username + "already exists");
      } else {
        Users.create({
         Username: req.body.Username,
         Password: hashPassword,
         Email: req.body.Email,
         Birthdate: req.body.Birthdate,
         Favorites: req.body.Favorites
        })
        .then((users) => {res.status(201).json(users)})
        .catch((error) => {
         console.error(error);
         res.status(500).send("Error: " + error);
    })
  }
})
   .catch((error) => {
     console.error(error);
     res.status(500).send("Error: " + error );
   });
});


//function allows user to add movies to favorites list

app.post("/users/:Username/movies/:MovieID", passport.authenticate("jwt", { session: false }), (req, res) => {
  Users.findOneAndUpdate({ Username: req.params.Username }, 
    {
       $push: { Favorites: req.params.MovieID }
    },
    { new: true },
    ( err, updatedUser) => {
      if (err) {
        console.error(err);
        res.status(500).send("Error: " + err);
      } else {
        res.json(updatedUser);
      }
    });
});


//function returns list of all movies

app.get("/movies", /*passport.authenticate("jwt", { session: false }),*/ (req, res) => {
  Movies.find()
    .then((movies) => {
      res.status(201).json(movies);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Error: " + err);
    });
});


//function locates a single user by username

app.get("/users/:Username", passport.authenticate("jwt", { session: false }), (req,res) => {
  Users.findOne({ Username: req.params.Username })
  .then((user) => {
    res.json(user);
  })
  .catch((err) => {
    console.error(err);
    res.status(500).send("Error: " + err);
  });
});


//function allow user to locate movie by Title

app.get("/movies/:titles",  passport.authenticate("jwt", { session: false }), (req, res) => {
  Movies.findOne({ Title: req.params.titles })
  .then((movies) => {
    res.json(movies);
  })
  .catch((err) => {
    console.error(err);
    res.status(500).send("Error: " + err);
  });
});


// function filters list of movies by genre and displays the movie data

app.get("/movies/genres/:genres", passport.authenticate("jwt", { session: false }), (req, res) => {
  Movies.find({ "Genre.Name" : req.params.genres })
  .then((movies) => {
    res.json(movies);
  })
  .catch((err) => {
    console.error(err);
    res.status(500).send("Error: " + err);
  });
});


//functions returns data about a director (bio, birth year, death year) by name

app.get("/movies/directors/:names", passport.authenticate("jwt", { session: false }), (req, res) => {
  Movies.findOne({ "Director.Name": req.params.names })
  .then((movies) => {
   if (movies) {
     res.status(200).json(movies.Director);
   } else {
     res.status(400).send("Director not found.");
   };
  })
  .catch((err) => {
    res.status(500).send("Error" + err);
  });
});


//function allows user to update their account

app.put("/users/:Username",  passport.authenticate("jwt", { session: false }),  (req, res) => {
  Users.findOneAndUpdate({ Username: req.params.Username },
    { $set:
      {
        Username: req.body.Username,
        Password: req.body.Password,
        Email: req.body.Email,
        Birthdate: req.body.Birthdate,
        Favorites: req.body.Favorites
      }
    },
     { new: true },
     (err, updatedUser) => {
       if(err) {
         console.error(err);
         res.status(500).send( "Error: " + err);
       } else {
         res.json(updatedUser)
       }
    });
});


//function allows user to remove a movie from favorite list

app.delete("/users/:Username/movies/:MovieID", passport.authenticate("jwt", { session: false }), (req, res) => {
  Users.findOneAndUpdate({ Username: req.params.Username }, 
    {
       $pull: { Favorites: req.params.MovieID }
    },
    { new: true },
    ( err, updatedUser) => {
      if (err) {
        console.error(err);
        res.status(500).send("Error: " + err);
      } else {
        res.json(updatedUser);
      }
    });
});


//allows user to delete their account

app.delete("/users/unregister/:Username", passport.authenticate("jwt", { session: false }), (req, res) => {
  Users.findOneAndRemove({ Username: req.params.Username })
    .then((users) => {
      if (!users) {
        res.status(400).send( req.params.Username + " was not found");
    } else {
      res.status(200).send( req.params.Username + " was deleted");
    }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Error: " + err);
  });
});

//---------------------------------------Catching Errors-------------------------------------------------------


//function to log all errors

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("UH-OH! Something broke!");
});


//---------------------------------------Port Connection-------------------------------------------------------
const port = process.env.PORT || 5500;
app.listen(port, "0.0.0.0", () => {
  console.log("Listening on Port " + port);
});


// {
//   "Username": "BriannaWins",
//   "Password": "Winston95",
//   "Email": "briannawinston@email.com",
//   "Birthdate": "03/14/1995",
//   "Favorites": []
// }