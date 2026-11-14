import { MetaSearchProvider } from './metasearch.js';

export class YeggiProvider extends MetaSearchProvider {
  constructor() {
    super({
      name: 'yeggi',
      searchUrl: q => `https://www.yeggi.com/q/${q}/`,
      selfHost: /yeggi\.com$/,
    });
  }
}
