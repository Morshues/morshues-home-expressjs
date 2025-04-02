const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const { engine } = require('express-handlebars');
const dayjs = require('dayjs');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const indexRouter = require('./routes');
const familyPrivateRoutes = require('./routes/family_private');
const shortenedRoutes = require('./routes/url.routes');
const tgRoutes = require('./routes/tg.routes');
const browseLibraryRoutes = require("./routes/browse_library.routes");

const app = express();

require('dotenv').config();

app.use(session({
  secret: process.env.SESSION_SECRET_KEY,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));
app.use(flash());

// view engine setup
app.engine('hbs', engine({
  extname: '.hbs',
  helpers: {
    formatDate: (date) => {
      return dayjs(date).format('YYYY-MM-DD HH:mm');
    }
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/family_private', familyPrivateRoutes);
app.use('/', shortenedRoutes);

if (process.env.ENV === 'local') {
  // only open these functions on local
  app.use('/tg', tgRoutes);

  app.use(express.static('../local_assets'));
  app.use('/library/', browseLibraryRoutes);
}

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
