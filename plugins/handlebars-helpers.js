const handlebars = require('handlebars');

module.exports = function registerHelpers() {
  handlebars.registerHelper('default', (value, fallback) => value || fallback);
  handlebars.registerHelper('eq', (a, b) => a.toString() === b.toString());
  handlebars.registerHelper('json', (context) => {
    return context !== undefined && context !== null
      ? JSON.stringify(context)
      : 'null';
  });
  handlebars.registerHelper('includesObjectId', (array, userId) =>
    array?.some((id) => id?.toString() === userId?.toString())
  );
  handlebars.registerHelper('gt', (a, b) => a > b);
  handlebars.registerHelper('lt', (a, b) => a < b);
  handlebars.registerHelper('eq', (a, b) => a === b);
  handlebars.registerHelper('add', (a, b) => a + b);
  handlebars.registerHelper('subtract', (a, b) => a - b);
  handlebars.registerHelper('range', (start, end) => {
    let range = [];
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  });
  handlebars.registerHelper('imagePlaceholder', () => `/img/nsfw-blurred-2.png`);
  handlebars.registerHelper('capitalize', (str) => 
    (typeof str !== 'string' ? '' : str.charAt(0).toUpperCase() + str.slice(1))
  );
};
