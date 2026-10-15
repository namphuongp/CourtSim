import { getSeoTags, PUBLIC_PAGES, SITE_URL } from '../src/services/seo.js';

const SEO_BLOCK = /<!-- courtsim-seo:start -->[\s\S]*?<!-- courtsim-seo:end -->/;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function renderSeo(html, pathname) {
  if (!SEO_BLOCK.test(html)) throw new Error('Thiếu vùng metadata CourtSim trong index.html.');
  const markup = getSeoTags(pathname).map(({ tag, attrs = {}, children = '' }) => {
    const attributes = Object.entries({ 'data-courtsim-seo': '', ...attrs })
      .map(([name, value]) => `${name}="${escapeHtml(value)}"`).join(' ');
    if (tag === 'meta' || tag === 'link') return `<${tag} ${attributes} />`;
    const content = tag === 'script' ? children.replace(/</g, '\\u003c') : escapeHtml(children);
    return `<${tag} ${attributes}>${content}</${tag}>`;
  }).join('\n    ');
  return html.replace(SEO_BLOCK, `<!-- courtsim-seo:start -->\n    ${markup}\n    <!-- courtsim-seo:end -->`);
}

export default function seoPlugin() {
  return {
    name: 'courtsim-seo',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        return renderSeo(html, context.originalUrl ? new URL(context.originalUrl, SITE_URL).pathname : '/');
      },
    },
    // Dùng chung bundle React, nhưng trả metadata đúng ngay cả khi bot không chạy JS.
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const html = bundle['index.html']?.source;
        if (typeof html !== 'string') throw new Error('Không tìm thấy index.html sau khi build.');
        for (const [path, page] of Object.entries(PUBLIC_PAGES)) {
          if (path === '/') continue;
          this.emitFile({ type: 'asset', fileName: page.file, source: renderSeo(html, path) });
        }
        this.emitFile({ type: 'asset', fileName: 'private.html', source: renderSeo(html, '/login') });
        this.emitFile({
          type: 'asset', fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(PUBLIC_PAGES).map(path => `  <url><loc>${SITE_URL}${path}</loc></url>`).join('\n')}\n</urlset>\n`,
        });
      },
    },
  };
}
