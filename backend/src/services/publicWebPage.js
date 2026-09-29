import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { isPublicWebUrl } from '../../../shared/legalSourcePolicy.mjs';

const blocked = new BlockList();
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16], ['192.0.0.0', 24], ['192.0.2.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]]) blocked.addSubnet(address, prefix);
export function publicAddress(address) {
  return isIP(address) === 4 ? !blocked.check(address)
    : isIP(address) === 6 && /^[23][0-9a-f]{3}:/iu.test(address) && !/^(?:2001:db8:|2002:)/iu.test(address);
}

export async function fetchPublicLawPage(value, { resolver = lookup, request = (url, options, callback) => (url.protocol === 'https:' ? https : http).get(url, options, callback) } = {}) {
  const signal = AbortSignal.timeout(8000);
  let url = new URL(value);
  for (let redirect = 0; redirect <= 3; redirect++) {
    if (!isPublicWebUrl(url.href)) throw new Error('WEB_URL_NOT_PUBLIC');
    const addresses = await resolver(url.hostname, { all: true });
    if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new Error('WEB_ADDRESS_NOT_PUBLIC');
    // Ghim IP đã kiểm tra vào kết nối để tránh DNS đổi sang mạng nội bộ sau kiểm tra.
    const page = await new Promise((resolve, reject) => {
      const req = request(url, { signal, headers: { Accept: 'text/html,text/plain', 'User-Agent': 'CourtSim-LegalResearch/1.0' },
        lookup: (_host, options, callback) => options.all ? callback(null, addresses) : callback(null, addresses[0].address, addresses[0].family) }, async response => {
        try {
          if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
            response.resume(); resolve({ redirect: response.headers.location }); return;
          }
          if (response.statusCode !== 200 || !/text\/html|text\/plain/iu.test(response.headers['content-type'] ?? '')) throw new Error('WEB_PAGE_UNREADABLE');
          let length = 0; const chunks = [];
          for await (const chunk of response) {
            length += chunk.length;
            if (length > 3_000_000) throw new Error('WEB_PAGE_TOO_LARGE');
            chunks.push(chunk);
          }
          resolve({ url: url.href, content: Buffer.concat(chunks).toString('utf8') });
        } catch (error) { response.destroy(); reject(error); }
      });
      req.on('error', reject);
    });
    if (!Object.hasOwn(page, 'redirect')) return page;
    if (!page.redirect || redirect === 3) throw new Error('WEB_REDIRECT_LIMIT');
    url = new URL(page.redirect, url);
  }
}
