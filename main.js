// main thread code. Requests data from the server being scraped and directs it to the cheerio process.
//const db = require("./db");
const axios = require("axios");
const cheerio = require("cheerio");

let url =
  "https://games.mercadolivre.com.br/consoles/nao-inclui-controles/nintendo-switch_PriceRange_1500-0_NoIndex_True"; // prices over R$ 1.500.00

// to be used from the second page onwards
let firstProductNum = 49;
const P_NUM_INCREMENT = 47;

const COMMON_CSS_PATH =
  "div > div > a.ui-search-result__content > div.ui-search-result__content-wrapper";
const PRICES_CSS_PATH =
  " > div.ui-search-item__group--price > div > div > span.price-tag > span.price-tag-amount > span.price-tag-fraction";
const NAMES_CSS_PATH = " > div.ui-search-item__group--title > h2";
const PAGE_NUM_PATH =
  "main > div > div.ui-search-main > section > div.ui-search-pagination > ul > li.andes-pagination__page-count";

const pages = {};
//const prices = {};

const getPageNum = (str) => {
  let i = 0;
  let numStr = "";
  while (i < str.length) {
    const codepoint = str.charCodeAt(i);
    if (48 < codepoint && codepoint < 58) {
      numStr += str[i];
    }
    i++;
  }
  return parseInt(numStr);
};

const modifyUrl = () => {
  let i = 0;
  while (url[i] !== "_") i++;
  url = url.substr(0, i + 1) + "Desde_" + firstProductNum + url.substr(i);
  firstProductNum += P_NUM_INCREMENT;
  console.log("end of modifyUrl");
};

const processData = (res, page) => {
  console.log("--- Inside processData ---");
  console.log("page number =>", page);
  if (res) {
    // might want to remove this if since this is being checked in the calling function
    pages[page] = {};
    let rowNum = 0;
    const html = res.data;
    const $ = cheerio.load(html);
    $("main")
      .find("div > div > section")
      .find("ol")
      .each((i, ol) => {
        pages[page][rowNum] = [];
        $(ol)
          .find("li.ui-search-layout__item") // you have to specify the class because there are deeply nested li's inside the li's that contain the products
          .each((i, li) => {
            const commonDiv = $($(li).find(COMMON_CSS_PATH));
            const priceStr = commonDiv.find(PRICES_CSS_PATH).html();
            const nameStr = commonDiv.find(NAMES_CSS_PATH).html();
            pages[page][rowNum].push({
              name: nameStr,
              price: "R$ " + priceStr,
            });
          });
        console.log("> Page " + page + " row num. " + rowNum + " <");
        rowNum++;
      });
  }
  console.log("end of processData");
};

const scrapeRec = (page, pageNum, promisesArray) => {
  if (page <= pageNum) {
    console.log("--- PAGE " + page + " ---");
    promisesArray.push(
      fetchData(url)
        .then((res) => {
          console.log("Got response!");
          processData(res, page);
          modifyUrl();
        })
        .catch((err) => console.log("Error fetching data: ", err))
    );
    const newPage = page + 1;
    scrapeRec(newPage, pageNum, promisesArray); // won't wait for fetchData's promise to be resolved
  }
};

const scrape = async () => {
  const res = await fetchData(url);
  const promisesArray = [];
  if (res) {
    console.log("got res");
    const html = res.data;
    const $ = cheerio.load(html);
    const pageNum = getPageNum($(PAGE_NUM_PATH).text());
    console.log(pageNum);
    processData(res, 1);
    modifyUrl();
    scrapeRec(2, pageNum, promisesArray);
  }
  return Promise.all(promisesArray);
};

const fetchData = async (url) => {
  let res = null;
  try {
    res = await axios(url);
  } catch (e) {
    console.log(e);
  }

  if (res.status !== 200) {
    console.log("Request failed");
  }

  console.log("");

  return res;
};

const printPages = () => {
  Object.keys(pages).forEach((page) => {
    const pageObject = pages[page];
    console.log("== PAGE " + page + " ==");
    Object.keys(pageObject).forEach((row) => {
      const rowArray = pageObject[row];
      console.log("  > Row " + row + " <");
      rowArray.forEach((productObject, index) => {
        console.log("    " + index + " -> " + "Name: " + productObject.name);
        console.log("         Price: " + productObject.price);
      });
    });
  });
};

// why is page 2 missing
scrape().then(() => {
  printPages();
});
//console.log("end of scraping");
//prices.forEach((e) => console.log(e));
