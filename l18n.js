const path = require('path');
const fs = require('fs');

// Load translations from a single JSON file
const translationsPath = path.join(__dirname, 'locales/translations.json');
const translations = JSON.parse(fs.readFileSync(translationsPath, 'utf-8'));

// Helper function to retrieve nested keys
const getNestedTranslation = (obj, key) => {
  return key.split('.').reduce((acc, curr) => (acc && acc[curr] ? acc[curr] : null), obj);
};

// Middleware
const i18nMiddleware = (req, res, next) => {
  // Determine the user's language (priority: query > cookie > headers > default)
  const lang =
    req.query.lang || 
    req.cookies?.lang || 
    req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 
    'en';

  // Validate language; fallback to 'en' if not supported
  const currentLang = translations[lang] ? lang : 'en';

  // Add translation helper and current language to res.locals for templates
  res.locals.t = (key) => getNestedTranslation(translations[currentLang], key) || key;
  res.locals.lang = currentLang;

  next();
};

module.exports = i18nMiddleware;