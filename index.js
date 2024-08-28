const cheerio = require('cheerio');
const request = require('request');

const BASE_URL = "https://app.tgsrtclogistics.co.in/tsrtc/manifest/bookinghistory/468?bno=";

request(`${BASE_URL}22753043`, (error, response, html) => {
  if (!error && response.statusCode == 200) {
    const $ = cheerio.load(html);
    const dataArray = [];

    $(".content .data").each((i, el) => {
      const heading = $(el).children('h1').text().trim();
      const paragraph = $(el).children('p').text().replace(/\s+/g, ' ').trim();

      if (heading && paragraph) {
        const dataObject = {};
        dataObject[heading] = paragraph;
        dataArray.push(dataObject);
      }
    });

    console.log(dataArray);
  } else {
    console.error('Failed to fetch data:', error);
  }
});

