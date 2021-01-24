import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();

const baseUrl = 'https://classlion.net';
const loginUrl = baseUrl + '/login';
const lectureUrl = baseUrl + '/class/4';

const { CLASSLION_EMAIL, CLASSLION_PASSWORD } = process.env;

const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

const main = async () => {
  try {
    const browser = await puppeteer.launch({ 
      headless: true, 
      args: [
        '--no-sandbox',
      ],
    });
    const page = await browser.newPage();

    const masterJsonUrls = [];

    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url();
      if (url.indexOf('/master.json') !== -1) {
        masterJsonUrls.push(url);
      }
      req.continue();
    });

    await page.goto(loginUrl, { waitUntil: 'networkidle0' });

    const emailSel = 'input[type="email"]';
    const pwSel = 'input[type="password"]';
    const loginSubmitSel = '[class^="login__GreenButton-"]';
    await page.waitForSelector(emailSel);
    await page.waitForSelector(pwSel);
    await page.waitForSelector(loginSubmitSel);
    await page.type(emailSel, CLASSLION_EMAIL);
    await page.type(pwSel, CLASSLION_PASSWORD);
    await page.click(loginSubmitSel);
    console.log(`Logged in as ${CLASSLION_EMAIL}`);

    await page.waitForNavigation();

    await page.goto(lectureUrl, { waitUntil: 'networkidle0' });
    console.log('Accessed to the lecture page');

    const vidList = await page.$$eval(
      'div[class^="id__LectureDetailCurriculumSection-"] > a', 
      (list, baseUrl) => list.map((a, index) => {
        return {
          index,
          name: a.querySelector('[class^="id__LectureDetailCurriculumTitle-"]').textContent,
          href: baseUrl + a.getAttribute('href'),
        };
      }),
      baseUrl
    );
    console.log('Video URL list fetched');

    for (let i in vidList) {
      await page.goto(vidList[i].href, { waitUntil: 'networkidle0' });
      await sleep(500);
      console.log(`Fetched video "${vidList[i].name}" (${vidList[i].index + 1}/${vidList.length})`);
    }

    await browser.close();

    return vidList.map(v => ({
      fileName: v.name,
      masterJsonUrl: masterJsonUrls[v.index],
    }));
  } catch (e) {
    console.log(e);
  }
};

export default main;

