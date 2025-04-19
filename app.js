const express = require('express');
const path = require('path');
const cors = require('cors');
const ejs = require('ejs');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const { isAuthenticated } = require('./routes/server_functions');


const apiRouter = require('./routes/api');


const app = express();

app.use(session({
    secret: 'ae1fc790fb0b1c435e6a9c40cb9c44a4a2e35fbcac61e7c7e3a44b68f65f86d3f0d3c5d394c79fd2aa964f76e6c4dc5f0b6e30e0b6a786dc0e472ad51ad9be66y',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 10 // 10 minutes in milliseconds
    }
}));

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

app.listen(3001, '0.0.0.0');

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
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.sendFile(path.join(__dirname, 'views_secure/admin.html'));
});


module.exports = app;
