import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getSeoTags } from '../services/seo';

export default function SeoMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Đồng bộ metadata khi chuyển trang SPA; không đưa query, token hoặc mã phiên vào SEO.
    document.head.querySelectorAll('[data-courtsim-seo]').forEach(node => node.remove());
    for (const { tag, attrs = {}, children = '' } of getSeoTags(pathname)) {
      const node = document.createElement(tag);
      node.setAttribute('data-courtsim-seo', '');
      for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
      node.textContent = children;
      document.head.appendChild(node);
    }
  }, [pathname]);
  return null;
}
