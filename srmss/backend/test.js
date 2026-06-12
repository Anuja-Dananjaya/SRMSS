const bcrypt = require('bcryptjs');

const password = 'Admin@1234';
const hash = bcrypt.hashSync(password, 10);
console.log('Hash:', hash);