import { Component } from 'solid-js';
import { useI18n } from '../../i18n';

const SearchPage: Component = () => {
  const { t } = useI18n();
  
  return (
    <div>
      <h1>{t('search.title')}</h1>
      <p>
        {t('search.description')}
      </p>
    </div>
  );
};

export default SearchPage;
