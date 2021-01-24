import crawler from './lib/crawler';
import download from './lib/vimeo-downloader';

async function main() {
  const urlInfo = await crawler();
  download(urlInfo);
}

main();

