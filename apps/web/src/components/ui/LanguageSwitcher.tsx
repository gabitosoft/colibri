import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? 'en';

  return (
    <div className="flex items-center gap-1">
      {LANGUAGES.map((lang, idx) => (
        <span key={lang.code} className="flex items-center gap-1">
          <button
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`text-xs font-medium transition-colors ${
              current === lang.code
                ? 'text-blue-600'
                : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            {lang.label}
          </button>
          {idx < LANGUAGES.length - 1 && (
            <span className="text-gray-300 text-xs">|</span>
          )}
        </span>
      ))}
    </div>
  );
}
