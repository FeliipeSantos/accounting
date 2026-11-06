// Registry of database modules, in dependency order.
// A new module adds its own file here (e.g. ./finance.js) with tables prefixed by its name.
module.exports = {
  MODULES: [require('./core'), require('./projects'), require('./intelligence')],
};
