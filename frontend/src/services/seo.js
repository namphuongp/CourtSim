export const SITE_URL = 'https://www.courtsimvn.com';
export const SITE_NAME = 'CourtSim';
export const BRAND_IMAGE = `${SITE_URL}/courtsim-favicon.png`;

// Chỉ các trang công khai trong danh sách này được đưa vào sitemap và cho index.
export const PUBLIC_PAGES = {
  '/': {
    title: 'CourtSim – Nền tảng AI mô phỏng phiên tòa',
    description: 'CourtSim giúp sinh viên luật luyện tập tranh tụng qua phiên tòa mô phỏng với AI, rèn luyện kỹ năng lập luận, phản biện và áp dụng pháp luật.',
    file: 'index.html',
  },
  '/guide': {
    title: 'Hướng dẫn luyện tập tranh tụng | CourtSim',
    description: 'Hướng dẫn chọn hồ sơ, nhập vai, trình bày lập luận và xem phản hồi sau phiên tòa mô phỏng trên CourtSim.',
    file: 'guide.html',
  },
  '/privacy': {
    title: 'Cài đặt quyền riêng tư | CourtSim',
    description: 'Tìm hiểu cách CourtSim sử dụng Google Analytics và quản lý lựa chọn cookie phân tích của bạn.',
    file: 'privacy.html',
  },
};

export function getPageSeo(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const page = Object.hasOwn(PUBLIC_PAGES, path) ? PUBLIC_PAGES[path] : null;
  return page
    ? { ...page, canonical: `${SITE_URL}${path}`, robots: 'index, follow, max-image-preview:large' }
    : { title: 'CourtSim', description: '', canonical: null, robots: 'noindex, follow' };
}

export function getSeoTags(pathname) {
  const page = getPageSeo(pathname);
  const tags = [
    { tag: 'title', children: page.title },
    { tag: 'meta', attrs: { name: 'robots', content: page.robots } },
  ];
  if (!page.canonical) return tags;

  tags.push(
    { tag: 'link', attrs: { rel: 'canonical', href: page.canonical } },
    ...Object.entries({
      description: page.description,
      'application-name': SITE_NAME,
      'twitter:card': 'summary',
      'twitter:title': page.title,
      'twitter:description': page.description,
      'twitter:image': BRAND_IMAGE,
      'twitter:image:alt': 'Biểu tượng thương hiệu CourtSim',
    }).map(([name, content]) => ({ tag: 'meta', attrs: { name, content } })),
    ...Object.entries({
      'og:type': 'website',
      'og:locale': 'vi_VN',
      'og:site_name': SITE_NAME,
      'og:url': page.canonical,
      'og:title': page.title,
      'og:description': page.description,
      'og:image': BRAND_IMAGE,
      'og:image:type': 'image/png',
      'og:image:width': '512',
      'og:image:height': '512',
      'og:image:alt': 'Biểu tượng thương hiệu CourtSim',
    }).map(([property, content]) => ({ tag: 'meta', attrs: { property, content } })),
  );

  if (page.canonical === `${SITE_URL}/`) {
    tags.push({
      tag: 'script', attrs: { type: 'application/ld+json' },
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: SITE_NAME, inLanguage: 'vi', description: page.description },
          { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, url: `${SITE_URL}/`, name: SITE_NAME, logo: BRAND_IMAGE },
        ],
      }),
    });
  }
  return tags;
}
