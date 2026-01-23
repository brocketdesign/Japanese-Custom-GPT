const handlebars = require('handlebars');

module.exports = function registerHelpers() {
  handlebars.registerHelper('default', (value, fallback) => value || fallback);
  handlebars.registerHelper('eq', (a, b) => {
    if (a == null || b == null) {
      return false;
    }
    return a.toString() === b.toString();
  });
  handlebars.registerHelper('ne', (a, b) => a.toString() !== b.toString());
  handlebars.registerHelper('json', (context) => {
    return context !== undefined && context !== null
      ? JSON.stringify(context)
      : 'null';
  });
  handlebars.registerHelper('or', (a, b) => a || b);
  handlebars.registerHelper('includesObjectId', (array, userId) =>
    array?.some((id) => id?.toString() === userId?.toString())
  );
  handlebars.registerHelper('increment', function(value) {
    return value + 1;
  });
  handlebars.registerHelper('gt', (a, b) => a > b);
  handlebars.registerHelper('lt', (a, b) => a < b);
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
  handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
    return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
  });

  handlebars.registerHelper('ifNotEquals', function(arg1, arg2, options) {
    return (arg1 !== arg2) ? options.fn(this) : options.inverse(this);
  });

  handlebars.registerHelper('lookupOrFirst', function(obj, key) {
    if (obj && obj[key]) {
      return obj[key];
    }
    if (obj && typeof obj === 'object') {
      for (const k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k]) {
          return obj[k];
        }
      }
    }
    return '';
  });

  handlebars.registerHelper('getPaymentAmount', function(product_id) {
    switch (product_id) {
      case 'com.cryptoinfojapan.aidate.monthly':
        return 990;
      case 'com.cryptoinfojapan.aidate.yearly':
        return 9900;
      case 'com.cryptoinfojapan.aidate.monthly.promo':
        return 390;
      case 'com.cryptoinfojapan.aidate.yearly.promo':
        return 3900;
      default:
        return 0;
    }
  });

  handlebars.registerHelper('formatDate', function(date) {
    if (!date) return '';
    
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  });
};
handlebars.registerHelper('encodeURIComponent', function(str) {
  return encodeURIComponent(str);
});
handlebars.registerHelper('decodeURIComponent', function(str) {
  return decodeURIComponent(str);
});
// math
handlebars.registerHelper('math', function(lvalue, operator, rvalue) {
  lvalue = parseFloat(lvalue);
  rvalue = parseFloat(rvalue);

  return {
    '+': lvalue + rvalue,
    '-': lvalue - rvalue,
    '*': lvalue * rvalue,
    '/': lvalue / rvalue,
    '%': lvalue % rvalue,
    '==': lvalue == rvalue,
    '===': lvalue === rvalue,
    '!=': lvalue != rvalue,
    '!==': lvalue !== rvalue,
    '<': lvalue < rvalue,
    '>': lvalue > rvalue,
    '<=': lvalue <= rvalue,
    '>=': lvalue >= rvalue
  }[operator];
});
handlebars.registerHelper('not', function(value) {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'boolean') {
    return !value;
  }
  if (typeof value === 'number') {
    return value === 0;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  return false;
});
handlebars.registerHelper('or', function(...args) {
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i]) {
      return true;
    }
  }
  return false;
});
handlebars.registerHelper('substring', function(str, start, end) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.substring(start, end);
});
handlebars.registerHelper('divide', function(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number' || b === 0) {
    return 0;
  }
  return (a / b).toFixed(1);
});

// Pagination helpers
handlebars.registerHelper('lte', function(a, b) {
  return a <= b;
});

handlebars.registerHelper('gte', function(a, b) {
  return a >= b;
});

handlebars.registerHelper('and', function(...args) {
  for (let i = 0; i < args.length - 1; i++) {
    if (!args[i]) {
      return false;
    }
  }
  return true;
});

handlebars.registerHelper('multiply', function(a, b) {
  return a * b;
});