const bcrypt = require('bcrypt');

bcrypt.hash('123456', 10)
  .then(h => {
    console.log(h);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
