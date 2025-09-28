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

const passport = require('passport');
require('./config/passport')(passport);

const app = express();

require('dotenv').config();

app.use(session({
  secret: process.env.SESSION_SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));
app.use(flash());

// For all the views to read the flash from FLASH_ERROR
const FLASH_ERROR = 'error'
app.use((req, res, next) => {
  res.locals.error = req?.flash(FLASH_ERROR);
  next();
});

// view engine setup
app.engine('hbs', engine({
  extname: '.hbs',
  partialsDir: path.join(__dirname, 'views', 'partials'),
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

app.use(passport.initialize());
app.use(passport.session({}));
app.use((req, res, next) => {
  if (req?.user) {
    const user = req.user.toJSON ? req.user.toJSON() : req.user;
    if (user.lastLogin) {
      user.lastLogin = dayjs(user.lastLogin).format('YYYY-MM-DD HH:mm');
    }
    res.locals.user = user;
    res.locals.isAdmin = user.adminInfo != null;
  } else {
    res.locals.user = null;
    res.locals.isAdmin = false;
  }
  next();
});
app.use('/', require('./routes/auth.routes'));
app.use('/api/auth', require('./routes/auth.api.routes'));

app.use('/', indexRouter);
app.use('/family_private', familyPrivateRoutes);
app.use('/', shortenedRoutes);

if (process.env.ENV === 'local') {
  // only open these functions on local
  app.use('/tg', require('./routes/tg.routes'));

  app.use(express.static('../local_assets'));
  app.use('/library/', require("./routes/browse_library.routes"));

  app.use('/link-page/', require('./routes/link_page.routes'));

  app.use('/upload/', require('./routes/upload.routes'));

  app.use('/api/file-sync', require('./routes/file_sync.routes'));
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
