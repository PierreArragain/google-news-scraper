"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _cheerio = _interopRequireDefault(require("cheerio"));
var _nodeFetch = _interopRequireDefault(require("node-fetch"));
var _puppeteer = _interopRequireDefault(require("puppeteer"));
var _buildQueryString = _interopRequireDefault(require("./buildQueryString.js"));
async function scrapeNews(config) {
  const queryString = config.queryVars ? (0, _buildQueryString.default)(config.queryVars) : "";
  const url = `https://news.google.com/search?${queryString}&q=${config.searchTerm} when:${config.timeframe || "7d"}`;
  //console.log(`SCRAPING NEWS FROM: ${url}`)
  const puppeteerConfig = {
    headless: true,
    args: _puppeteer.default.defaultArgs().concat(config.puppeteerArgs).filter(Boolean)
  };
  const browser = await _puppeteer.default.launch(puppeteerConfig);
  const page = await browser.newPage();
  page.setViewport({
    width: 1366,
    height: 768
  });
  page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36");
  page.setRequestInterception(true);
  page.on("request", request => {
    if (!request.isNavigationRequest()) {
      request.continue();
      return;
    }
    const headers = request.headers();
    headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3";
    headers["Accept-Encoding"] = "gzip";
    headers["Accept-Language"] = "en-US,en;q=0.9,es;q=0.8";
    headers["Upgrade-Insecure-Requests"] = 1;
    headers["Referer"] = "https://www.google.com/";
    request.continue({
      headers
    });
  });
  await page.setCookie({
    name: "CONSENT",
    value: `YES+cb.${new Date().toISOString().split("T")[0].replace(/-/g, "")}-04-p0.en-GB+FX+667`,
    domain: ".google.com"
  });
  await page.goto(url, {
    waitUntil: "networkidle2"
  });
  const content = await page.content();
  const $ = _cheerio.default.load(content);
  const articles = $('a[href^="./article"]').closest("div[jslog]");
  let results = [];
  let i = 0;
  const urlChecklist = [];
  $(articles).each(function () {
    const link = $(this).find('a[href^="./article"]').attr("href").replace("./", "https://news.google.com/") || false;
    link && urlChecklist.push(link);
    const mainArticle = {
      title: $(this).find("h3").text() || false,
      link: link,
      image: $(this).find("figure").find("img").attr("src") || false,
      source: $(this).find("div:last-child svg+a").text() || false,
      datetime: new Date($(this).find("div:last-child time").attr("datetime")) || false,
      time: $(this).find("div:last-child time").text() || false,
      related: []
    };
    const subArticles = $(this).find("div[jsname]").find("article");
    $(subArticles).each(function () {
      const subLink = $(this).find("a").first().attr("href").replace("./", "https://news.google.com/") || false;
      if (subLink && !urlChecklist.includes(subLink)) {
        mainArticle.related.push({
          title: $(this).find("h4").text() || $(this).find("h4 a").text() || false,
          link: subLink,
          source: $(this).find("div:last-child svg+a").text() || false,
          time: $(this).find("div:last-child time").text() || false
        });
      }
    });
    results.push(mainArticle);
    i++;
  });
  if (config.prettyURLs) {
    results = await Promise.all(results.map(article => {
      return (0, _nodeFetch.default)(article.link).then(res => res.text()).then(data => {
        const _$ = _cheerio.default.load(data);
        article.link = _$("c-wiz a[rel=nofollow]").attr("href");
        return article;
      });
    }));
  }
  await page.close();
  await browser.close();
  return results.filter(result => result.title);
}
var _default = scrapeNews;
exports.default = _default;
