const express = require('express');
const path = require('path');
const cors = require('cors');
const ejs = require('ejs');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const { isAuthenticated } = require('./routes/server_functions')


const apiRouter = require('./routes/api');


const app = express();

app.use(session({
    secret: 'token-here',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 10 // 10 minutes in milliseconds
    }
}));


app.set('view engine', 'ejs');
app.use(cors({
    origin: 'http://localhost:3001', // or wherever your frontend is served
    credentials: true
}));

//logs HTTP requests
app.use(logger('dev'));

app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), {index: 'login.html'}));

app.use('/api', apiRouter); // Use API routes

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views_secure/admin.html'));
});


module.exports = app;
