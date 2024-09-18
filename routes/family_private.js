const express = require('express');
const router = express.Router();

router.post('/api/auth', (req, res) => {
  if (!req.body) {
    return res.status(400).send('Request body is missing');
  }

  const { username, password } = req.body;

  if (username && password) {
    res.status(200).send(`Username: ${username}, Password: ${password}`);
  } else {
    res.status(400).send('Username or password is missing');
  }
});

module.exports = router;