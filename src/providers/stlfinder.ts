import { MetaSearchProvider } from './metasearch.js';

export class StlfinderProvider extends MetaSearchProvider {
  constructor() {
    super({
      name: 'stlfinder',
      searchUrl: q => `https://www.stlfinder.com/search/?q=${q}`,
      selfHost: /stlfinder\.com$/,
    });
  }
}
